# 论文来源与教学取舍

本批资料来自用户提供的 `/Users/Zhuanz/论文/ai-papers-01` 到 `ai-papers-04`，共 24 个实际 PDF。编号沿用文件名，缺少 16、26；不把目录里的完整总清单当作文件存在的证明。

阅读范围：抽取 24 篇的文本，核对摘要与相关方法段落；没有逐篇通读全文或全部附录。另渲染并目视检查 ViT 第 3 页的 Figure 1、Mixtral 第 2 页的 Figure 1 / Top-2 公式。部分 PDF 提取有字体或 xref 警告，相关文本与这两张图可读。页码均为本地 PDF 从 1 开始的物理页码。

| ID | 论文 | PDF 页码 | 课程聚焦与边界 |
| --- | --- | --- | --- |
| 01 | ResNet | 2–3 | 加法而非拼接；空间变化用同 stride 投影。网页省略 BN，Python 块包含 BN。 |
| 02 | AlphaGo | 1、3 | 策略先验、价值与 rollout、搜索统计。根节点 bandit 不等于完整 MCTS。 |
| 03 | AlphaZero | 2–3 | 双头 (p,v)、访问分布 π、终局监督 z。不沿用 AlphaGo rollout 混合。 |
| 04 | Transformer | 3–4 | 目标端因果注意力和跨注意力；Q 来自目标、K/V 来自源；原文 Post-LN。 |
| 05 | GPT-1 | 3 | 生成预训练后监督微调；小实验只切输出头，不执行训练。 |
| 06 | BERT | 4 | 选中位置的 MLM 与 attention mask 不同；说明 15%、80/10/10 和 NSP。 |
| 07 | GPT-2 | 1–3 | 用任务文本作为上下文；zero-shot 不是未经预训练。 |
| 08 | GPT-3 | 3–4 | in-context 示例改变输入，不执行权重更新；小概率表不能证明模型能力。 |
| 09 | Scaling Laws | 1、3 | 经验幂律及条件。所有图中系数是自选教学常数。 |
| 10 | ViT | 3 | patch 化、投影、CLS、位置和全局关系表；网页只一个单头注意力子层。 |
| 11 | DDPM | 2、4 | 闭式加噪和反向均值；演示保留真实 ε，因此代数重建不是生成能力。 |
| 12 | CLIP | 2、5 | L2 归一化、批内图文矩阵、双向对比 CE，按原文伪代码区分转置方向。 |
| 13 | InstructGPT | 3、6 | SFT / RM / PPO 三阶段；只展示排序损失与 KL 约束目标，不执行 PPO。 |
| 14 | CoT | 1 | 中间推导示例是提示与输出组织方法；演示是公开算术脚本。 |
| 15 | Chinchilla | 1、4 | 固定算力下 N、D 权衡；C≈6ND 与对称教学损失不当作论文拟合结果。 |
| 17 | LLaMA | 3 | RMSNorm / Q,K 上的 RoPE / SwiGLU。网页隔离算子，Python 展示组合。 |
| 18 | GPT-4 报告 | 1–2 | 公开输入输出、未披露架构、如何读取评测。六条合成二分类记录并非 GPT-4 结果。 |
| 19 | LLaVA | 4–5 | 原版线性投影；第一阶段只训投影、第二阶段也训 LLM；不混用后续版本连接器。 |
| 20 | SAM | 4–5 | 图像编码复用、点提示、歧义多 mask。手工相似度替代 decoder，不冒充 SAM 推理。 |
| 21 | ReAct | 1、3 | 行动与环境观察循环、失败与重试；本地脚本，不调用外部工具。 |
| 22 | Toolformer | 2–3 | 比较 min(L无调用,L空结果) 与 L带结果，按改善筛选。网页只一个目标 token。 |
| 23 | Mixtral | 2–3 | 八选二、入选 logits Softmax、只执行选中专家。网页用普通 SiLU FFN；Python 用 SwiGLU。 |
| 24 | DeepSeek-R1 | 2–3、6 | 组内奖励归一化、裁剪 surrogate；省略 token 级细节与完整 KL，区分 R1 / R1-Zero。 |
| 25 | MMaDA | 2、4–6 | 响应掩码重建，可见条件与离散 token；不实现 UniGRPO 或图像 tokenizer。 |

## 代码与形状约定

- 网页计算：`frontend/src/papers/{vision,language,science,learning,multimodal,tools}.ts`；通用矩阵算子 `math.ts`；单格来源 `inspect.ts`。
- 网页注意力使用单头 D=4、固定正弦生成的参数；部分结构为便于比较统一简化。每课说明实际采用与省略的部分。
- `Stage.shape` 是逻辑数据形状；`slices` 是 3D 组件的二维切片容器。`[B,T]` 编号向量用单列切片展示，不额外宣称存在特征维。
- 非网络内容使用 `state` 或 `measurement` 类型，标注状态/统计量，不虚构通道、网络层或前向激活。
- 3D 厚度、连线动画用于理解，均不是额外张量维度、真实计算耗时或硬件调度。
- `teaching_models.py` 是独立原生 PyTorch 结构示例，仅定义模块与函数，无训练或下载入口。其初始化、维度、完整度与网页小实验不同，页面明确区分。
- 原有 Transformer 详解、TinyBERT / TinyGPT 和 CNN / ResNet 实际推理页继续保留。

## 原文入口

前端 `/api/papers/{id}#page={n}` 对应后端 `paper_sources.json` 的精确文件白名单。文件夹通过 `CHANNEL_LAB_PAPER_ROOT` 配置，默认上述本地路径；未复制 PDF 到前端，也未开放整个资料目录。此批只检查了路径与文件存在，尚未启动 API 验证 HTTP 或 PDF 阅读器行为。

