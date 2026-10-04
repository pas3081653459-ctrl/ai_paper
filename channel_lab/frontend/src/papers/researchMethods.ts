import type { Research } from './researchTypes'
export const methodResearch:Record<string,Research>={
 '09':{
  problem:'预算有限时该增加参数、数据还是训练步数？单次“大模型比小模型好”无法给出资源分配规律，需要跨多个尺度的受控实验。',
  previous:[{name:'试一个更大的模型',approach:'沿单一方向扩大并观察验证损失。',gap:'可能已被数据或训练计算限制，无法解释剩余瓶颈。'},{name:'每个模型都训练到收敛',approach:'比较各规模能达到的最佳损失。',gap:'收敛性能最优不等于固定计算预算下效率最优。'}],
  insight:'先分离参数受限、数据受限与计算受限区域，在 log-log 尺度拟合规律，再研究计算预算的最优分配。经验拟合不是不依赖条件的数学定理。',
  method:[{title:'扫描多个数量级',detail:'改变 N、D、训练计算，保持另两项足够大来识别单因素瓶颈。'},{title:'拟合幂律与过拟合边界',detail:'观察损失随尺度变化，并分析固定数据时增加参数的收益递减。'},{title:'寻找计算有效前沿',detail:'在有限预算内比较不同模型训练到不同阶段的结果；未完全收敛的大模型也可能更划算。'}],
  experiments:[{title:'三条拟合规律有不同的适用条件',question:'可以把三种指数直接当成谁的“精度更好”吗？',setup:'§1.2 的 Equations 1.1–1.3，报告原文近似拟合指数；这是参数估计，不是三个模型的基准得分。',control:'每条曲线都要求其余因素不成为主要瓶颈；Cmin 还有最优分配等条件。',change:'分别让参数 N、数据 D、最优计算 Cmin 成为限制项。',metrics:[{name:'损失幂律指数 α',unit:'',better:'neutral'}],rows:[{name:'参数受限 αN',values:[.076]},{name:'数据受限 αD',values:[.095]},{name:'最优计算受限 αCmin',values:[.050]}],finding:'三条曲线近似幂律，但横轴与控制条件不同，不能按指数大小直接决定“投数据永远更好”。后续计算分配还要联合约束。',boundary:'网页的 1+2/N^.35+2/D^.35 只是可操作的双瓶颈示意，系数不来自这三条公式，不能用于复现论文预测。',source:{pages:[3,4,5],label:'Figure 1、Equations 1.1–1.8'}}],
  conclusion:'研究先建立受控缩放曲线，再提出配置策略。没有控制其他瓶颈就直接套幂律，是最容易误用的地方。',openQuestion:'若数据固定且很少，继续扩大 N 还能沿原来的参数受限幂律一直改善吗？'
 },
 '14':{
  problem:'大模型在简单多步算术上也会失败。只给“问题→最终答案”的示例，是否缺少了可分解任务的中间结构？',
  previous:[{name:'标准 few-shot',approach:'提示只展示输入与答案，模型直接续写最终答案。',gap:'多步任务中间关系没有被显式示范。'},{name:'任务专用训练',approach:'收集推导数据并微调推理模型。',gap:'需要额外训练；论文想探索仅改提示能得到什么。'}],
  insight:'在示例的答案前写出中间推导，让模型在生成序列中分解任务。作者再检查规模效应、解释内容和外部计算器，避免把收益简单归因于“多写一些 token”。',
  method:[{title:'保持问题，改变示例形式',detail:'比较标准提示与带推导提示；算术主要使用作者写的少量固定示例。'},{title:'跨模型与任务验证',detail:'比较不同规模模型，在 GSM8K、SVAMP、ASDiv 等任务测准确率。'},{title:'分析错误与替代解释',detail:'消融推导形式，检查推导步骤正确但算术失误的情况，再用外部计算器作后处理对照。'}],
  experiments:[{title:'推导提示的收益依赖模型规模',question:'20B 和 540B 模型是否都会得到同样大的提升？',setup:'本地论文附录 B Table 1，GSM8K accuracy；分别比较每个模型自身的标准/CoT 提示，不把两个模型的差值当作纯参数消融。',control:'每个模型内部固定权重与评测集。',change:'示例中是否有推导；切换指标观察模型。',metrics:[{name:'UL2 20B GSM8K',unit:'%',better:'up'},{name:'PaLM 540B GSM8K',unit:'%',better:'up'}],rows:[{name:'标准提示',values:[4.1,17.9]},{name:'CoT 提示',values:[4.4,56.9]}],finding:'小模型这一项只有 0.3 个百分点变化，PaLM 增益很大。不能因为提示模板相同，就假定所有规模都能利用中间推导。',boundary:'两个模型并非只差参数量。采用本地表中的 56.9，不混用其他版本或不同提示方案的数值。',source:{pages:[3,5,6,20],label:'§3、消融讨论、附录 B Table 1'}},{title:'有推导也可能算错',question:'用计算器修正算术是否会让所有数据集得分升高？',setup:'同一附录 Table 1，PaLM 540B；计算器是对生成方程的后处理，不是重新训练模型。',control:'保持 CoT 模型与原先生成流程。',change:'对生成的算式使用外部计算器。',metrics:[{name:'GSM8K accuracy',unit:'%',better:'up'},{name:'ASDiv accuracy',unit:'%',better:'up'}],rows:[{name:'CoT',values:[56.9,73.9]},{name:'CoT + 外部计算器',values:[58.6,72.6]}],finding:'GSM8K 提高而 ASDiv 下降。算术、推导选择与答案解析共同影响结果，工具不会自动修正错误的任务分解。',boundary:'不是通用工具智能体实验；不能把计算器后处理的效果归于纯 CoT。',source:{pages:[20],label:'附录 B Table 1'}}],
  conclusion:'论文通过提示对照、规模对照和消融论证效果；中间文字提供可检查的解题痕迹，但并非对内部计算的完全解释。',openQuestion:'步骤写得很流畅但把“每盒三个”理解为“一共三个”，计算器能修复吗？'
 },
 '15':{
  problem:'越来越大的语言模型是否相对训练数据而言被训练得不够充分？在同一计算预算下，把资源移向更小模型和更多 token 会怎样？',
  previous:[{name:'主要增加参数的配置',approach:'依据早期缩放结论把新增算力更多投向 N。',gap:'训练 token 常没有同比增加，实际模型可能偏大、数据不足。'},{name:'从固定训练曲线外推',approach:'用一组有限配置推断最优规模。',gap:'学习率日程和训练长度的耦合会影响前沿估计，需要不同方法交叉验证。'}],
  insight:'不先假设模型越大越好，而是为每个计算预算扫描 N 和 D。用训练曲线包络、IsoFLOP 和参数化损失拟合三条路线估计最优分配，再训练大模型检验预测。',
  method:[{title:'在相同计算预算横向比较',detail:'增大 N 时减少 D，形成 IsoFLOP 曲线，寻找损失最低点。'},{title:'用三种估计互相核对',detail:'不是只凭一个拟合公式决定最优模型，比较分配指数的稳定性。'},{title:'训练 Chinchilla 验证预测',detail:'与 Gopher 类似预算，70B 参数配更多数据，评价下游任务。'}],
  experiments:[{title:'相同预算的分配指数发生了什么变化',question:'新结论把更多新增预算分给了参数还是数据？',setup:'Table 2，Nopt∝C^a、Dopt∝C^b；显示点估计，原文还报告 bootstrap 区间。',control:'统一问题为计算最优分配。',change:'旧估计与三种新估计方法；不是质量得分排名。',metrics:[{name:'参数指数 a',unit:'',better:'neutral'},{name:'数据指数 b',unit:'',better:'neutral'}],rows:[{name:'Kaplan 等',values:[.73,.27]},{name:'训练曲线包络',values:[.50,.50]},{name:'IsoFLOP',values:[.49,.51]},{name:'参数化损失拟合',values:[.46,.54]}],finding:'三条新路线都更接近均衡扩大 N/D，数据增长比早期配置更快。点估计并不完全相同，应保留估计不确定性。',boundary:'指数用于描述最优分配，不是精度；网页对称 toy loss 的最优 N=√(C/6) 不等于论文通用公式。',source:{pages:[5,6,7,8],label:'§3、Figure 3、Table 2'}},{title:'大模型实验证据',question:'训练预算相近，参数更少能否更好？',setup:'Table 6，MMLU 57 任务平均 5-shot accuracy；Gopher 280B 与 Chinchilla 70B。',control:'训练计算预算相近，使用相应基准的 5-shot 评价。',change:'参数减少、训练数据增多，并有论文说明的训练细节调整。',metrics:[{name:'MMLU accuracy',unit:'%',better:'up'}],rows:[{name:'Gopher 280B',values:[60.0]},{name:'Chinchilla 70B',values:[67.6]}],finding:'较小模型在此取得更好结果，支持重新分配预算。此本地文件摘要写 67.5，Table 6 与 §4.2.2 写 67.6，本课采用后者并保留差异说明。',boundary:'并非完全只改变 N/D 的单因素实验；不应忽略数据与其他训练条件。',source:{pages:[1,9,10,11],label:'§4.1–4.2、Table 6'}}],
  conclusion:'这是“先做小规模配置实验 → 拟合与交叉验证 → 大规模检验”的完整研究路径。核心是预算下的权衡，而不是更小模型天然优越。',openQuestion:'若推理次数非常多而训练只做一次，训练计算最优配置还一定是总成本最优吗？'
 },
 '18':{
  problem:'模型规模和能力不断增加，如何评估它在考试、代码和其他任务中的实际表现？报告没有公开完整架构，读者不能用猜测的层数解释所有变化。',
  previous:[{name:'GPT-3.5 与已有通用模型',approach:'在多项标准基准和任务上建立参照。',gap:'单一任务或考试成绩不能覆盖真实性、稳定性、校准和安全。'},{name:'任务专用最优系统',approach:'针对某个基准训练专用方法。',gap:'它们和通用 few-shot 模型的训练条件不同，胜负必须加以限定。'}],
  insight:'报告侧重可预测缩放与广泛评测证据。对未披露的实现保持未知，比画出一个没有来源的“GPT-4 网络”更符合科学阅读。',
  method:[{title:'明确公开与未公开内容',detail:'公开多模态输入/文本输出和部分训练/评价信息，但不披露精确架构、模型规模等细节。'},{title:'逐任务标注协议',detail:'每项指标连同 few-shot 数量和是否使用 CoT 一起读。'},{title:'保留例外与污染讨论',detail:'检查未超过专用系统的任务、数据重叠与现实失败，而不是只汇报最佳考试。'}],
  experiments:[{title:'通用模型升级的报告结果',question:'不同任务提升幅度一样吗？',setup:'Table 2：MMLU 为 5-shot，HumanEval 为 0-shot；同一列的原文协议。',control:'各基准内比较报告的 GPT-3.5 / GPT-4。',change:'完整系统不同；未公开细节不能用于单因素归因。',metrics:[{name:'MMLU',unit:'%',better:'up'},{name:'HumanEval',unit:'%',better:'up'}],rows:[{name:'GPT-3.5',values:[70.0,48.1]},{name:'GPT-4',values:[86.4,67.0]}],finding:'两项均改善，但不是证明某个未披露模块的消融；分数不能替代真实使用分布的评估。',boundary:'模型和基准均为该报告时点，不表示今天产品版本表现。',source:{pages:[2,7],label:'披露范围、Table 2'}},{title:'报告也有未超过的专用基线',question:'在 DROP 上，GPT-4 是否超过表中的专用最优系统？',setup:'Table 2，DROP F1；GPT-4 使用 3-shot，QDGAT 为任务专用参照。',control:'共同 DROP 指标。',change:'通用 few-shot 与任务专用系统的完整训练方式不同。',metrics:[{name:'DROP F1',unit:'',better:'up'}],rows:[{name:'GPT-4 3-shot',values:[80.9]},{name:'QDGAT 专用系统',values:[88.4]}],finding:'GPT-4 仍落后专用系统。通用性和某个任务最优不是同一个目标。',boundary:'不以这一个任务否定通用模型整体进展，也不把其他胜出任务推广到本项。',source:{pages:[7],label:'Table 2'}}],
  conclusion:'技术报告适合学习如何读证据与评测协议，不能当完整架构论文。效果差异可以观察，内部原因仍可能未知。',openQuestion:'看到分数提高，你还能提出哪些除架构之外的解释？需要什么额外披露才能区分？'
 },
 '19':{
  problem:'视觉编码器会表示图像，语言模型会回答文字，但“描述图片”与“根据图片遵循用户的问题”不同。连接两个模型之外，还缺怎样的训练信号？',
  previous:[{name:'视觉语言对齐或描述模型',approach:'把图像与文本表示对齐，或训练 caption 生成。',gap:'模型可能只说看到什么，而不回答用户真正提出的具体问题。'},{name:'纯文本指令微调',approach:'用对话示例训练按指令回答。',gap:'示例没有视觉条件，无法直接学会图像问答行为。'}],
  insight:'用文本形式的图像描述与目标框构造视觉指令数据，再将视觉特征投影到语言模型空间；实验要区分“已连接”与“经过指令微调”。',
  method:[{title:'构造不同指令数据',detail:'包含对话、详细描述和复杂推理，避免只有一种回答形式。'},{title:'两阶段训练',detail:'先冻结视觉与语言模型对齐投影，再固定视觉编码器进行视觉指令微调。原版连接器是线性投影。'},{title:'消融数据与评价方式',detail:'比较无指令微调、仅对话、完整数据；用 GPT-4 评分时注明其参考输入和局限。'}],
  experiments:[{title:'视觉连接之后，指令数据带来了什么',question:'只训练对话，是否足够覆盖详细描述和复杂推理？',setup:'Table 4，LLaVA-Bench (COCO)，相对 text-only GPT-4 参考回答的评分；参考 GPT-4 得到真实 captions/boxes，不是同一视觉输入协议。',control:'按照同一数据消融评估流程。',change:'视觉指令微调是否进行，以及使用哪些类型的数据。',metrics:[{name:'总体相对分数',unit:'分',better:'up'},{name:'详细描述相对分数',unit:'分',better:'up'}],rows:[{name:'无指令微调',values:[21.5,24.0]},{name:'仅对话数据',values:[73.8,59.8]},{name:'完整数据',values:[85.1,75.3]}],finding:'连接视觉模型不自动带来指令遵循；增加多类型指令对本基准有收益，详细描述对数据组成尤其敏感。',boundary:'这是模型裁判的相对分数，不是人工准确率；小基准和裁判偏差限制推广。网页训练阶段开关不执行真实微调。',source:{pages:[4,5,6,7],label:'§4、Table 3/4'}}],
  conclusion:'架构连接让信息能流动，指令数据让输出行为更符合任务；两个问题需要分别训练和验证。',openQuestion:'若模型始终描述整张图，不回答“哪里不合理”，应只加大投影层，还是检查训练任务？'
 },
 '21':{
  problem:'只在内部生成推导容易编造事实；只调用工具又可能缺少计划和恢复策略。推理和外部行动交替，能否兼顾任务分解与事实依据？',
  previous:[{name:'CoT：只有推导',approach:'生成中间步骤，再给出答案。',gap:'没有外部事实检查，错误知识可能沿着推导被放大。'},{name:'Act：只有行动与观察',approach:'调用搜索等环境接口，不显式展示计划。',gap:'在复杂任务中可能难以组织行动或从无用结果恢复。'}],
  insight:'让公开任务推理、行动、观察交替进入上下文。论文不仅看总分，还人工分析失败类型，并尝试把 ReAct 与 CoT-SC 组合。',
  method:[{title:'构造可比较提示',detail:'从完整 ReAct 轨迹移除不同部分，得到 Standard、CoT、Act 基线。'},{title:'在任务中交替行动和观察',detail:'计划指导搜索，搜索结果约束后续回答；失败后可以改写行动。'},{title:'分析互补而非宣布全面胜出',detail:'比较 HotpotQA/FEVER，再检查幻觉、检索失败和推理错误，尝试组合策略。'}],
  experiments:[{title:'换任务后排名会变',question:'ReAct 是否在两个问答/验证任务都超过 CoT？',setup:'Table 1，PaLM-540B prompting；HotpotQA 用 EM，FEVER 用 accuracy，指标不能直接混合平均。',control:'同一模型、各任务的评测协议；提示基线按原文构造。',change:'仅推理、仅行动、交替或组合策略。',metrics:[{name:'HotpotQA EM',unit:'%',better:'up'},{name:'FEVER accuracy',unit:'%',better:'up'}],rows:[{name:'CoT',values:[29.4,56.3]},{name:'Act',values:[25.7,58.9]},{name:'ReAct',values:[27.4,60.9]},{name:'ReAct → CoT-SC',values:[35.1,62.0]}],finding:'ReAct 在 FEVER 更强，HotpotQA 略低于 CoT；组合能提高结果，但引入额外采样与切换。',boundary:'不能把组合收益全归于单条 ReAct 轨迹。检索失败、推理错误和标签歧义仍会造成失败。',source:{pages:[5,6],label:'Table 1/2、§3.3'}}],
  conclusion:'这篇论文的进展来自互补性与失败分析：外部证据减少一些错误，但不能自动解决所有推理问题。',openQuestion:'检索没有结果时，应该把“未知”写入状态，还是继续沿最初猜测回答？'
 },
 '22':{
  problem:'语言模型容易在计算、检索和时效知识上犯错。工具有帮助，但如何让模型自己学会什么时候调用、调用什么、如何利用结果，而不手工标大量轨迹？',
  previous:[{name:'纯语言模型内部回答',approach:'依靠权重中的知识与生成能力。',gap:'算术或事实记忆可能不可靠。'},{name:'人工编写工具示范',approach:'明确标注调用位置与参数，监督模型模仿。',gap:'标注成本高，且很多候选调用并不真的有用。'}],
  insight:'先让模型提出候选调用，实际执行，再比较带结果是否降低后续文本预测损失。只把有用调用留进训练数据，构成自监督筛选。',
  method:[{title:'少量示例启动候选采样',detail:'在原始文本中采样 API 调用位置与参数。'},{title:'执行并按损失过滤',detail:'min(L无调用,L仅调用无结果)−L带结果达到阈值才保留，防止把调用标记本身的作用误算成工具结果作用。'},{title:'微调后禁用工具作消融',detail:'对照 GPT-J、继续文本训练、Toolformer disabled/enabled，以分开训练数据收益与调用收益。'}],
  experiments:[{title:'收益来自训练数据还是运行时工具',question:'禁用 API 后是否回到原始 GPT-J 的水平？',setup:'Table 4，数学基准 ASDiv/SVAMP/MAWPS；论文的结果评价规则见 §4.2。',control:'同一 Toolformer 可比较运行时 enabled/disabled；GPT-J 是基模型参照。',change:'继续训练与运行时工具可用性。',metrics:[{name:'ASDiv',unit:'%',better:'up'},{name:'SVAMP',unit:'%',better:'up'},{name:'MAWPS',unit:'%',better:'up'}],rows:[{name:'GPT-J',values:[7.5,5.2,9.9]},{name:'Toolformer 禁用工具',values:[14.8,6.3,15.0]},{name:'Toolformer 启用工具',values:[40.4,29.4,44.0]}],finding:'禁用工具仍有部分增益，启用又明显提高；说明“工具增强训练数据”与“真正执行工具”是不同贡献。',boundary:'disabled 不是未训练基线；不同任务的工具类型、调用限制和评价规则需分别看。网页可用本地替代语言模型比较对齐损失并执行受限计算器；不复现原文候选采样或微调。',source:{pages:[2,3,6],label:'过滤公式、§4.2、Table 4'}}],
  conclusion:'不是每一次工具调用都应保留。通过可测的后续预测改善筛选，再通过禁用消融解释来源，构成完整实验论证。',openQuestion:'某调用的结果很好，但仅有调用文本时损失已经一样低，还能认为外部返回值贡献很大吗？'
 },
 '25':{
  problem:'理解与生成往往使用不同架构和目标；文本自回归与图像扩散的组合也带来统一训练和后训练难题。离散掩码预测能否成为多模态共同框架？',
  previous:[{name:'自回归或 AR+Diffusion 混合',approach:'不同模态使用不同生成机制，组合完成多任务。',gap:'统一目标和跨任务推理并不自然得到。'},{name:'直接套用自回归 RL 公式',approach:'把生成序列的逐词概率连乘与策略优化迁移过来。',gap:'扩散 token 的掩码依赖与概率估计不同，不能直接照搬。'}],
  insight:'先统一离散 token 去噪，再通过混合长推导微调与 UniGRPO 后训练强化能力。是否每个阶段有用，要看逐阶段消融，而不是只比较最终模型。',
  method:[{title:'统一多模态掩码目标',detail:'文本与图像表示为离散 token，给定可见条件预测掩码位置。'},{title:'混合长 CoT 微调',detail:'把文本、视觉推理和生成相关数据结合，训练任务组织方式。'},{title:'扩散适配的 RL 与采样',detail:'UniGRPO 使用掩码概率估计和多种奖励；文本与图像还采用不同采样策略。'}],
  experiments:[{title:'逐阶段加入方法，哪些能力变化',question:'预训练后就有最终推理能力了吗？后两阶段作用一样大吗？',setup:'本地 PDF Table 5，按 Stage 1 → Mixed Long-CoT → UniGRPO 顺序的阶段消融；此表的数学列是 MATH500，不与 Table 4 的 MATH 表头混用。',control:'同一系统沿训练阶段比较，统一对应任务指标。',change:'依次增加混合长推导微调与 UniGRPO。',metrics:[{name:'GSM8K',unit:'%',better:'up'},{name:'MATH500',unit:'%',better:'up'},{name:'GeoQA',unit:'%',better:'up'},{name:'ImageReward',unit:'',better:'up'}],rows:[{name:'Stage 1 后',values:[17.4,4.2,8.3,.69]},{name:'+ Mixed Long-CoT',values:[65.2,26.5,15.9,.84]},{name:'+ UniGRPO',values:[73.4,36.0,21.0,1.15]}],finding:'两个阶段都带来该表中的增益，但幅度因任务而异；大部分 GSM8K 跃升发生在混合长推导阶段。',boundary:'顺序消融同时增加数据/训练，不能声称所有差值都来自某个公式本身；单条图像或回答示例也不能替代量化基准。',source:{pages:[6,7,8,12,15],label:'Algorithm 1、采样对照、Table 5'}}],
  conclusion:'统一架构只是起点，训练阶段、奖励与采样共同决定结果。比较论文时必须区分任务、指标和阶段，特别注意 MATH 与 MATH500。',openQuestion:'若要检验 UniGRPO 的收益来自算法而不是额外训练量，还缺少什么等预算对照？'
 }
}
