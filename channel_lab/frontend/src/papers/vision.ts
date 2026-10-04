import type { Experiment, Settings } from './types'
import { add, attention, conv, embedding, fmt, grid, image, mm, norm, scale, softmax, stage, sum, weights } from './math'
import sourceCode from './vision.ts?raw'
export function vision(id:string,s:Settings):Experiment {
 const stages:Experiment['stages']=[], metrics:Experiment['metrics']=[], observations:string[]=[]
 const edited=image().map((row,r)=>row.map((v,c)=>s.pixel===r*6+c?1-v:v))
 if(id==='01') {
  const strength=s.strength??1,skip=s.skip??1,stride=s.stride??1
  const c1=conv(edited,[[0,-.2,0],[-.2,1,-.2],[0,-.2,0]],stride)
  const c2=conv(edited,[[-.1,0,.1],[-.2,0,.2],[-.1,0,.1]],stride)
  const relu=[c1,c2].map(g=>g.map(row=>row.map(v=>Math.max(0,v))))
  const branch=scale(add(conv(relu[0],[[0,.1,0],[.1,.4,.1],[0,.1,0]]),conv(relu[1],[[0,0,0],[0,.3,0],[0,0,0]])),strength)
  const shortcut=grid(branch.length,branch[0].length,(r,c)=>edited[r*stride][c*stride])
  const merged=add(branch,scale(shortcut,skip)),out=merged.map(row=>row.map(v=>Math.max(0,v)))
  stages.push(stage('input','输入图',[edited],'一张 6×6 灰度图；点击上方像素会更新整条前向链。','X ∈ R^(1×1×6×6)','x = image[None,None]',[],{shape:[1,1,6,6],axes:['B','C','H','W']}),
   stage('conv','卷积输出',[c1,c2],'两组 3×3 核产生两个通道，padding=1；可切换 stride。','Y[o,i,j] = Σ X[i·s+u,j·s+v] K[o,u,v]','c = conv2d(x, kernel, stride=s, padding=1)',['input'],{shape:[1,2,c1.length,c1.length],axes:['B','C','H','W'],planes:['通道 0','通道 1']}),
   stage('relu','ReLU',[...relu],'逐元素截断负值，通道形状不变。','ReLU(z)=max(0,z)','a = c.relu()',['conv'],{axes:['B','C','H','W'],planes:['通道 0','通道 1']}),
   stage('branch','主分支 F(x)',branch,'第二次卷积将两个通道混回一个，主分支强度只作教学控制。','F(x)=g·Conv₂(ReLU(Conv₁(x)))','f = strength * conv2(a)',['relu']),
   stage('skip','捷径',scale(shortcut,skip),'下采样时本例用固定单位 1×1 卷积、同样 stride 对齐空间尺寸；不是任意缩放。','shortcut = Conv₁×₁,stride=s(X)','shortcut = skip_enabled * conv1x1(x, stride=s)',['input']),
   stage('sum','相加',merged,'主分支与捷径逐位置相加，不拼接通道。','S=F(x)+shortcut(x)','s = f + shortcut',['branch','skip']),
   stage('output','输出',out,'原版 ResNet 基本块相加后还有 ReLU。本例省略 BN，不能用于比较训练收敛。','Y=ReLU(S)','y = s.relu()',['sum']))
  for (const node of stages) { node.shape=[1,node.slices.length,node.slices[0].length,node.slices[0][0].length]; node.axes=['B','C','H','W'] }
  metrics.push({label:'输出形状',value:`1 × 1 × ${out.length} × ${out.length}`},{label:'主分支均值',value:fmt(sum(branch.flat())/branch.flat().length)})
  return {knobs:[{key:'strength',title:'主分支强度',min:0,max:2,step:.1,initial:1},{key:'skip',title:'残差捷径',min:0,max:1,step:1,initial:1,labels:{0:'关闭',1:'开启'}},{key:'stride',title:'步长',min:1,max:2,step:1,initial:1}],stages,metrics,observations:['对齐后相加，输出通道不翻倍。','本例展示结构，不以未训练输出判断识别效果。'],image:edited,imageHint:'点击一个像素改变输入',sourceCode}
 }
 const p=s.patch??3,patches=[] as number[][]
 for(let r=0;r<6;r+=p)for(let c=0;c<6;c+=p)patches.push(Array.from({length:p*p},(_,k)=>edited[r+Math.floor(k/p)][c+k%p]))
 const patchVectors=mm(patches,weights(p*p,4)),cls=[[.2,.1,-.1,.3]],sequence=[...cls,...patchVectors]
 const positioned=sequence.map((row,r)=>row.map((v,c)=>v+Math.sin((r+1)*(c+1))*.1))
 const a=attention(norm(positioned)),hidden=add(positioned,a.out),logits=mm([hidden[0]],weights(4,3,8)),prob=logits.map(softmax)
 stages.push(stage('image','原图',edited,'单通道 6×6 小图，保持像素顺序。','H=W=6,C=1','x = image',[],{shape:[1,1,6,6],axes:['B','C','H','W']}),
  stage('patches','切块并展平',patches,'每行是一块 patch；移动到下一行就是下一块，不是另一通道。','N=HW/P²；每块长度=P²C','patches = rearrange(x, "b c (h p) (w q) -> b (h w) (p q c)")',['image']),
  stage('embedding','线性嵌入',patchVectors,'无论每块有多少像素，都投影到固定 D=4。','Epatch = Xpatch W','tokens = patches @ W',['patches']),
  stage('position','加入 CLS 与位置',positioned,'额外的 CLS 使长度从 N 变为 N+1；位置项是固定教学向量。','Z₀=[CLS; Epatch]+Epos','z = cat([cls, tokens], dim=1) + position',['embedding']),
  stage('attention','全局注意力',a.a,'每块可读取全部 patch 与 CLS。本例只演示单头注意力子层。','A=softmax(QKᵀ/√D)','a = softmax(q @ k.T / sqrt(4))',['position'],{axes:['B','T_query','T_key'],probability:true}),
  stage('hidden','注意力残差',hidden,'已融合上下文；为突出 patch 化，本例没有堆叠完整 Encoder 的 FFN。','Z=Z₀+AV','z = z + a @ v',['position','attention']),
  stage('logits','CLS 分类头',prob,'只取 CLS 位置，映射到三个演示类别；没有训练，不能识别真实类别。','p=softmax(Z[CLS] Wclass)','p = classifier(z[:,0]).softmax(-1)',['hidden'],{axes:['B','sample','class'],probability:true}))
 metrics.push({label:'patch 数',value:String(patches.length)},{label:'序列长度',value:String(positioned.length)},{label:'单头关系数',value:String(positioned.length**2)})
 return {knobs:[{key:'patch',title:'patch 边长',min:2,max:3,step:1,initial:3}],stages,metrics,observations:['像素总数不变，patch 越小，序列越长。','类别分数来自固定权重，不是识别结果。'],image:edited,imageHint:'点击像素，观察对应 patch 及全局注意力变化',sourceCode}
}