## 第二版：按研究问题与实验论证重写

用户明确指出：只解释结构太笼统；每篇都要有问题、既有方法、思路、实验设计、结果和结论，并通过固定例子比较。为此添加 `researchTypes.ts` 与四个分组研究内容文件，24 篇均有完整研究路径，合计 28 组原文数值证据。旧 3D 网络实验保留为深入区。

本轮扩大阅读到相关结果表、实验协议、消融、失败分析和部分附录。以下是页面实际使用的主要数值出处；结果按本地 PDF 版本，不声称复现实验或逐字通读全部论文。

| 论文 | 本地 PDF 页 / 图表 | 特别需要保留的比较条件 |
| --- | --- | --- |
| ResNet | p5 Figure 4 / Table 2 | 原表 10-crop Top-1 error；曲线的 center-crop 口径不同；捷径不增加参数。 |
| AlphaGo | p2 策略比较，p4 Figure 4 | 24.2% / 57.0% 是落子预测，2μs / 3ms 是不同策略模块；不等于整局胜率。 |
| AlphaZero | p5 Table 1 | 每步 1 分钟；从 AlphaZero 视角合并执白/黑各 50 局；28 胜 72 平不等于全胜。 |
| Transformer | p8 Table 2，p9 Table 3(A) | test newstest2014 与 dev newstest2013 分开；改变头数也改变每头宽度。 |
| GPT-1 | p8 Table 5 | 异质指标平均分不是准确率；无辅助 LM 平均分 75.0，高于 full 的 74.7。 |
| BERT | p8 Table 5 | 用 No NSP 中间对照，避免同时改变双向性和 NSP 后将差异全部归到单个因素。 |
| GPT-2 | p6 Table 4 | 无提示 / TL;DR 的同模型比较，与监督 Bottom-Up 参照区别标注。 |
| GPT-3 | p23 Table 3.9 | 同一 175B；两位/五位加法；few-shot 不等于固定五个示例。 |
| Scaling Laws | p4 Equations 1.1–1.3 | 0.076、0.095、0.050 是不同受限区域的近似拟合指数，不是模型得分。 |
| ViT | p15 附录 Table 5 | 同为 /16，对比 ImageNet 与 ImageNet-21k 预训练，不混入主表最佳高分辨率数值。 |
| DDPM | p5 Table 1/2 | 固定方差、ε 预测的 L vs Lsimple；FID 与 NLL 上界可能反向变化。 |
| CLIP | p3 Figure 2，p6–7 §3.1.3 / Table 1 | Visual N-Grams vs CLIP 是系统比较；不能把全部差值归于对比目标。 |
| InstructGPT | p3 主要结果 | 85±3%、71±4% 为同方法对不同基线的偏好率；只绘中心值，正文保留原误差项。 |
| CoT | p20 附录 B Table 1 | 本地 PaLM 540B GSM8K CoT 为 56.9，不混入其他版本；外部计算器后处理单独列出。 |
| Chinchilla | p8 Table 2，p11 Table 6 | 分配指数不是性能分数；正文表为 67.6，摘要为 67.5，明确采用表值。 |
| LLaMA | p4 Table 3 | zero-shot 系统比较；13B 在部分任务领先、部分落后 GPT-3，不能作为 RMSNorm 单因素消融。 |
| GPT-4 | p7 Table 2 | MMLU 5-shot、HumanEval 0-shot；DROP 与专用 QDGAT 比较时说明协议差别。 |
| LLaVA | p7 Table 4 | 相对文本 GPT-4 的模型裁判分数；参考获得 captions/boxes，不是人工准确率。 |
| SAM | p11 Table 5 / Figure 11 | SAM 使用 ViTDet 框，零样本仅指分割模块；AP 排名与人评不完全相同。 |
| ReAct | p5 Table 1，p6 Table 2 | HotpotQA EM、FEVER Acc 分开；组合策略含额外采样，不是单次 ReAct 收益。 |
| Toolformer | p6 Table 4 | disabled 已经过训练，不是原始 GPT-J；对照可以区分部分数据收益与工具使用收益。 |
| Mixtral | p3 协议，p4 Table 2 | 统一重评管线；总参数与活跃参数不同；HellaSwag 并不领先 LLaMA 2 70B。 |
| DeepSeek-R1 | p1 版本，p4–5 结果 | 本地为 arXiv:2501.12948v2，2026-01-04；15.6→77.9 pass@1，86.7 为另加 self-consistency，不使用旧版 71.0。 |
| MMaDA | p15 Table 5 | 阶段消融为 MATH500，与 p12 Table 4 的 MATH 表头区别保留；增加阶段同时增加训练。 |

目视核对新增三页：ResNet p5（训练曲线与 Table 2）、CoT p20（附录 Table 1）、MMaDA p15（Table 5 与阶段图）。使用 PDF 页面渲染做只读核对，没有修改 PDF。原文阅读器现在可在结果面板内按需展开，也保留独立打开链接。

### 三种证据层级

1. **原论文结果回放**：人工核对并录入的已发表数值，可切换指标/参照条件、先预测再揭示。图表从零起点绘制，不补造训练曲线或统计显著性。
2. **固定小案例**：`comparisons.ts` 中的现场数学计算与确定性状态示例，用于理解一个环节；明确哪些是局部消融、哪些是改变输入/目标，不称作训练后模型成绩。
3. **原有网络实验**：下方折叠区提供任意参数调整、逐层张量、公式与学习代码。小模型不能替代论文中的大规模验证。

固定案例特意保留反例：ResNet 改为零目标时捷径并不天然占优；CoT 两边可给出相同错误答案，但逐步记录更便于定位；SAM 多候选的 oracle 集合覆盖不等于模型自动选择正确。不得将这些例子包装为论文原始模型输出。
