import type { Research } from './researchTypes'
export const visionResearch:Record<string,Research>={
 '01':{
  problem:'深度增加会扩大可表达的函数集合，为什么实际训练反而变差？作者先观察 CIFAR-10 的 20/56 层普通网络，再在 ImageNet 比较 18/34 层。关键不是只看验证误差：深模型连训练误差都更高，因此不能直接归因于过拟合。',
  previous:[{name:'继续堆叠普通卷积层',approach:'让每一组层直接拟合目标映射 H(x)。理论上多余的层可以学成恒等映射。',gap:'“存在一个不差的解”不代表优化器容易找到它，训练过程中出现退化。'},{name:'合适初始化与 BatchNorm',approach:'缓解信号与梯度在深层传播时的不稳定，使较深网络能够开始收敛。',gap:'论文的普通网络已使用 BN，仍然退化；不能把本文问题笼统说成梯度消失。'}],
  insight:'如果希望新加的层先保留输入，让它学习 H(x)−x 是否比重新学出 H(x)=x 更容易？这引出“预测改变量”的参数化，而不是增加一条会翻倍通道的拼接路径。',
  method:[{title:'先建立可比较的普通网络',detail:'使用相同卷积骨架和训练流程比较 18/34 层，先确认退化现象。'},{title:'每两层加入捷径',detail:'计算 ReLU(F(x)+x)。Table 2 的维度变化采用恒等捷径加零填充，不增加额外参数；后续才比较投影方案。'},{title:'检查更深是否终于有用',detail:'同时查看训练曲线与验证集误差；再推广到 bottleneck、更深模型和检测任务。'}],
  experiments:[{title:'深度 × 是否使用残差：四组对照',question:'34 层相对 18 层的变化，在普通网络和残差网络中是否一致？',setup:'ImageNet 验证集，Table 2 的 10-crop Top-1 error；Figure 4 是训练/验证过程，不能把图中中心裁剪曲线的端点当成表中 10-crop 数值。',control:'同深度的两种网络有相同骨架；本组残差捷径没有额外参数。',change:'两个因素：18/34 层、plain/ResNet。',metrics:[{name:'18 层 Top-1 error',unit:'%',better:'down'},{name:'34 层 Top-1 error',unit:'%',better:'down'}],rows:[{name:'普通网络',values:[27.94,28.54]},{name:'残差网络',values:[27.88,25.03]}],finding:'普通网络加深后误差上升 0.60 个百分点；残差网络加深后下降 2.85 个百分点。同为 34 层，残差减少 3.51 个百分点。训练曲线也改善，支持优化退化被缓解。',boundary:'这是特定训练条件的证据，不是任意深度一定更好；网页零残差例子只说明恒等映射的表示方式，不复现 ImageNet 训练。',source:{pages:[1,2,5],label:'Figure 1、Figure 4、Table 2'}}],
  conclusion:'论证链是“发现训练退化 → 改变映射参数化 → 同骨架对照 → 深度开始带来收益”。读论文时先辨认训练误差和验证误差，再解释捷径为何值得引入。',openQuestion:'如果只展示验证误差，能区分优化困难和过拟合吗？下一步应查看什么曲线？'
 },
 '10':{
  problem:'CNN 的局部性与平移共享很适合图像；直接把每个像素当 token 的全局注意力又太贵。作者想知道：是否可以少加图像专用结构，把标准 Transformer 扩展到大规模视觉学习？',
  previous:[{name:'ResNet / BiT',approach:'用卷积结构提供强图像归纳偏置，再进行大规模预训练与下游迁移。',gap:'结构为图像定制；能否由足够的数据学习部分偏置，需要实验而不是直觉判断。'},{name:'局部视觉注意力或 CNN 混合结构',approach:'限制注意力范围，或先用卷积提取特征，降低逐像素注意力成本。',gap:'仍包含较强的视觉特定设计，不直接回答标准 Transformer 是否足够。'}],
  insight:'把固定大小的图块展平成 token，再做线性投影，就能复用 Transformer。真正需要验证的不是“能运行”，而是它在不同数据规模下何时能与卷积竞争。',
  method:[{title:'图像转序列',detail:'patch → 线性嵌入 → CLS 与位置嵌入 → Encoder → 分类头。'},{title:'控制预训练数据规模',detail:'比较 ImageNet、ImageNet-21k、JFT-300M，观察大模型是否只是因为数据不足而失利。'},{title:'迁移到多个任务',detail:'报告微调精度、few-shot 迁移、计算开销；不只挑一个最佳 ImageNet 数值。'}],
  experiments:[{title:'数据规模改变“大模型是否更好”的结论',question:'同为 /16 patch，ViT-L 是否在两种数据量下都优于 ViT-B？',setup:'附录 Table 5：不同预训练数据后的 ImageNet 迁移精度；这里取 ImageNet 与 ImageNet-21k 两行，不混入主表高分辨率最佳结果。',control:'固定下游 ImageNet 与 /16 patch；各数据规模内比较 B/L。',change:'预训练数据规模与模型 B/L 的组合；不是纯粹单变量架构消融。',metrics:[{name:'ImageNet 预训练后精度',unit:'%',better:'up'},{name:'ImageNet-21k 预训练后精度',unit:'%',better:'up'}],rows:[{name:'ViT-B/16',values:[77.91,83.97]},{name:'ViT-L/16',values:[76.53,85.15]}],finding:'较少数据下 L 低于 B；更多预训练数据下 L 高于 B。这个交互效应比“Transformer 比 CNN 好”更接近论文的核心观察。',boundary:'这两组不能单独量化卷积与注意力的因果差异；完整 CNN 对照见 Figure 3/4。图块可视化仅展示连通范围与 token 成本，不产生分类精度。',source:{pages:[2,6,7,15],label:'§4.3、Figure 3/4、附录 Table 5'}}],
  conclusion:'ViT 的证据带有数据规模条件。先理解 patch 如何控制序列长度，再看归纳偏置在小数据与大数据设置下的不同作用。',openQuestion:'换成更多预训练数据后提升，能全部归因于多头注意力吗？还改变了哪些条件？'
 },
 '11':{
  problem:'扩散模型能定义逐步加噪和逆过程，但早期采样质量并不突出。一个可训练的似然目标是否也是最适合视觉采样质量的目标？作者把参数化与损失权重分开检验。',
  previous:[{name:'直接预测反向均值',approach:'用网络参数化反向高斯均值，并优化变分界。',gap:'均值预测、方差设置和损失权重会共同影响训练，不应只说“用了扩散所以更好”。'},{name:'GAN / 自回归 / score matching',approach:'分别通过对抗训练、逐像素概率或多噪声尺度的分数估计生成图像。',gap:'采样质量、似然和采样成本各有权衡；要使用同任务指标比较。'}],
  insight:'把逆过程均值改写为预测 ε，可以与多噪声尺度去噪联系起来。再移除原变分界中的时间步权重，得到更简单的噪声 MSE；这一改动是否有利必须靠消融验证。',
  method:[{title:'固定正向过程',detail:'使用预设 β 日程，随机采样时间步，直接构造 xₜ=√ᾱₜx₀+√(1−ᾱₜ)ε。'},{title:'分离参数化和目标',detail:'比较均值预测与 ε 预测，再比较变分目标 L 与 Lsimple。'},{title:'分开评估质量和似然',detail:'在无条件 CIFAR-10 报告 FID、IS 和 NLL；不要把它们当成同一个指标。'}],
  experiments:[{title:'同为噪声预测：更好的 FID 不等于更好的似然',question:'移除时间步权重后，FID 和 NLL 会一起改善吗？',setup:'Table 1/2 的无条件 CIFAR-10，固定各向同性方差；论文训练扩散步数 T=1000。NLL 报告的是变分上界。',control:'均采用 ε 参数化和固定方差。',change:'训练目标从变分 L 改为未加权噪声 MSE Lsimple。',metrics:[{name:'FID',unit:'',better:'down'},{name:'NLL 上界',unit:'bits/dim',better:'down'}],rows:[{name:'ε 预测 + L',values:[13.51,3.70]},{name:'ε 预测 + Lsimple',values:[3.17,3.75]}],finding:'FID 从 13.51 降到 3.17，但 NLL 上界从 3.70 变为 3.75。作者的改进更偏向样本质量，而不是所有指标同时最优。',boundary:'不能用知道真实噪声的网页重建代替生成评测；这里也不把不同条件生成器的 FID 混为同条件对照。',source:{pages:[4,5],label:'Algorithm 1/2、Table 1/2、Equation 14'}}],
  conclusion:'先做参数化消融，再做目标权重消融，才能解释最终选择。你看到的“更简单的损失”改变的是不同噪声时刻的训练重点。',openQuestion:'如果产品关心压缩而不是图像观感，应优先看 FID 还是似然？为什么两个目标可能冲突？'
 },
 '12':{
  problem:'封闭类别的监督分类依赖昂贵标签，迁移到新任务常需要重新标注。网页图文虽然丰富，却不是规范类别标签；怎样从自由文本中学到能零样本迁移的视觉表示？',
  previous:[{name:'监督 ImageNet 分类',approach:'用固定类别标签训练分类器，迁移时加新头或微调。',gap:'类别语义难以直接通过自然语言重新指定。'},{name:'预测整段图像描述',approach:'由图像逐词生成 caption；论文先尝试生成目标，也比较词袋预测。',gap:'描述包含许多视觉上不必要的表达细节，训练效率成为扩展瓶颈。'}],
  insight:'§2.3 描述的实验发现是这篇论文的重要环节：从生成文本改为词袋预测，再改为判断批内图文是否匹配，减少任务难度并提高零样本迁移效率。',
  method:[{title:'收集图文配对',detail:'构建大规模 WIT；监督来自自然文本，而不是仅 1000 个 ImageNet 标签。'},{title:'学习批内配对',detail:'两个编码器投影并归一化，N 张图对 N 段文字形成 N×N 分数；同时优化图找文和文找图。'},{title:'语言构造新分类器',detail:'把类别写成提示文本，编码后与图像比较；再在许多下游任务检验迁移。'}],
  experiments:[{title:'零样本迁移是否从概念验证走向实用',question:'大规模图文对齐后的 ImageNet 零样本结果，与早期自然语言监督方法有多大差别？',setup:'§3.1.3 / Table 1 的 ImageNet Top-1：Visual N-Grams 与最佳 CLIP；不使用 ImageNet 标签对 CLIP 进行该任务微调。',control:'共同评测 ImageNet 零样本分类。',change:'训练数据、编码器规模和目标均不同，属于系统比较。',metrics:[{name:'ImageNet Top-1',unit:'%',better:'up'}],rows:[{name:'Visual N-Grams',values:[11.5]},{name:'CLIP 最佳模型',values:[76.2]}],finding:'结果显示自然语言监督的可扩展潜力；不能把 64.7 个百分点的全部提升都归于对比损失一个改动。Figure 2 才是作者选择训练目标时的效率证据。',boundary:'§2.3 的 3×/4×是特定试验中的学习效率比较，不是任意硬件吞吐提速。零样本也不代表训练从未见过相关概念。',source:{pages:[3,4,6,7],label:'Figure 2、§2.3、Table 1'}}],
  conclusion:'研究路径是“开放监督目标 → 训练效率瓶颈 → 更容易的批内匹配任务 → 多任务零样本检验”。网页配对实验用于理解负样本和目标，不模拟语言能力。',openQuestion:'交换文本但不更新配对标签，会让损失怎样变化？低损失还能代表正确监督吗？'
 },
 '20':{
  problem:'分割通常为某类目标和特定数据集训练。一个点可能指整个人、衣服或局部部件；若只要求模型输出一个确定 mask，歧义本身就会制造失败。',
  previous:[{name:'任务专用监督分割',approach:'在指定类别与标注风格下优化实例或语义分割指标。',gap:'换数据集、目标粒度或提示方式时需要适配。'},{name:'交互式分割',approach:'用户提供点或框，模型返回目标区域。',gap:'有效提示仍可能对应多个合理对象尺度；数据覆盖范围也有限。'}],
  insight:'把分割定义成可提示任务；通过模型辅助标注建立数据引擎，再用多候选输出处理歧义。需要验证的是跨数据零样本能力，而不是只赢一个熟悉数据集。',
  method:[{title:'复用图像嵌入',detail:'重型图像编码器只处理图像，轻型提示编码器和 mask decoder 响应不同点/框。'},{title:'允许多个合理答案',detail:'输出候选 mask 与质量预测，训练与评测都要考虑单点歧义。'},{title:'跨任务检验',detail:'从单点分割到边缘、候选区域和实例分割，再消融数据引擎与模型规模。'}],
  experiments:[{title:'零样本通用性不等于专用 AP 最优',question:'SAM 与监督 ViTDet 在 COCO/LVIS 上的结论一样吗？',setup:'Table 5：SAM 使用 ViTDet 提供的框，只把分割模块做零样本迁移；比较 COCO 与 LVIS v1 的 mask AP。',control:'SAM 的框来自 ViTDet，避免误把定位改进算到分割上。',change:'分割模块与训练数据/监督设置不同。',metrics:[{name:'COCO mask AP',unit:'',better:'up'},{name:'LVIS v1 mask AP',unit:'',better:'up'}],rows:[{name:'监督 ViTDet-H',values:[51.0,46.6]},{name:'零样本 SAM',values:[46.5,44.7]}],finding:'SAM 的 AP 在两者都更低，但 LVIS 差距较小；同页人评还给出不同的质量排序。这说明标注风格、指标与通用性不能混成一句“更好”。',boundary:'不是全系统零样本检测：输入框由已训练检测器提供。网页主案例使用配置后的本地SAM或真实记录，不重新测量本表AP；独立算子示例另有简化。',source:{pages:[4,5,8,11],label:'Figure 3/4、§7.1、Table 5、Figure 11'}}],
  conclusion:'SAM 的主要贡献包含任务定义、模型与数据引擎。比较时先问“给了什么提示、对什么标注计算什么指标”，再讨论效果。',openQuestion:'一个点同时落在衣服和人体内，输出衣服算错吗？如果标准答案只标人体，该如何解释 IoU？'
 }
}
