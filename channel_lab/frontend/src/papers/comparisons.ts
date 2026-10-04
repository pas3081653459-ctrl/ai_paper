import type { Grid, Settings, Stage } from './types'
import { experiment } from './experiments'
import { attention, embedding, fmt, grid, mm, norm, rms, softmax, stage, sum, weights } from './math'
export interface ComparisonPanel { name:string; explanation:string; node:Stage; metrics:{label:string;value:string}[] }
export interface Comparison { title:string; cases:string[]; fixed:string; changed:string; action:string; observation:string; boundary:string; panels:ComparisonPanel[] }
const panel=(name:string,explanation:string,node:Stage,metrics:ComparisonPanel['metrics']=[]):ComparisonPanel=>({name,explanation,node,metrics})
const metric=(label:string,value:number|string)=>({label,value:typeof value==='number'?fmt(value):value})
const state=(id:string,title:string,matrix:Grid,axes=['sample','row','column'])=>stage(id,title,matrix,'固定案例','','',[],{axes,kind:'state'})
const mse=(a:Grid,b:Grid)=>sum(a.flat().map((v,i)=>(v-b.flat()[i])**2))/a.flat().length
interface Plan { title:string; cases:string[]; fixed:string; changed:string; action:string; observation:string; boundary:string; names:[string,string]; stages:[string,string]; configs:(variant:number)=>[Settings,Settings] }
// 对照是教学条件，不冒充训练后的旧模型与新模型。原论文效果来自独立的 Evidence 表。
const plans:Record<string,Plan>={
 '02':{title:'同一先验，一次选择与更多搜索',cases:['价值与 rollout 混合','只用固定网络价值'],fixed:'三个行动先验与叶子回报，探索系数 c=1。',changed:'根节点模拟次数从 1 增至 40；切换案例改变双方共同使用的评价混合。',action:'先猜先验最大的动作会不会仍占最多访问，再查看两边 π。',observation:'搜索能让先验与回传价值共同影响访问分配；不是直接复制最大先验。',boundary:'仅根节点 bandit，无围棋规则或完整树；更多访问不保证真实棋力提升。',names:['只模拟一次','模拟 40 次'],stages:['policy-target','policy-target'],configs:v=>[{visits:1,explore:1,mix:v?1:.5},{visits:40,explore:1,mix:v?1:.5}]},
 '03':{title:'搜索如何改变策略训练目标',cases:['少量搜索：12 次','较多搜索：60 次'],fixed:'同一 p、v 和三个固定叶子值，不更新权重。',changed:'一次根节点选择与多次模拟后的访问分布。',action:'比较 π 与第一次选择，解释为什么策略网络还能从搜索中学习。',observation:'同一网络先验可以产生不同的搜索目标；π 不是 p 的机械拷贝。',boundary:'不是自我对弈训练，也不模拟 Stockfish 比赛。',names:['一次访问形成的目标','更多访问形成的目标'],stages:['policy-target','policy-target'],configs:v=>[{visits:1,explore:1},{visits:v?60:12,explore:1}]},
 '05':{title:'共享表示，换任务头',cases:['语言预测 → 分类'],fixed:'四个 token 与主干权重完全相同；不更改输入。',changed:'输出头从逐位置词表预测变为末尾表示的句子分类。',action:'数一数行与列；哪些参数在任务迁移中新增了？',observation:'共享主干可以服务不同输出形状；实际 GPT-1 还会监督微调主干。',boundary:'没有预训练权重；此例不能用概率证明预训练带来的准确率收益。',names:['语言建模头','监督分类头'],stages:['output','output'],configs:()=>[{task:0},{task:1}]},
 '09':{title:'扩展一个因素后，瓶颈转移到哪里',cases:['数据仍为 8 单位','同时把数据补到 64 单位'],fixed:'同一个教学函数 L=1+2N^−.35+2D^−.35。',changed:'从 N=D=8 扩到 N=64；第二案例还扩 D。',action:'查看损失分量三列：不可约项、模型项、数据项。哪一项没有下降？',observation:'只增加模型不会降低数据瓶颈项；共同扩展会改变两个分量。',boundary:'系数为自选示意，绝非 Kaplan 原文拟合曲线；不能预测真实训练效果。',names:['原分配 N=8,D=8','扩大后的分配'],stages:['parts','parts'],configs:v=>[{size:8,data:8},{size:64,data:v?64:8}]},
 '12':{title:'同一批特征，监督配对能决定什么',cases:['温度 0.2','更尖锐的温度 0.05'],fixed:'同一组图文向量与对角配对标签，两边温度相同。',changed:'左边交换前两段文本但不改标签；右边恢复正确配对。',action:'在第一平面找每行最大值，再对照正确标签是否仍在对角线。',observation:'错配使概率集中在错误标签；降低温度还会放大错误配对的惩罚。',boundary:'恢复数据顺序不是重新训练 CLIP；只演示对比目标，不模拟 Figure 2 的学习速度。',names:['文本错配，标签未改','正确配对'],stages:['probabilities','probabilities'],configs:v=>[{swap:1,temperature:v?.05:.2},{swap:0,temperature:v?.05:.2}]},
 '13':{title:'同一高奖励策略，是否计算偏移代价',cases:['中等策略偏移','更大策略偏移'],fixed:'奖励 [0.7,-0.2]、参考分布 [0.5,0.5] 和当前策略相同。',changed:'KL 系数从 0 改为 1；案例切换改变双方共同的策略偏移。',action:'比较四列：期望奖励、KL、惩罚、目标；为什么奖励不变而目标变化？',observation:'约束是优化目标的一部分；加入惩罚不会自动把已经给定的策略改回来。',boundary:'无 PPO 更新，也不是人类偏好率；不能说目标数值更大就更受用户喜欢。',names:['不惩罚 KL','计入 KL 惩罚'],stages:['objective','objective'],configs:v=>[{shift:v?2:1,beta:0},{shift:v?2:1,beta:1}]},
 '15':{title:'总计算不变，把预算从参数移向数据',cases:['C=384','C=1536'],fixed:'同一个对称教学损失，以及两边相同 C=6ND。',changed:'左边模型偏大、数据偏少；右边使用此 toy 函数的均衡点。',action:'核对 N×D 是否相同，再比较损失和分量。',observation:'固定预算下模型并非越大越好；均衡点来自当前函数，不是任意任务的常数。',boundary:'不是重训 Gopher/Chinchilla，不能把网页损失换算成 MMLU。',names:['偏大模型、较少数据','本例均衡配置'],stages:['parts','parts'],configs:v=>[{size:v?64:32,budget:v?1536:384},{size:v?16:8,budget:v?1536:384}]},
 '18':{title:'同一批评测记录，改变决策规则',cases:['阈值从 0.3 改为 0.7','阈值从 0.5 改为 0.9'],fixed:'六条人工标签和合成概率，模型分数不变。',changed:'决定正类的阈值。',action:'逐行看哪个预测翻转，再看 accuracy/Brier：为何后者不受阈值影响？',observation:'指标评价的是不同性质；调整规则就能改变部分结果，不能一概归为模型能力变化。',boundary:'六条记录不是 GPT-4 输出；本例只解释评测协议的重要性。',names:['较低阈值','较高阈值'],stages:['records','records'],configs:v=>[{threshold:v?.5:.3},{threshold:v?.9:.7}]},
 '19':{title:'两阶段训练计划究竟差在哪里',cases:['同一固定视觉指令输入'],fixed:'同一视觉编码器、连接器和语言模型结构；不改变共同输入。',changed:'哪些模块允许更新。',action:'三行是视觉编码器、投影层、语言模型；找出唯一改变的标记。',observation:'两阶段都冻结视觉编码器；第二阶段不仅训练投影，还训练语言模型。',boundary:'0/1 是训练计划而非网络激活；开关不执行训练，真实表现差异见数据消融。',names:['阶段 1：特征对齐','阶段 2：指令微调'],stages:['trainable','trainable'],configs:v=>[{phase:0,visual:v},{phase:1,visual:v}]},
 '21':{title:'相同工具故障，停在失败还是继续取得观察',cases:['3 件，每件 7 元','5 件，每件 7 元'],fixed:'同一个问题，第一次工具都失败；本地脚本预设重试成功。',changed:'查看记录停在第 3 步，还是继续到第 6 步。',action:'第一列表示是否获得结果；未获得时第二列的 0 是否能被当作答案？',observation:'真实观察到成功结果前不能将占位 0 作为总价。',boundary:'预设脚本不是语言模型真实决策；重试在现实中也可能继续失败。',names:['失败后尚未重试','重试并读取成功结果'],stages:['state','state'],configs:v=>[{failure:1,turn:3,count:v?5:3},{failure:1,turn:6,count:v?5:3}]},
 '22':{title:'同样候选工具，筛选阈值如何影响保留',cases:['明显有益的候选 0','改善很小的候选 0'],fixed:'无调用、空调用、带结果的目标概率完全相同。',changed:'保留阈值从 0 提高到 0.6。',action:'每行是收益、阈值、是否保留；看看阈值过高是否会丢掉有益例子。',observation:'存在调用不代表有收益，阈值也有取舍。',boundary:'只是一个目标 token 的负对数损失，未生成训练集或训练 Toolformer。',names:['保留任何正改善','要求较明显改善'],stages:['filter','filter'],configs:v=>[{benefit:v?.05:.35,threshold:0},{benefit:v?.05:.35,threshold:.6}]},
 '24':{title:'绝对奖励与组内区分信号',cases:['第一条奖励为 1','第一条奖励为 −1'],fixed:'每组四条回答，相同的总体标准差计算规则。',changed:'左边全组同奖励；右边设为可区分的奖励。',action:'为什么左边不论奖励高低，优势都为零？右边最高的奖励一定等于优势值吗？',observation:'相对优势取决于整组参照，奖励的绝对大小与组内学习信号不同。',boundary:'不比较 PPO/GRPO 的真实效果；未采样语言回答或执行梯度更新。',names:['全组相同奖励','组内有奖励差别'],stages:['advantage','advantage'],configs:v=>[{equal:1,reward:v?-1:1},{equal:0,reward:v?-1:1}]},
 '25':{title:'响应全遮挡与部分可见',cases:['可见一半响应','只遮住一个响应位置'],fixed:'两个可见条件 token 与六个原始响应 token，9 表示 MASK。',changed:'只改变响应中的掩码比例，条件始终可见。',action:'数清哪些位置可以提供上下文；能否直接套用左到右条件概率？',observation:'双向掩码重建读取的条件集合不同于自回归前缀，后训练概率估计也必须考虑这一点。',boundary:'不是 UniGRPO 或最终 MMaDA 推理；不同掩码比例的瞬时损失不能直接当模型能力排名。',names:['响应全遮挡','响应部分遮挡'],stages:['mask','mask'],configs:v=>[{maskRate:1},{maskRate:v?1/6:.5}]}
}
export function comparison(id:string,variant:number):Comparison {
 if(id==='07') {
  const labels=['阿明上午去了公园。','下午下雨，他带伞回家。'],prompt=[...labels,'TL;DR:']
  return {title:'同一篇短文，怎样提示模型开始摘要',cases:['固定两句短文'],fixed:'短文：阿明上午去了公园。下午下雨，他带伞回家。模型与正文不变。',changed:'在文章末尾追加 TL;DR:，对应原文摘要实验的输入操作。',action:'两边的正文一字不变。任务要求进入了输入的哪个位置？接下来应比较什么输出指标？',observation:'任务通过上下文格式表达；原论文用有/无提示的 ROUGE 比较检验效果，而不是只检查输入变长。',boundary:'每行是一个文本片段的演示编号，不是真实 tokenizer；这里不生成或伪造 GPT-2 的摘要。',panels:[panel('没有摘要提示','模型仅看到文章续写上下文。',stage('article','输入片段',[[1],[2]],'','','',[],{kind:'state',axes:['B','fragment','id'],rows:labels}),[metric('正文片段',2)]),panel('末尾添加 TL;DR:','追加提示而不更新模型参数。',stage('prompt','输入片段',[[1],[2],[3]],'','','',[],{kind:'state',axes:['B','fragment','id'],rows:prompt}),[metric('正文片段',2),metric('任务提示片段',1)])]}
 }
 if(id==='08') {
  const ids=variant?[1,2,3,4,2,5,7,2]:[1,2,3,7,2],names:Record<number,string>={1:'12+34',2:'→',3:'46',4:'23+45',5:'68',7:'17+28'},query=[7,2]
  const make=(tokens:number[])=>stage('context','因果关系表',attention(embedding(tokens),true).a,'','','',[],{rows:tokens.map(v=>names[v]),probability:true,axes:['B','query','key']})
  return {title:'同一算术问题，演示进入哪里',cases:['加入 12+34→46','再加入 23+45→68'],fixed:'待回答问题 17+28、固定小网络权重；示例答案都是公开写出的算术事实。',changed:'在问题前放 1 或 2 个演示；每个表达式/箭头/答案视为演示符号单元。',action:'找最后两行的问题，再看它们能读取哪些演示。比较关系表单元数。',observation:'示例增加了上下文与前向计算，不触发梯度更新。真正的算术准确率差别由原文 Table 3.9 验证。',boundary:'这不是真实 BPE，也没有训练出加法能力；概率仅用于展示因果关系，不把它当 GPT-3 答题结果。',panels:[panel('zero-shot 上下文','输入问题和输出分隔标记。',make(query),[metric('符号单元数',2),metric('关系表单元数',4)]),panel('带算术演示的上下文','可见前面的问答格式，权重相同。',make(ids),[metric('符号单元数',ids.length),metric('关系表单元数',ids.length**2)])]}
 }
 if(id==='01') {
  const input=[[.2,.4,.6],[.8,1,1.2]],a=variant===1?.1:0,target=input.map(row=>row.map(v=>variant===2?0:v*(1+a)))
  const plain=input.map(row=>row.map(v=>a*v)),res=input.map(row=>row.map(v=>(1+a)*v))
  return {title:'想保留输入时，哪种参数化更直接',cases:['目标是原样传递','目标是增加 10%','反例：目标变成全零'],fixed:'相同输入与相同可学习标量 a；不优化参数。',changed:'输出由 a·x 改为 x+a·x。',action:'比较输出与目标，再切到第三个案例：捷径是否总是更接近任意目标？',observation:'零残差自然保留输入；目标若为零，普通映射反而直接。这解释参数化偏向，不是训练效果证明。',boundary:'一维线性分支代替卷积，不能把此 MSE 当论文错误率，也不是公平的训练收敛对照。',panels:[panel('普通映射 a·x',`a=${a}，直接学习目标映射。`,stage('plain','输入 / 输出 / 目标',[input,plain,target],'','','',[],{planes:['输入','输出','目标'],shape:[1,3,2,3],axes:['B','role','H','W']}),[metric('与目标的 MSE',mse(plain,target))]),panel('残差映射 x+a·x',`a=${a}，学习对输入的改变量。`,stage('res','输入 / 输出 / 目标',[input,res,target],'','','',[],{planes:['输入','输出','目标'],shape:[1,3,2,3],axes:['B','role','H','W']}),[metric('与目标的 MSE',mse(res,target))])]}
 }
 if(id==='04') {
  const n=variant?8:4,chain=grid(n,n,(r,c)=>r===c+1?1:0),full=grid(n,n,()=>1)
  return {title:'远距离信息需要经过几次传递',cases:['4 个位置','8 个位置'],fixed:'同一长度序列，观察第 0 个位置到最后位置的依赖路径。',changed:'相邻状态传递与全局直接连接。',action:'从最后一行往前追箭头：循环链要经过多少个中间状态？',observation:'全局注意力能建立一跳关系，但关系表也从链结构变成 N×N。',boundary:'表中 1 代表连接，不是训练得到的注意力权重；这里只分析路径，不测 BLEU 或真实速度。',panels:[panel('循环链：相邻状态依赖','这是相邻状态的一步连接图；完整 RNN 仍能间接接收远处信息。',state('chain','局部状态连接',chain,['B','destination','source']),[metric('0→末位路径长度',n-1),metric('沿序列的串行步数',n)]),panel('全局自注意力连接','同一层每个位置能直接读取其他可见位置。',state('full','全局连接',full,['B','query','key']),[metric('0→末位路径长度',1),metric('关系表单元数',n*n)])]}
 }
 if(id==='06') {
  const x=embedding([1,8,variant?7:2]),left=attention(x,true),both=attention(x),at=1
  return {title:'右侧词元能否影响被遮位置',cases:['右侧 token=2','右侧 token=7'],fixed:'同一输入、Q/K/V 权重和 MASK 位置（第 1 行）。',changed:'因果可见范围与双向可见范围；切换案例只改共同输入的未来词元。',action:'看第 1 行第 2 列：单向模式为什么永远为 0？切案例后该行会否变化？',observation:'双向模型可以使用右侧上下文；单向模式在该位置不能读取未来。',boundary:'没有训练词义，不把随机权重的概率当消歧能力。它演示 Table 5 所检验的结构条件。',panels:[panel('LTR 因果范围','只能读取自身及左侧。',stage('ltr','注意力权重',left.a,'','','',[],{probability:true,axes:['B','query','key']}),[metric('MASK 读右侧的权重',left.a[at][2])]),panel('双向范围','MASK 本身仍是合法词元。',stage('bi','注意力权重',both.a,'','','',[],{probability:true,axes:['B','query','key']}),[metric('MASK 读右侧的权重',both.a[at][2])])]}
 }
 if(id==='10') {
  const r=variant?1:0,c=variant?1:0,local=grid(4,4,(i,j)=>Math.abs(i-r)<=1&&Math.abs(j-c)<=1?1:0),global=grid(4,4,()=>1)
  return {title:'同一个图像位置，一层能接触多大范围',cases:['观察左上角 patch','观察内部 patch'],fixed:'4×4 个空间位置，观察位置相同；数值 1 仅表示可直接连接。',changed:'3×3 局部卷积的一层感受范围与全局 patch 注意力范围。',action:'先数局部可见位置，再展开全局平面；如果卷积堆两层会发生什么？',observation:'卷积通过深度扩大范围，全局注意力直接覆盖；这不说明哪一种在少数据时更准。',boundary:'不是已训练特征或注意力强度。数据规模下的精度差别仍需看原文实验。',panels:[panel('3×3 局部连接','这里只看一层，包含 padding 边界效应。',state('local','可读取位置',local,['B','patch row','patch col']),[metric('可读取位置数',sum(local.flat()))]),panel('全局 patch 连接','各位置都可建立关系，训练后权重未必平均。',state('global','可读取位置',global,['B','patch row','patch col']),[metric('可读取位置数',16)])]}
 }
 if(id==='11') {
  const times=[2,10,20],errors=variant?[4,1,.1]:[1,1,1],beta=Array.from({length:20},(_,i)=>.02+i*.18/19)
  const coeff=times.map(t=>{const abar=beta.slice(0,t).reduce((a,b)=>a*(1-b),1);return beta[t-1]/(2*(1-beta[t-1])*(1-abar))})
  const weighted=errors.map((e,i)=>[e,coeff[i],e*coeff[i]]),simple=errors.map(e=>[e,1,e])
  return {title:'同样的噪声预测误差，不同目标强调什么',cases:['三个时刻 MSE 相同','较早时刻 MSE 更大'],fixed:'三个时刻 t=2/10/20 的固定 MSE；20 步教学 β 日程，σ²=β。',changed:'变分目标 ε 项的系数与 Lsimple 的等权系数。',action:'三列分别是 MSE、系数、损失贡献；看看哪一行被放大或减弱。',observation:'更换损失不仅是改写公式，也改变时间步的相对学习重点。',boundary:'只展示 t>1 的局部系数；省略 t=1 解码项等。不是论文 1000 步训练，也不能据此计算 FID。',panels:[panel('带时间步权重','系数 β/[2α(1−ᾱ)]，来自固定 σ²=β 的局部项。',state('weighted','MSE / 权重 / 贡献',weighted,['experiment','time','component']),[metric('三项总和',sum(weighted.map(r=>r[2])))]),panel('Lsimple 等权','相同时刻的误差不再乘上述系数。',state('simple','MSE / 权重 / 贡献',simple,['experiment','time','component']),[metric('三项总和',sum(errors))])]}
 }
 if(id==='14') {
  const subtotal=variant?5:6,answer=5+subtotal
  return {title:'同一个答案，有没有可检查的中间步骤',cases:['正确算术轨迹','故意注入乘法错误'],fixed:'固定题：已有 5 个球，再买 2 罐，每罐 3 个；两边最终答案相同。',changed:'是否公开中间算术状态。',action:'第二案例最终答案都是 10。逐步展示哪一行能定位错误？',observation:'中间步骤能帮助检查，但错误也可以写得很详细；正确答案应为 11。',boundary:'两边都是手写教学记录，不是模型响应，不能拿它统计 CoT 准确率。',panels:[panel('只给答案','缺少定位错误的位置。',state('direct','最终答案',[[answer]]),[metric('答案',answer)]),panel('给出分步记录','行0：罐数×每罐数→新增；行1：原有+新增→总数。',state('steps','两个算术步骤',[[2,3,subtotal],[5,subtotal,answer]]),[metric('答案',answer),metric('乘法步骤是否正确',variant?'否':'是')])]}
 }
 if(id==='17') {
  const x=embedding([1,2,3]).map(row=>row.map(v=>v+(variant?4:0))),ln=norm(x),rn=rms(x)
  return {title:'相同输入，是否减去均值',cases:['原始固定向量','所有分量增加 4'],fixed:'相同三行输入、同样 ε=1e-5；可学习缩放设为 1。',changed:'LayerNorm 先中心化再缩放，RMSNorm 不中心化。',action:'切换整体偏移，比较第一行均值：哪种算子对统一平移保持不变？',observation:'归一化设计改变了保留的信息；这解释运算差别，不证明谁在所有任务更好。',boundary:'论文系统表没有隔离此单算子；不能把 LLaMA 得分全归于 RMSNorm。',panels:[panel('LayerNorm','减均值后除以标准差。',stage('ln','归一化输出',ln,'','',''),[metric('第一行均值',sum(ln[0])/4)]),panel('RMSNorm','直接除以均方根。',stage('rms','归一化输出',rn,'','',''),[metric('第一行均值',sum(rn[0])/4)])]}
 }
 if(id==='20') {
  const small=grid(4,4,(r,c)=>r>=1&&r<=2&&c>=1&&c<=2?1:0),large=grid(4,4,(r,c)=>r<=2&&c<=2?1:0)
  const truth=variant?large:small,intersection=sum(large.flat().map((v,i)=>v*truth.flat()[i])),union=sum(large.flat().map((v,i)=>Math.max(v,truth.flat()[i])))
  return {title:'一个点对应整体还是部件',cases:['目标是内部 2×2 部件','目标是外部 3×3 整体'],fixed:'同一个正提示 (1,1)，固定嵌套的两个几何区域。',changed:'只保留一个大 mask，或保留大小两个候选。',action:'换目标后看单一 mask 的 IoU；两个候选中是否仍含期望目标？',observation:'单点不足以决定粒度；候选集合可以覆盖歧义，但还需要选择机制。',boundary:'手工几何 mask，不是 SAM 输出。知道目标后检查集合覆盖是 oracle 分析，不等于模型能自动选对。',panels:[panel('只输出大区域','输出始终为 3×3 区域。',state('single','单一 mask',large,['B','H','W']),[metric('与当前目标 IoU',intersection/union)]),panel('保留两个候选','两个平面分别为小/大区域，均包含正提示。',stage('multi','候选集合',[small,large],'','','',[],{kind:'state',planes:['小部件','大整体'],axes:['B','candidate','H','W']}),[metric('候选数',2),metric('集合包含当前目标','是（由用户指定目标核对）')])]}
 }
 if(id==='23') {
  const x=embedding([1,2,3]);x[0][0]+=variant?2:0
  const logits=mm(x,weights(4,8,1)),dense=logits.map(softmax),sparse=logits.map(row=>{const ids=row.map((v,i)=>({v,i})).sort((a,b)=>b.v-a.v).slice(0,2).map(v=>v.i),p=softmax(ids.map(i=>row[i]));return row.map((_,i)=>ids.includes(i)?p[ids.indexOf(i)]:0)})
  return {title:'同一组专家，去掉未选分支后发生什么',cases:['固定输入 A','改动 token 0 的一个特征'],fixed:'八个专家的路由分数计算相同，每行一个 token。',changed:'Softmax 全部八个，或只保留 Top-2 再归一化。',action:'数一数每行非零格，再切换输入，看不同 token 是否选择同样专家。',observation:'稀疏路由让每个 token 只执行两个专家，汇合仍保持隐藏维度。',boundary:'左边是“全专家混合”的教学消融，不是 LLaMA 稠密 FFN；不能用格子数量推算真实速度。',panels:[panel('全部专家混合','八个专家都有非零门控。',stage('all','门控权重',dense,'','','',[],{probability:true,axes:['B','token','expert']}),[metric('每 token 计算专家数',8)]),panel('Top-2 稀疏混合','六个未选专家权重严格为零。',stage('top2','门控权重',sparse,'','','',[],{probability:true,axes:['B','token','expert']}),[metric('每 token 计算专家数',2)])]}
 }
 const plan=plans[id]
 if(!plan)throw new Error(`缺少论文对照实验：${id}`)
 const settings=plan.configs(variant)
 const panels=settings.map((s,i)=>{const lab=experiment(id,s),node=lab.stages.find(n=>n.id===plan.stages[i])!;return panel(plan.names[i],node.description,node,lab.metrics)})
 return {...plan,panels}
}
