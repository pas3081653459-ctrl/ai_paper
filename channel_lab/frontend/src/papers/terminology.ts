import {readingGuides} from './readingGuide'
import {papers} from './catalog'
/** English names are vocabulary, not claims that the linked paper coined them. */
export const bilingual:Record<string,{en:string;zh:string}>={
'通道':{en:'Channel',zh:'通道'},'残差':{en:'Residual',zh:'残差'},'先验':{en:'Policy prior',zh:'策略先验'},'访问数':{en:'Visit count',zh:'访问次数'},
'π':{en:'Search policy target (π)',zh:'搜索策略目标'},'z':{en:'Game outcome (z)',zh:'终局结果'},'Query':{en:'Query (Q)',zh:'查询向量'},'Key / Value':{en:'Key (K) / Value (V)',zh:'键向量 / 值向量'},
'标签预算':{en:'Label budget',zh:'标签预算'},'随机种子':{en:'Random seed',zh:'随机种子'},'MASK':{en:'Masked token',zh:'被遮蔽的词元'},'候选概率':{en:'Candidate probability',zh:'候选概率'},
'前缀':{en:'Prefix',zh:'输入前缀'},'贪心解码':{en:'Greedy decoding',zh:'贪心解码'},'Few-shot':{en:'Few-shot in-context learning',zh:'少样本上下文学习'},'Other':{en:'Other / invalid-label output',zh:'其他或标签格式不符的输出'},
'留出点':{en:'Held-out point',zh:'留出数据点'},'外推':{en:'Extrapolation',zh:'外推'},'Patch':{en:'Image patch',zh:'图像块'},'位置嵌入':{en:'Positional embedding',zh:'位置嵌入'},
't':{en:'Diffusion timestep (t)',zh:'扩散时间步'},'ε预测':{en:'Noise prediction (ε-prediction)',zh:'噪声预测'},'相似度':{en:'Similarity',zh:'相似度'},'零样本分类':{en:'Zero-shot classification',zh:'零样本分类'},
'奖励模型':{en:'Reward model (RM)',zh:'奖励模型'},'KL约束':{en:'Kullback–Leibler divergence penalty',zh:'KL散度惩罚'},'CoT提示':{en:'Chain-of-thought prompting (CoT)',zh:'思维链提示'},'首错':{en:'First identified error',zh:'首个可确认错误'},
'FLOPs':{en:'Floating-point operations',zh:'浮点运算次数'},'计算最优':{en:'Compute-optimal allocation',zh:'计算最优分配'},'位宽':{en:'Bit width',zh:'位宽'},'RoPE':{en:'Rotary positional embedding',zh:'旋转位置嵌入'},
'披露不足':{en:'Insufficient disclosure',zh:'披露不足'},'基准':{en:'Benchmark',zh:'评测基准'},'连接器':{en:'Vision-language connector',zh:'视觉语言连接器'},'语言先验':{en:'Language prior',zh:'语言先验'},
'正点 / 负点':{en:'Positive / negative point prompt',zh:'正点 / 负点提示'},'Mask':{en:'Segmentation mask',zh:'分割掩码'},'Observation':{en:'Observation',zh:'环境观察 / 工具反馈'},'证据链':{en:'Evidence chain',zh:'证据链'},
'NLL':{en:'Negative log-likelihood',zh:'负对数似然'},'过滤阈值':{en:'Filtering threshold',zh:'过滤阈值'},'Gate':{en:'Gating function / router',zh:'门控函数 / 路由器'},'加权质量':{en:'Sum of routing weights',zh:'路由权重总量'},
'组内优势':{en:'Group-relative advantage',zh:'组内相对优势'},'验证器':{en:'Verifier',zh:'验证器'},'图像码':{en:'Discrete image token / code',zh:'离散图像词元 / 码'},'再遮蔽':{en:'Remasking',zh:'重新遮蔽'}
}
const teachingTerms=new Set(['Other','首错','披露不足','证据链','加权质量','标签预算','留出点'])
const lessonTerms=papers.flatMap(paper=>readingGuides[paper.id].terms.map(([name,meaning],index)=>({
 id:`${paper.id}-${index}`,paper,name,...bilingual[name],meaning,
 context:readingGuides[paper.id].explain,example:readingGuides[paper.id].observe,
 origin:teachingTerms.has(name)?'本站用于组织实验和证据的说明词；英文为对应表达，不声称是论文原有的命名。':'这是本课所用术语的英文对照。下面定位的是该论文中的相关用法，不等于该论文首次发明这个概念。'
})))
const titles:Record<string,string>={'01':'用于图像识别的深度残差学习','02':'结合深度神经网络与树搜索掌握围棋','03':'通过自我对弈学习国际象棋与将棋的通用强化学习方法','04':'注意力机制即可满足所需','05':'通过生成式预训练改善语言理解','06':'BERT：用于语言理解的深度双向Transformer预训练','07':'语言模型是无监督多任务学习器','08':'语言模型是少样本学习器','09':'神经语言模型的缩放规律','10':'一张图像值得十六乘十六个词：大规模图像识别的Transformer','11':'去噪扩散概率模型','12':'从自然语言监督中学习可迁移的视觉模型','13':'通过人类反馈训练遵循指令的语言模型','14':'思维链提示激发大型语言模型的推理能力','15':'训练计算最优的大型语言模型','17':'LLaMA：开放且高效的基础语言模型','18':'GPT-4技术报告','19':'视觉指令微调','20':'分割一切','21':'ReAct：在语言模型中协同推理与行动','22':'Toolformer：语言模型能够自学使用工具','23':'Mixtral专家混合模型','24':'DeepSeek-R1：通过强化学习激励语言模型推理能力','25':'MMaDA：多模态大型扩散语言模型'}
const methodTerms=papers.map(paper=>({id:`${paper.id}-method`,paper,name:paper.name,en:paper.title,zh:`${paper.name} · ${titles[paper.id]}`,meaning:paper.principle,context:readingGuides[paper.id].explain,example:readingGuides[paper.id].action,origin:'英文为所收录论文标题，中文是本站阅读译名。出处采用随站PDF版本；不把论文中的所有基础概念都视为作者首创。'}))
const basics=[
{name:'Softmax',en:'Softmax',zh:'归一化指数函数',paperId:'04',meaning:'把一组实数分数转成非负、和为1的权重。它不是简单地除以分数总和。'},
{name:'Token',en:'Token',zh:'词元',paperId:'07',meaning:'分词器处理的基本单位，可能是一个词、子词、字符或字节片段；不一定等于一个汉字或英语单词。'},
{name:'Embedding',en:'Embedding',zh:'嵌入表示',paperId:'04',meaning:'将离散编号映射成向量的表示。输入嵌入通常通过查表得到，之后的网络层再结合上下文改变表示。'},
{name:'Logit',en:'Logit',zh:'未归一化输出分数',paperId:'07',meaning:'这里指softmax之前的词表分数，可为负数且和不必为1。它不同于softmax后的概率；二分类中logit还有对数几率的严格含义。'},
{name:'GRPO',en:'Group Relative Policy Optimization',zh:'组相对策略优化',paperId:'24',meaning:'利用同题一组回答的相对奖励构造优化信号的方法。优势标准化只是其中一步，完整目标还涉及策略比率、裁剪和KL等。'}
].map(t=>({id:`basic-${t.name}`,name:t.name,en:t.en,zh:t.zh,meaning:t.meaning,paper:papers.find(p=>p.id===t.paperId)!,context:readingGuides[t.paperId].explain,example:readingGuides[t.paperId].observe,origin:'这里引用论文中的使用语境，不作首次提出的历史归属。尤其GRPO在R1中被采用，不能由这个引用断言由R1首次提出。'}))
export const glossary=[...methodTerms,...basics,...lessonTerms]
