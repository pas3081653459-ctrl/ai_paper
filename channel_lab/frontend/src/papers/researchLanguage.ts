import type { Research } from './researchTypes'
export const languageResearch:Record<string,Research>={
 '04':{
  problem:'循环序列模型必须沿时间步逐个计算，长距离信息要经过很多次状态传递；卷积能并行，但远距离位置仍需多层才能相遇。翻译质量、训练并行性和依赖路径长度能否同时改善？',
  previous:[{name:'RNN/LSTM 编码器—解码器',approach:'循环状态处理源/目标序列，再用注意力读取源端信息。',gap:'注意力没有消除循环主干的串行依赖。'},{name:'卷积序列模型',approach:'局部卷积并行处理序列，堆叠层数扩大感受范围。',gap:'远距离位置不能在一个局部卷积层中直接交互。'}],
  insight:'让注意力本身承担序列混合，用位置编码补充顺序，再保留逐位置 FFN、残差和归一化。Table 1 先分析复杂度与路径，后面的翻译实验才检验实际效果。',
  method:[{title:'自注意力代替循环',detail:'Q/K 匹配决定信息来源，A×V 聚合；多头允许并行的投影子空间。'},{title:'保留生成约束',detail:'Decoder 自注意力遮住未来，交叉注意力从 Encoder 取 K/V；并不是一次知道未来答案。'},{title:'系统比较后做消融',detail:'先比 WMT 翻译 BLEU 与训练成本，再控制 base 设置修改头数、宽度、dropout 和位置编码。'}],
  experiments:[{title:'翻译系统对比',question:'相同 WMT14 EN-DE 测试集上，质量与计算成本应如何一起看？',setup:'newstest2014 EN-DE，Table 2 的单模型结果；训练成本使用论文估计 FLOPs。',control:'共同翻译测试集与 BLEU 口径。',change:'完整架构及训练配置不同，属于系统比较而非只换一个算子的消融。',metrics:[{name:'EN-DE BLEU',unit:'',better:'up'},{name:'训练计算量',unit:'×10¹⁸ FLOPs',better:'down'}],rows:[{name:'GNMT + RL',values:[24.6,23]},{name:'ConvS2S',values:[25.16,9.6]},{name:'Transformer base',values:[27.3,3.3]},{name:'Transformer big',values:[28.4,23]}],finding:'base 在该表中以较少估计计算获得较高 BLEU；big 用更多计算继续提高质量。应比较质量—成本组合，而非只看参数名。',boundary:'训练 FLOPs 不是端到端延迟；不同系统并非所有训练条件都相同。',source:{pages:[6,8],label:'Table 1/2'}},{title:'多头是不是越多越好',question:'固定总表示宽度后，把 8 头增加到 32 头会怎样？',setup:'Table 3(A)，EN-DE newstest2013 开发集；不要与前面测试集 BLEU 混合。',control:'保持 base 的主要设置，头数变化时同步改变每头维度。',change:'h=1/4/8/16/32。',metrics:[{name:'开发集 BLEU',unit:'',better:'up'}],rows:[{name:'1 头',values:[24.9]},{name:'4 头',values:[25.5]},{name:'8 头',values:[25.8]},{name:'16 头',values:[25.8]},{name:'32 头',values:[25.4]}],finding:'多头相对单头有收益，但不是无限增加；每头维度也在缩小。',boundary:'这里不是独立保持每头宽度的实验，不能把所有变化只解释为“头的数量”。',source:{pages:[9],label:'Table 3(A)'}}],
  conclusion:'Transformer 同时给出结构上的并行/短路径理由和翻译实验。结构复杂度是理论分析，BLEU 是实验观测，两者要分别阅读。',openQuestion:'自注意力路径短，是否意味着任意序列长度下计算与显存都更便宜？N×N 关系表有什么代价？'
 },
 '05':{
  problem:'很多理解任务标注少，但未标注文本多。如何让在文本上学到的表示迁移到不同任务，而不为每个数据集重造一个网络？',
  previous:[{name:'仅用任务标签训练',approach:'直接为分类、推理或问答优化监督目标。',gap:'小标注集不足以学习大量通用语言规律。'},{name:'词向量或 LSTM 迁移',approach:'先学习表示，再将其接入任务模型。',gap:'如何更充分复用上下文信息、减少任务专用结构仍需探索。'}],
  insight:'先用生成式语言目标学习 Transformer，再把任务输入整理成序列，添加很小的任务头进行监督微调。辅助语言损失可能保持预训练能力，但它是否总有益要单独验证。',
  method:[{title:'生成预训练',detail:'在无标注文本中预测后续词元，学习共享主干。'},{title:'输入格式与任务头',detail:'对句对、选择题等构造带分隔符的序列，使用最终位置表示预测标签。'},{title:'去掉组件看损失',detail:'分别去掉预训练、辅助 LM，或换成 LSTM；观察跨任务得分，不只展示完整模型。'}],
  experiments:[{title:'到底是预训练、架构还是辅助损失起作用',question:'完整方法是否每一列都最高？',setup:'Table 5 的任务消融；Avg 是异质任务指标的未加权均值，不能称为整体分类准确率。',control:'按照原文消融方案比较同批任务。',change:'取消预训练、取消辅助语言目标或改用 LSTM。',metrics:[{name:'跨任务 Avg score',unit:'分',better:'up'},{name:'QNLI accuracy',unit:'%',better:'up'}],rows:[{name:'无预训练 Transformer',values:[59.9,71.2]},{name:'LSTM + 辅助 LM',values:[69.1,81.1]},{name:'完整 Transformer + 辅助 LM',values:[74.7,88.1]},{name:'Transformer 无辅助 LM',values:[75.0,86.9]}],finding:'去掉预训练损失明显；去掉辅助 LM 后平均分略升但 QNLI 降低，因此辅助项效果依赖任务，不能给出“每个组件都必然提高一切”的结论。',boundary:'均值混合多种指标；不把一组消融的结论泛化到所有训练规模。网页任务头切换不等于已进行了预训练/微调。',source:{pages:[3,7,8],label:'§3、§5、Table 5'}}],
  conclusion:'这篇论文的迁移机制是“预训练后监督微调”，与 GPT-3 的仅在提示中放示例不同。',openQuestion:'如果取消辅助损失使平均分略升，你会删掉这项设计吗？需要先看哪些任务与实验误差？'
 },
 '06':{
  problem:'只从左到右预测的表示，在理解当前位置时看不到右侧上下文；简单拼接两个独立方向，也不等于每层联合读取两侧。可是直接双向看当前词又会泄露预测目标。',
  previous:[{name:'GPT 风格左到右预训练',approach:'用因果掩码避免看到后续词。',gap:'理解任务中的当前位置无法在每层利用右侧信息。'},{name:'两个单向模型拼接',approach:'分别学习左/右方向，然后拼接特征。',gap:'两个方向在预训练深层内部仍相互独立。'}],
  insight:'遮掉一部分输入词，只在被选位置预测原词，让其他可见词同时提供左右上下文。另用 NSP 学习句段关系，两部分贡献必须分开消融。',
  method:[{title:'构造 MLM 输入',detail:'选 15% 位置，使用 80/10/10 替换策略；[MASK] 是有效词元而非注意力禁用列。'},{title:'联合预训练并微调',detail:'MLM 与 NSP 共享主干，下游整体微调。'},{title:'逐项移除预训练目标',detail:'先保留双向性但移除 NSP，再用 LTR & No NSP；最后考察增加 BiLSTM 能否补救。'}],
  experiments:[{title:'将双向性与 NSP 的影响拆开',question:'SQuAD 的差距主要在去掉 NSP 时出现，还是改为 LTR 时出现？',setup:'Table 5，BERTBASE，开发集；原文说明使用相同预训练数据、微调流程与超参数。',control:'BASE 架构及主要训练配置。',change:'预训练目标和可见上下文；最后一行还增加微调阶段 BiLSTM。',metrics:[{name:'SQuAD F1',unit:'',better:'up'},{name:'QNLI accuracy',unit:'%',better:'up'}],rows:[{name:'BERTBASE',values:[88.5,88.4]},{name:'No NSP（仍双向）',values:[87.9,84.9]},{name:'LTR & No NSP',values:[77.8,84.3]},{name:'LTR & No NSP + BiLSTM',values:[84.9,84.1]}],finding:'SQuAD 在 LTR 设置大幅下降；增加 BiLSTM 可以回升但未达到双向预训练。QNLI 对 NSP 的移除更敏感，说明任务影响并不一致。',boundary:'BERT 与 LTR & No NSP 同时差两个因素，必须借中间 No NSP 行拆解；不能把两者全部差值只算给 NSP。',source:{pages:[4,8],label:'§3.1、§5.1、Table 5'}}],
  conclusion:'先解决目标泄露，才能利用双向上下文；再通过分层消融辨认是哪部分设计带来收益。',openQuestion:'把单向模型的末端加一个双向层，为什么不保证等同于每一层都双向预训练？'
 },
 '07':{
  problem:'为每个 NLP 任务收集标签并微调很昂贵。网页文本本来就包含问答、翻译、摘要等格式，语言建模能否在没有额外任务训练时利用这些规律？',
  previous:[{name:'每任务微调',approach:'在共享预训练模型上用任务标签更新参数。',gap:'部署新任务仍要数据与训练流程。'},{name:'固定语言建模评测',approach:'只评价下一词预测的困惑度。',gap:'难以说明模型是否能将任务描述作为上下文来完成新任务。'}],
  insight:'将任务、输入和输出统一看作文本条件概率。通过提示触发某种文本模式，再检查 zero-shot 迁移，而不是为每个任务单独训练一个头。',
  method:[{title:'扩大网页文本预训练',detail:'在 WebText 上训练不同规模的自回归模型。'},{title:'用格式诱导任务',detail:'摘要实验把 TL;DR: 放在文章之后，比较有无提示。'},{title:'保留强监督基线',detail:'零样本效果有所提升，不代表已经追上训练于该任务的最佳系统。'}],
  experiments:[{title:'一个摘要提示能改变多少',question:'TL;DR: 有用，是否就超过了专用摘要系统？',setup:'Table 4，CNN/Daily Mail 摘要，ROUGE F1；GPT-2 生成设置见 §3.6。',control:'GPT-2 两行使用同一预训练模型与任务，比较提示；监督模型单独作为能力参照。',change:'有无 TL;DR: 提示；另列不同训练条件的监督方法。',metrics:[{name:'ROUGE-1',unit:'',better:'up'},{name:'ROUGE 平均',unit:'',better:'up'}],rows:[{name:'GPT-2 无提示',values:[21.58,15.03]},{name:'GPT-2 TL;DR:',values:[29.34,21.40]},{name:'Bottom-Up（监督参照）',values:[41.22,32.75]}],finding:'同模型加提示明显改善，但仍落后专用监督系统；这支持文本任务条件化，不支持“提示已经替代所有训练”。',boundary:'ROUGE 不等同事实正确性；监督参照与 GPT-2 的训练条件不同。固定 token 实验只能演示输入变化，不能生成真实摘要。',source:{pages:[5,6],label:'Table 3/4、§3.6'}}],
  conclusion:'GPT-2 将“预训练得到的能力”与“如何通过文本触发任务”联系起来；zero-shot 描述的是评测适应方式，不是模型未经训练。',openQuestion:'提示提高 ROUGE，但摘要添加了原文没有的事实，还能说整体更好吗？'
 },
 '08':{
  problem:'模型通常通过梯度更新学习任务。是否可以把少量示例放进上下文，让一个固定模型适应任务格式，减少为每个任务微调的需求？',
  previous:[{name:'监督微调',approach:'用任务样本修改参数。',gap:'每个任务都有训练成本，且可能对特定数据集过拟合。'},{name:'GPT-2 zero-shot',approach:'只给任务提示，不提供演示。',gap:'任务格式和目标可能不够明确，较难任务表现仍有限。'}],
  insight:'比较 zero-shot、one-shot、few-shot，让示例作为条件输入而不是梯度训练数据；同时扩大模型，测试能力是否随规模变化。',
  method:[{title:'冻结评测模型参数',detail:'将演示和新问题拼到同一上下文，不运行优化器。'},{title:'多任务、多规模比较',detail:'分别考察语言、知识、推理、算术等，避免只挑少数成功提示。'},{title:'排查记忆与边界',detail:'检查污染/重叠，并分析复杂算术的失败，区分格式学习与可靠算法能力。'}],
  experiments:[{title:'更多示例能否解决更难的算术',question:'few-shot 的两位加法接近满分，五位加法也会一样吗？',setup:'Table 3.9，GPT-3 175B 的固定算术基准；比较三种上下文设置。',control:'同一 175B 模型与题型，评测时不更新权重。',change:'提示中示例数量；切换指标观察题目位数。',metrics:[{name:'两位加法准确率',unit:'%',better:'up'},{name:'五位加法准确率',unit:'%',better:'up'}],rows:[{name:'zero-shot',values:[76.9,0.7]},{name:'one-shot',values:[99.6,3.5]},{name:'few-shot',values:[100.0,9.3]}],finding:'示例在两种难度上都有帮助，但 few-shot 的成功不等于学会可任意长度外推的加法；五位题仍很弱。',boundary:'这里的 few-shot 不是固定“五个示例”的别名。不同任务可用不同数量，不能把读入示例描述成参数学习。',source:{pages:[3,4,23],label:'Figure 1.1、Table 3.9'}}],
  conclusion:'上下文学习体现为固定权重下条件分布变化。实验既显示能力，也显示能力随任务复杂度迅速下降的边界。',openQuestion:'两个示例让输入序列增长，但参数个数没变；哪些张量的形状和计算量会增加？'
 },
 '17':{
  problem:'只追求尽可能大的参数量，会带来昂贵推理。若训练更多 token、重视可公开获取的数据和实现效率，较小模型能否达到强性能？',
  previous:[{name:'继续扩大稠密模型',approach:'通过更多参数提升能力。',gap:'推理开销和部署门槛持续增加。'},{name:'训练计算最优分配',approach:'按训练预算选择模型/数据组合。',gap:'训练计算最优未必是大量重复推理场景的总成本最优。'}],
  insight:'把较小模型训练得更充分，并组合已知有效的结构与实现选择。RMSNorm、RoPE、SwiGLU 是方法组成，但论文系统成绩不能被当成每个组件独立因果贡献。',
  method:[{title:'制定公开数据混合',detail:'使用 CommonCrawl、C4、代码、百科、书籍等来源，报告数据配比。'},{title:'选择高效 Transformer',detail:'前置 RMSNorm、Q/K 上的 RoPE、SwiGLU 与高效训练实现。'},{title:'多尺寸、多任务评价',detail:'报告 7B/13B/33B/65B；与已有系统比较并保留表现不占优的任务。'}],
  experiments:[{title:'13B 能在哪些任务接近或超过 175B',question:'“较小但训练充分”意味着每一项都赢吗？',setup:'Table 3，zero-shot 常识推理；GPT-3 数字来自所引论文。',control:'使用相应基准的 zero-shot 指标。',change:'系统的参数、数据、训练与架构均不同，非单算子消融。',metrics:[{name:'HellaSwag accuracy',unit:'%',better:'up'},{name:'PIQA accuracy',unit:'%',better:'up'},{name:'ARC-c accuracy',unit:'%',better:'up'}],rows:[{name:'GPT-3 175B',values:[78.9,81.0,51.4]},{name:'LLaMA 13B',values:[79.2,80.1,52.7]}],finding:'13B 在这里的 HellaSwag/ARC-c 略高，PIQA 略低；小模型竞争力不等于全面支配。',boundary:'没有只切 RMSNorm 的对照，不能说这些分数证明 RMSNorm 优于 LayerNorm；网页归一化实验只解释运算差别。',source:{pages:[2,3,4],label:'§2、Table 3'}}],
  conclusion:'LLaMA 是数据、训练长度、结构和实现的系统组合；评价小模型价值需要同时看多个能力与推理成本。',openQuestion:'要证明 SwiGLU 而不是训练数据带来了增益，应增加怎样的控制实验？'
 },
 '23':{
  problem:'稠密模型每个 token 都执行全部 FFN，增加容量也增加每次推理的计算。能否存储更多专家参数，但每个 token 只激活其中少数？',
  previous:[{name:'稠密 FFN',approach:'全部 token 共用同一组前馈参数。',gap:'容量增长往往伴随活跃计算增长。'},{name:'早期稀疏 MoE',approach:'用路由器把 token 分配给专家。',gap:'模型效果、路由模式和实际部署代价仍需系统比较，不能只用“稀疏”宣称一切更快。'}],
  insight:'在 Mistral 主干的每层用八专家、每 token 选二的 FFN，区分总参数、活跃参数和硬件成本。',
  method:[{title:'按 token 路由',detail:'从八个分数选 Top-2，对入选者 Softmax，然后只执行这两名专家。'},{title:'合并而不拼接',detail:'专家输出按门控加权求和，恢复原隐藏维度。'},{title:'重评基准与分析路由',detail:'用统一评测管线比较稠密模型，并观察路由是否简单按语义领域分工。'}],
  experiments:[{title:'活跃参数与能力的权衡',question:'Mixtral 在每个选中的任务都超过 LLaMA 2 70B 吗？',setup:'Table 2，同一作者评测管线；MMLU 5-shot、HellaSwag 0-shot、HumanEval 0-shot。',control:'各任务的评测流程统一重跑。',change:'完整模型不同，活跃参数约 13B 对 70B；Mixtral 总参数不是 13B。',metrics:[{name:'MMLU',unit:'%',better:'up'},{name:'HellaSwag',unit:'%',better:'up'},{name:'HumanEval',unit:'%',better:'up'}],rows:[{name:'LLaMA 2 70B',values:[69.9,85.4,29.3]},{name:'Mixtral 8×7B',values:[70.6,84.4,40.2]}],finding:'MMLU 接近、代码更强，但这里 HellaSwag 更低。较少活跃参数下有竞争力，不等于所有任务必胜。',boundary:'活跃参数不是显存总占用，也不是硬件延迟；网页 dense/Top-2 对照只统计执行分支和数值汇合。',source:{pages:[2,3,4],label:'§2.1、§3、Table 2'}}],
  conclusion:'稀疏路由使容量与每 token 计算部分解耦，但要同时报告活跃量、总量、任务表现与实际系统开销。',openQuestion:'八个专家只用两个，为什么仍可能需要存储八个专家的权重？'
 }
}
