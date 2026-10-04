import type { Experiment, Settings } from './types'
import { add, attention, ce, embedding, fmt, gelu, grid, mm, norm, rms, silu, softmax, stage, sum, weights } from './math'
import sourceCode from './language.ts?raw'
export function language(id:string,s:Settings):Experiment {
 const stages:Experiment['stages']=[],metrics:Experiment['metrics']=[]
 if(id==='04') {
  const change=s.source??0,src=embedding([1,2+change,3]),tgt=embedding([4,5])
  const self=attention(tgt,true),decoded=norm(add(tgt,self.out)),cross=attention(decoded,false,src),out=norm(add(decoded,cross.out))
  stages.push(stage('source','源句表示',src,'视为编码器传来的三行上下文向量；本例不展开源端六层编码器。','Hsrc ∈ R^(1×3×4)','memory = encoder(source_ids)',[],{rows:['源0','源1','源2']}),
   stage('target','目标输入',tgt,'两个已知目标位置的嵌入。','Htgt ∈ R^(1×2×4)','target = embedding(target_ids)',[],{rows:['目标0','目标1']}),
   stage('self','目标因果注意力',self.a,'目标位置不能读取未来目标词元。','Aself=softmax(QKᵀ/√D+M)','a_self = masked_attention(target)',['target'],{probability:true,axes:['B','T_query','T_key']}),
   stage('decoder','自注意力后 Post-LN',decoded,'原论文在残差相加后做归一化。','D=LN(Htgt+SelfAttention(Htgt))','d = norm(target + self_output)',['target','self']),
   stage('cross','交叉注意力',cross.a,'Q 的两行来自目标，K/V 的三行来自源，关系表因此是 2×3。源端不存在目标未来遮罩。','Across=softmax(Qdecoder Kencoderᵀ/√D)','q = d @ Wq; k = memory @ Wk; v = memory @ Wv',['decoder','source'],{probability:true,axes:['B','T_target','T_source']}),
   stage('output','融合源信息',out,'读出源 Value 后与目标残差相加。完整 Decoder 后续还有 FFN，本课集中解释交叉注意力。','O=LN(D+Across Vencoder)','o = norm(d + a_cross @ v)',['decoder','cross']))
  return {knobs:[{key:'source',title:'替换源句中间词元',min:0,max:1,step:1,initial:0}],stages,metrics:[{label:'自注意力表',value:'2 × 2'},{label:'交叉注意力表',value:'2 × 3'}],observations:['Decoder 有自己的输入向量，并非只接收 Encoder 输出。','改变源表示会改变交叉注意力；目标因果掩码形状不变。'],sourceCode}
 }
 if(id==='17') {
  const offset=s.offset??0,position=s.position??2,x=embedding([1,2,3]).map(row=>row.map(v=>v+offset)),r=rms(x)
  const q=mm(r,weights(4,4,1)),k=mm(r,weights(4,4,2))
  function rotate(a:number[][]){return a.map(row=>{const result=[] as number[];for(let j=0;j<4;j+=2){const angle=position/(10000**(j/4));result.push(row[j]*Math.cos(angle)-row[j+1]*Math.sin(angle),row[j]*Math.sin(angle)+row[j+1]*Math.cos(angle))}return result})}
  const rq=rotate(q),rk=rotate(k),gate=mm(r,weights(4,8,3)),up=mm(r,weights(4,8,4)),gated=gate.map((row,i)=>row.map((v,j)=>silu(v)*up[i][j])),down=mm(gated,weights(8,4,5))
  stages.push(stage('input','输入',x,'可给所有分量加同一个偏移，观察 RMSNorm 与 LayerNorm 的区别。','X ← X + offset','x = embedding(ids) + offset'),stage('rms','RMSNorm',r,'不减均值，只按均方根缩放；本例 gamma=1。','RMSNorm(x)=x / √(mean(x²)+ε)','r = x * rsqrt(x.square().mean(-1, keepdim=True)+1e-5)',['input']),stage('q','Q 投影',q,'四维向量分为两对，分别使用不同旋转频率。','Q=rWQ','q = r @ Wq',['rms']),stage('k','K 投影',k,'Key 来自自己的线性投影；旋转后再参与 Q/K 匹配。','K=rWK','k = r @ Wk',['rms']),stage('rope','RoPE 后 Q/K',[rq,rk],'为隔离旋转，所有 token 使用控制器指定的同一位置；完整模型每个位置不同。每对的欧氏长度保持不变。','[q₂j′,q₂j+1′]ᵀ = R(position·θj)[q₂j,q₂j+1]ᵀ','q_rot = rotate_pairs(q, position); k_rot = rotate_pairs(k, position)',['q','k'],{planes:['旋转 Q','旋转 K'],axes:['B','branch','T','D']}),stage('gate','SwiGLU 两路',[gate,up],'门控支路经 SiLU 后与另一线性支路逐元素相乘。本例扩展宽度 8。','G=SiLU(rWg) ⊙ (rWu)','g = silu(r @ Wg) * (r @ Wu)',['rms'],{planes:['gate 投影','up 投影'],axes:['B','branch','T','F']}),stage('gated','门控结果',gated,'相乘不是拼接，宽度仍为 8。','F=SiLU(gate)⊙up','f = silu(gate) * up',['gate']),stage('down','投影回隐藏维',down,'回到 4 维供后续残差相加。这里只拆解三个算子，没有把它们伪装成完整网络。','Y=FWd','y = f @ Wd',['gated']))
  return {knobs:[{key:'position',title:'RoPE 位置',min:0,max:12,step:1,initial:2},{key:'offset',title:'输入整体偏移',min:-2,max:2,step:.2,initial:0}],stages,metrics:[{label:'Q 第一对长度（前）',value:fmt(Math.hypot(q[0][0],q[0][1]))},{label:'Q 第一对长度（后）',value:fmt(Math.hypot(rq[0][0],rq[0][1]))}],observations:['旋转改变方向，不改变每对向量长度。','SwiGLU 是门控 FFN，不是注意力矩阵。'],sourceCode}
 }
 const base=[1,2,3,4],masked=id==='06',mask=s.mask??2,shots=s.shots??1,prefix=s.prefix??1
 let ids=base.slice(),labels=['我','喜欢','猫','。']
 if(masked){ids=[0,...base];labels=['[CLS]',...labels];ids[mask]=8;labels[mask]='[MASK]'}
 if(id==='07'&&prefix){ids=[6,7,...ids];labels=['任务','翻译',...labels]}
 if(id==='08'){ids=[...Array.from({length:shots},()=>[5,6,7]).flat(),...base];labels=[...Array.from({length:shots},(_,i)=>[`例${i+1}入`,`→`,`例${i+1}出`]).flat(),...labels]}
 const x=embedding(ids).map((row,i)=>row.map((v,j)=>v+Math.sin(i*(j+1))*.1))
 const att=attention(norm(x),!masked),r=add(x,att.out),f=mm(mm(norm(r),weights(4,8,6)).map(row=>row.map(gelu)),weights(8,4,7)),hidden=norm(add(r,f))
 const logits=mm(hidden,weights(4,9,8)),probs=logits.map(softmax),task=s.task??0
 const output=id==='05'&&task?mm([hidden[hidden.length-1]],weights(4,2,9)).map(softmax):probs
 const loss=masked?ce(probs[mask],[0,...base][mask]):sum(probs.slice(0,-1).map((p,i)=>ce(p,ids[i+1])))/(ids.length-1)
 stages.push(stage('ids','输入编号',ids.map(v=>[v]),'词元和演示示例都是固定编号；不调用真实 tokenizer。','input_ids ∈ Z^(B×T)','ids = tokenize_demo(text)',[],{shape:[1,ids.length],axes:['B','T'],rows:labels}),stage('embed','嵌入与位置',x,'增加提示或示例改变长度和输入内容，不改动固定权重。','X=E[ids]+PE','x = embedding(ids) + position',['ids'],{rows:labels}),stage('attention',masked?'双向注意力':'因果注意力',att.a,masked?'[MASK] 位置仍可读取两侧上下文；没有未来三角遮罩。':'每行只能读取自己及之前的 token。','A=softmax(QKᵀ/√D+M)','a = attention(norm(x), causal=not bert_mode)',['embed'],{probability:true,axes:['B','T_query','T_key'],rows:labels}),stage('residual','注意力残差',r,'输入路径和上下文输出逐元素相加。','R=X+AV','r = x + a @ v',['embed','attention'],{rows:labels}),stage('ffn','前馈与第二次残差',hidden,'单块固定参数、GELU 近似；统一 Pre-LN 便于对照，不是原 BERT / GPT-1 的精确结构复现。','H=LN(R+FFN(LN(R)))','h = final_norm(r + ffn(norm(r)))',['residual'],{rows:labels}),stage('output',id==='05'&&task?'监督分类头':'词表概率',output,masked?'MLM 只在被选中位置计算预测损失。':id==='05'&&task?'取末尾隐藏向量映射为两个类别，其他任务有不同输入组织。':'每行用于预测下一个 token；这里的数值不代表语言能力。','P=softmax(HW)','p = head(h).softmax(-1)',['ffn'],{axes:['B','T','V'],probability:true,rows:id==='05'&&task?['句子']:labels}))
 if(masked)stages.push(stage('loss','MLM 损失位置',ids.map((_,i)=>[i===mask?1:0,i===mask?loss:0]),'只有当前被选中词元贡献 MLM 损失；右列其他 0 表示不计入，并非预测一定正确。','L=−log P(original_token | masked_input)','loss = cross_entropy(logits[:,mask], original[:,mask])',['output'],{axes:['B','T','selected/loss'],kind:'measurement',rows:labels}))
 metrics.push({label:'token 数 T',value:String(ids.length)},{label:'注意力表单元数',value:String(ids.length**2)},{label:masked?'MLM 目标损失':'演示 next-token 损失',value:fmt(loss)})
 const knobs:Experiment['knobs']=masked?[{key:'mask',title:'遮住的位置',min:1,max:4,step:1,initial:2}]:id==='05'?[{key:'task',title:'输出任务',min:0,max:1,step:1,initial:0,labels:{0:'语言建模',1:'监督分类'}}]:id==='07'?[{key:'prefix',title:'任务前缀',min:0,max:1,step:1,initial:1,labels:{0:'关闭',1:'加入任务文本'}}]:[{key:'shots',title:'上下文示例数',min:0,max:2,step:1,initial:1}]
 return {knobs,stages,metrics,observations:[masked?'MLM 的替换词元与 attention mask 不是同一个概念。':'权重始终固定，改变输入不是执行参数微调。','单块小网络仅演示前向数据流。'],sourceCode}
}
