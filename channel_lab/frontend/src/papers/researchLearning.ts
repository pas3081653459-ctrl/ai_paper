import type { Research } from './researchTypes'
export const learningResearch:Record<string,Research>={
 '02':{
  problem:'围棋搜索树太宽太深；穷举不可行，简单局面评价也困难。作者要同时减少搜索的宽度和深度：哪些走法值得看，搜索停止时局面值多少？',
  previous:[{name:'Monte Carlo tree search 与快速 rollout',approach:'用大量模拟结果估计行动质量，平衡探索与利用。',gap:'单次模拟便宜但噪声大，候选太多会浪费搜索预算。'},{name:'监督模仿人类落子',approach:'从棋谱训练策略网络预测高手会走哪里。',gap:'落子预测准确率并不等于最终胜率，单步模仿也没有前瞻搜索。'}],
  insight:'策略提供先验以缩小宽度，价值网络估计未来结果以缩短深度，再把两者与 rollout 放进搜索。这是学习和搜索的组合，不能只画成一个输出落子的 CNN。',
  method:[{title:'先模仿再追求获胜',detail:'SL 策略从人类棋谱训练，RL 策略通过自我对弈优化结果；两者评估目标不同。'},{title:'学习局面价值',detail:'用自我对弈位置与结果训练价值网络，避免把同一对局高度相关的所有状态当独立样本。'},{title:'组合并消融搜索组件',detail:'MCTS 用策略先验、价值/rollout 评价和回传访问统计，Figure 4 比较组件组合与计算扩展。'}],
  experiments:[{title:'快策略与准策略各自做什么',question:'最会预测高手落子的网络，一定最适合大量 rollout 吗？',setup:'第 2 页的策略实验：KGS 保留集上的专家落子预测；计时为论文当时实现，不是本机测速。',control:'同一论文分别报告用于主搜索策略与快速 rollout 的模块。',change:'网络结构/特征与速度精度取舍。',metrics:[{name:'专家落子预测准确率',unit:'%',better:'up'},{name:'一次动作选择耗时',unit:'μs',better:'down'}],rows:[{name:'快速 rollout 策略',values:[24.2,2]},{name:'SL 策略网络（全特征）',values:[57.0,3000]}],finding:'SL 网络更准确却贵得多；rollout 不必复制同样昂贵的网络。论文另报告 RL 策略对 SL 策略胜率超过 80%，提醒读者模仿准确率与获胜不是一回事。',boundary:'速度来自不同实现/模块，不能用这两行量化最终 AlphaGo 加速；总系统胜率 99.8% 是对其评测对手集合，非对任意棋手。',source:{pages:[1,2,4],label:'策略训练段、Figure 2/4'}}],
  conclusion:'有效方案来自分工与组合：策略引导哪里搜，价值和 rollout 评估搜到的状态，访问统计决定行动。组件指标与整局胜率必须区分。',openQuestion:'若先验最喜欢 A，但搜索发现 B 的长期回报更高，应相信一次策略输出还是更充分的搜索统计？'
 },
 '03':{
  problem:'国际象棋与将棋强程序依赖大量领域评价与搜索工程。一个从规则开始、没有人类棋谱的学习流程，能否跨棋类达到顶尖水平？',
  previous:[{name:'Stockfish / Elmo',approach:'使用高度优化的搜索和领域知识评价。',gap:'系统设计与某一棋类紧密结合。'},{name:'AlphaGo / AlphaGo Zero',approach:'学习与搜索、自我对弈已在围棋证明有效。',gap:'围棋特有对称性等设计未必适用于不对称规则的棋类，不能原样照搬。'}],
  insight:'让一个网络同时预测策略 p 和价值 v，用搜索产生更强的行动目标 π，再用终局 z 监督价值。搜索不是训练后的附加装饰，也是训练数据生成器。',
  method:[{title:'从当前网络进行自我对弈',detail:'给定局面，MCTS 利用 p/v；根据访问统计选择行动。'},{title:'用搜索与终局训练',detail:'存储 (s,π,z)，优化策略交叉熵和价值误差，不需要人工给每步最优动作。'},{title:'跨棋类外部检验',detail:'保持通用算法，对国际象棋、将棋、围棋分别评测，并报告思考时间和对手配置。'}],
  experiments:[{title:'读懂 100 局对局结果',question:'“没有输给 Stockfish”是否等于每局都赢？',setup:'本地 2017 版论文 Table 1，每步 1 分钟；按 AlphaZero 视角把执白与执黑各 50 局合并。',control:'各场 100 局对抗与规定思考时间；不同棋类的结果不可当同难度任务排名。',change:'对手与棋类；训练从规则和自我对弈出发。',metrics:[{name:'AlphaZero 胜局',unit:'局',better:'neutral'},{name:'平局',unit:'局',better:'neutral'},{name:'负局',unit:'局',better:'neutral'}],rows:[{name:'国际象棋 vs Stockfish',values:[28,72,0]},{name:'将棋 vs Elmo',values:[90,2,8]},{name:'围棋 vs AG0 3-day',values:[60,0,40]}],finding:'国际象棋结果为 28 胜、72 平、0 负；结果有力，但不是 100% 获胜。三类任务支持方法的跨棋类适用性。',boundary:'本文是特定版本/硬件/时间设置，不代表后续版本之间的永久强弱。表中数字是两种执棋颜色合计，不能混淆 AlphaZero 视角。',source:{pages:[2,3,4,5],label:'Equation 1、Figure 1、Table 1'}}],
  conclusion:'自我对弈闭环让网络学习搜索后的策略分布与终局价值；通用性需要跨任务验证，而不是只在围棋上换名字。',openQuestion:'π 已经来自网络引导的搜索，为什么不直接把网络自己的 p 当作训练标签？'
 },
 '13':{
  problem:'大语言模型擅长续写，不代表会按用户意图作答。仅增大模型能否解决遵循指令、编造信息与不合适回答的问题？',
  previous:[{name:'预训练下一词目标',approach:'学习互联网文本的条件分布。',gap:'文本中常见的续写不一定是用户最想要的回答。'},{name:'提示和监督示范',approach:'few-shot 提示或 SFT 演示期望回答。',gap:'示范难以覆盖所有输出；人类更容易比较候选回答而非写出完美答案。'}],
  insight:'把人类偏好转为可优化信号：先学示范，再学排序奖励，最后用奖励调整策略；同时限制离参考策略过远。',
  method:[{title:'SFT 建立指令回答基础',detail:'标注者为提示写示范回答，用监督目标微调 GPT-3。'},{title:'奖励模型学习比较',detail:'对同一提示的候选回答排序，训练 r(chosen)>r(rejected)。'},{title:'PPO 与人类盲评',detail:'用奖励及 KL 约束优化，再在人类评估上比较，而不是只报告训练奖励升高。'}],
  experiments:[{title:'提示基线改变时，偏好优势还在吗',question:'给 GPT-3 添加 few-shot 提示后，InstructGPT 的领先幅度是否相同？',setup:'第 3 页主要结果：175B InstructGPT 相对 175B GPT-3 的标注者偏好率。原文给出 85±3% 与 71±4%；图中展示中心值。',control:'同为 175B，面向论文测试提示与标注者偏好评价。',change:'对照 GPT-3 是否使用 few-shot 指令提示。',metrics:[{name:'InstructGPT 被偏好比例',unit:'%',better:'up'}],rows:[{name:'对照普通 GPT-3',values:[85]},{name:'对照 few-shot GPT-3',values:[71]}],finding:'强化对照提示后优势减小，但仍超过一半。选择一个过弱基线会夸大效果；偏好不是客观事实正确率。',boundary:'两行是同一方法对不同对照的胜率，不能当两个模型准确率；误差项按原文保留，不擅自解释成标准差或置信区间。',source:{pages:[3,6,7],label:'主要结果、§3.1、数据划分'}}],
  conclusion:'“更符合指令”需要相应数据、目标与评价。奖励模型高分只是代理，最终还需人的偏好和事实/安全等独立指标。',openQuestion:'如果优化后的模型只会讨好奖励模型，奖励升高是否足以证明用户真的更满意？'
 },
 '24':{
  problem:'复杂推理往往依赖大量人工或模型产生的示范。若只提供可验证的结果奖励、不先监督具体推导步骤，能否让模型学到更有效的推理行为？',
  previous:[{name:'推理轨迹监督微调',approach:'模仿事先写好的长推导。',gap:'训练信号依赖高质量轨迹的来源与覆盖范围。'},{name:'奖励优化与策略梯度',approach:'按结果奖励提高成功回答概率。',gap:'需要稳定估计相对好坏，也可能出现语言混杂、可读性和奖励利用问题。'}],
  insight:'先用 R1-Zero 探索纯 RL 的潜力，再针对可读性等问题构建带冷启动、多阶段训练的 R1。不能把两条路径合并成“R1 完全没有监督数据”。',
  method:[{title:'同题采样一组回答',detail:'通过准确性/格式等奖励评价，再用组内基线形成相对优势，GRPO 不需要另一个同规模 critic。'},{title:'跟踪训练过程而非只看终点',detail:'观察 AIME pass@1、回答长度和行为示例；长文本增加与得分一起发生不等于长度是唯一原因。'},{title:'修补 RL-only 的不足',detail:'R1 加冷启动数据和后续训练阶段，兼顾推理与可读性；这是由实验观察推动方案发展的例子。'}],
  experiments:[{title:'训练收益与测试时采样收益分开看',question:'最后一行高于中间一行，是否全是训练得到的提升？',setup:'用户本地 PDF 是 arXiv:2501.12948v2（2026-01-04），第 4–5 页 R1-Zero AIME 2024 结果；使用该版本数值，不混用旧版 71.0%。',control:'同一基准；前两行对照 RL 训练前后平均 pass@1。',change:'训练阶段；最后一行另加 self-consistency，改变了推理采样协议。',metrics:[{name:'AIME 2024 成功比例',unit:'%',better:'up'}],rows:[{name:'RL 初始 pass@1',values:[15.6]},{name:'RL 后 pass@1',values:[77.9]},{name:'RL 后 + self-consistency',values:[86.7]}],finding:'前两行支持 RL 带来的收益；第三行包含测试时多个回答的汇总，不能全部归为训练增益。',boundary:'本地版本和评测协议必须明确；单条“反思”示例不证明所有反思都有效，网页组内奖励也不是完整 RL 训练。',source:{pages:[1,3,4,5,6],label:'版本标记、§2.2–2.3、Figure 1、Table 2'}}],
  conclusion:'研究中先探索再修正很重要：R1-Zero 展示潜力与问题，R1 增加冷启动等阶段。结果、行为观察与因果解释应分别标注。',openQuestion:'四条回答都得到相同奖励时，组内标准化还能告诉模型该偏向哪一条吗？'
 }
}
