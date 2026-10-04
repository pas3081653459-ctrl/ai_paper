import type { Experiment, Settings } from './types'
import { attention, ce, embedding, fmt, grid, image, mm, softmax, stage, sum, weights } from './math'
import sourceCode from './science.ts?raw'
const normal=(i:number)=>{const frac=(v:number)=>v-Math.floor(v);const u=Math.max(1e-8,frac(Math.sin(i*127.1+17)*43758.5453)),v=frac(Math.sin(i*311.7+41)*12515.873);return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
export function science(id:string,s:Settings):Experiment {
 if(id==='09'||id==='15') {
  const n=s.size??8,budget=s.budget??384,d=id==='15'?budget/(6*n):(s.data??8)
  const loss=(n:number,d:number)=>1+2/n**.35+2/d**.35
  const sizes=[1,2,4,8,16,32,64],surface=grid(7,7,(r,c)=>loss(sizes[r],sizes[c])),curve=sizes.map(nn=>[nn,id==='15'?budget/(6*nn):d,loss(nn,id==='15'?budget/(6*nn):d)])
  const current=[[n,d,6*n*d]],parts=[[1,2/n**.35,2/d**.35]],l=loss(n,d)
  return {knobs:id==='15'?[{key:'size',title:'归一化参数量 N',min:1,max:64,step:1,initial:8},{key:'budget',title:'归一化计算预算 C',min:96,max:1536,step:96,initial:384}]:[{key:'size',title:'归一化参数量 N',min:1,max:64,step:1,initial:8},{key:'data',title:'归一化数据量 D',min:1,max:64,step:1,initial:8}],stages:[
   stage('allocation','资源分配',current,'三列依次是 N、D、简化计算 C。无量纲教学单位，不对应实际参数数或 GPU 小时。','C ≈ 6ND','compute = 6 * n_parameters * n_tokens',[],{axes:['experiment','row','N/D/C'],kind:'measurement'}),
   stage('parts','损失的三个部分',parts,'固定不可约项 1，加上模型受限项与数据受限项；系数 2 与指数 0.35 全部为教学设定。','Ltoy=1+2N^(−0.35)+2D^(−0.35)','loss = 1 + 2 / N**.35 + 2 / D**.35',['allocation'],{axes:['experiment','row','component'],kind:'measurement'}),
   stage('surface','模型 × 数据损失面',surface,'行对应 N，列对应 D，都取 1、2、4、8、16、32、64；色块是损失，不是网络激活。','L[r,c]=Ltoy(Nr,Dc)','surface = [[loss(n,d) for d in sizes] for n in sizes]',['parts'],{axes:['experiment','N','D'],rows:sizes.map(String),kind:'measurement'}),
   stage('curve',id==='15'?'固定算力的权衡':'固定数据的收益递减',curve,id==='15'?'每行保持 6ND=C。N 太大时 D 被压缩，最优点在两项之间权衡。':'保持 D 不变，只增加 N，最终损失受数据项限制。',id==='15'?'D(N)=C/(6N)；N*toy=√(C/6)（仅本例对称系数）':'D 固定；L(N)=1+2N^(−0.35)+2D^(−0.35)',id==='15'?'curve = [(n, C/(6*n), loss(n,C/(6*n))) for n in sizes]':'curve = [(n, D, loss(n,D)) for n in sizes]',['surface'],{axes:['experiment','N index','N/D/L'],rows:sizes.map(String),kind:'measurement'})],metrics:[{label:'当前 D',value:fmt(d)},{label:'当前教学损失',value:fmt(l)},{label:id==='15'?'本例对称最优 N':'当前简化计算量',value:fmt(id==='15'?Math.sqrt(budget/6):6*n*d)}],observations:['图中是人造损失曲面，不是论文实验点。',id==='15'?'“均衡扩展”是论文经验结论；这里的精确最优点仅属于自选公式。':'在某一因素成为瓶颈时，另一个因素持续增长的收益会减弱。'],sourceCode}
 }
 if(id==='11') {
  const time=s.time??8,error=s.error??0,x0=image(),eps=grid(6,6,(r,c)=>normal(r*6+c+1))
  const betas=Array.from({length:20},(_,i)=>.02+i*.18/19),abar=betas.slice(0,time).reduce((a,b)=>a*(1-b),1)
  const xt=grid(6,6,(r,c)=>Math.sqrt(abar)*x0[r][c]+Math.sqrt(1-abar)*eps[r][c])
  const predicted=eps.map((row,r)=>row.map((v,c)=>v+error*Math.sin(r+c+1)))
  const estimate=grid(6,6,(r,c)=>(xt[r][c]-Math.sqrt(1-abar)*predicted[r][c])/Math.sqrt(abar))
  const beta=betas[time-1],mean=grid(6,6,(r,c)=>(xt[r][c]-beta/Math.sqrt(1-abar)*predicted[r][c])/Math.sqrt(1-beta))
  const mse=sum(estimate.flat().map((v,i)=>(v-x0.flat()[i])**2))/36
  const spatial={shape:[1,1,6,6],axes:['B','C','H','W']}
  return {knobs:[{key:'time',title:'扩散时间步 t',min:1,max:20,step:1,initial:8},{key:'error',title:'噪声估计误差强度',min:0,max:1,step:.05,initial:0}],image:x0,imageHint:'固定干净样本；本实验不编辑像素',stages:[stage('clean','干净图 x₀',x0,'固定教学图像。实际训练从数据集采样。','x₀ ∼ q(data)','x0 = dataset_sample',[],spatial),stage('noise','标准高斯噪声 ε',eps,'由固定种子的 Box–Muller 变换产生，改变 t 时沿用同一噪声便于比较。','ε ∼ N(0,I)','eps = seeded_gaussian_like(x0)',[],spatial),stage('noisy','加噪图 xₜ',xt,'无需逐步加噪，可由累计 ᾱ 一步采样任意时刻。','xₜ=√ᾱₜ x₀ + √(1−ᾱₜ) ε','xt = sqrt(alpha_bar)*x0 + sqrt(1-alpha_bar)*eps',['clean','noise'],spatial),stage('predict','教学噪声估计 ε̂',predicted,'这里用已知 ε 加人工误差替代模型，故不是训练后的 denoiser。','ε̂=ε+error·pattern','eps_hat = eps + error * pattern',['noisy'],spatial),stage('reconstruct','由 ε̂ 估计 x₀',estimate,'error=0 时可代数还原原图；这不能证明生成能力。','x̂₀=(xₜ−√(1−ᾱₜ)ε̂)/√ᾱₜ','x0_hat = (xt - sqrt(1-alpha_bar)*eps_hat)/sqrt(alpha_bar)',['noisy','predict'],spatial),stage('mean','反向一步的均值 μ',mean,'这不是整个反向采样结果。论文采样还含 σₜz，并需从 T 反复执行到 1。','μθ=(xₜ−βₜ ε̂/√(1−ᾱₜ))/√αₜ','mu = (xt - beta*eps_hat/sqrt(1-alpha_bar))/sqrt(alpha)',['noisy','predict'],spatial)],metrics:[{label:'ᾱₜ',value:fmt(abar)},{label:'重建 MSE',value:fmt(mse)}],observations:['时间越后，干净信号权重越小。','反向网络需要学习；知道真实 ε 的代数重建不是真实生成。'],sourceCode}
 }
 const rate=s.maskRate??.5,targets=[1,2,3,4,5,6,7,8],count=Math.max(1,Math.round(6*rate)),order=[2,5,3,7,4,6],selected=order.slice(0,count)
 const ids=targets.map((v,i)=>selected.includes(i)?9:v),x=embedding(ids),a=attention(x),prob=mm(a.out,weights(4,10,10)).map(softmax),losses=targets.map((v,i)=>[selected.includes(i)?1:0,selected.includes(i)?ce(prob[i],v):0])
 const labels=['文本提示0','图像提示1','文本响应2','文本响应3','图像码4','图像码5','图像码6','图像码7']
 return {knobs:[{key:'maskRate',title:'响应片段掩码比例 t',min:1/6,max:1,step:1/6,initial:.5}],stages:[stage('tokens','多模态离散编号',targets.map(v=>[v]),'头两个位置作为可见条件，后六个位置作为重建响应。图像码仅是符号，没有真实图像 tokenizer。','x=[prompt; response]','tokens = concatenate([prompt_ids, response_ids])',[],{rows:labels,kind:'state',axes:['B','position','id']}),stage('mask','扰动响应片段',ids.map(v=>[v]),'9 表示 [MASK]。保持条件可见，只在响应片段选择掩码位置。','rₜ=mask(r₀,t)','rt = mask_response_only(r0, ratio=t)',['tokens'],{rows:labels,kind:'state',axes:['B','position','id']}),stage('context','双向条件关系',a.a,'被遮位置可以利用可见条件和响应上下文，不是 GPT 的下三角生成。','A=softmax(QKᵀ/√D)','a = bidirectional_attention(embedding(masked_ids))',['mask'],{rows:labels,probability:true,axes:['B','query','key']}),stage('prediction','词元候选分布',prob,'固定未训练网络对十个教学编号打分；同时计算所有位置，但只在选中位置计损失。','pθ(xᵢ|xmasked)','p = vocab_head(hidden).softmax(-1)',['context'],{rows:labels,probability:true,axes:['B','position','vocab']}),stage('loss','掩码损失选择',losses,'左列为选择指示，右列为该位置负对数概率。与连续高斯扩散不同，这里破坏的是离散 token。','Ltoy=(1/(tL′)) Σᵢ I[maskedᵢ]·(−log pθ(r₀ᵢ))','loss = masked_nll.sum() / (mask_ratio * response_length)',['prediction'],{rows:labels,kind:'measurement',axes:['B','position','selected/NLL']})],metrics:[{label:'被遮响应位置',value:`${count} / 6`},{label:'按 tL′ 归一化损失',value:fmt(sum(losses.map(v=>v[1]))/(rate*6))}],observations:['本实验只讲掩码重建目标，不实现 UniGRPO。','离散掩码不是连续加高斯噪声，也不是自回归逐词条件概率链。'],sourceCode}
}
