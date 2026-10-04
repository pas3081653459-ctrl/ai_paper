# Channel Lab · CNN 与 ResNet 特征学习网站

新增独立的中英文术语词典（`#/glossary`）与9主题数学学习室（`#/math`）：词义/语境/相关原文、符号与分步解释、可操作数值例子。课内通过折叠入口在新标签打开，保留原实验。配置不增加新依赖，详情见[TERMS_AND_MATH.md](TERMS_AND_MATH.md)。源码尚未构建或运行验收。

2026-10-04：全站学习阅读改版。24课增加独立操作导读与折叠解释，目录简化筛选；原文对照支持条件核查、可跳过预测、并排PDF与下载。24份PDF已随附于`frontend/public/papers`（约97MB），后续构建会复制至`dist/papers`，新前端原文链接不再依赖本机论文路径或PDF API。详情见[UX_READING_UPDATE.md](UX_READING_UPDATE.md)。本轮未编译或启动，旧dist尚未更新。

最新分类：**训练信号与推理对照**（InstructGPT、CoT、Toolformer、DeepSeek-R1）。匿名偏好复评、公开解答核验、实际计算器+对齐NLL瀑布图、真实候选采样与组内奖励；14/22/24复用本地GPT-2并明确标注替代，不训练。配置和限制见 [TRAINING_CATEGORY.md](TRAINING_CATEGORY.md)。仅源码及静态核对，未安装、下载、编译、运行或部署。

最新分类：**搜索与学习闭环**（AlphaGo、AlphaZero）。新增围棋提子/劫争练习、真实棋盘—树联动回放、井字棋UCT样本生成、真实训练档案与检查点评估。规则搜索明确无神经网络，真实成长记录需自行提供。无新增依赖，配置与边界见 [SEARCH_CATEGORY.md](SEARCH_CATEGORY.md)。仅源码和静态检查，未运行或部署。

最新分类增量：**语言上下文**（06 BERT、07 GPT-2、08 GPT-3、05 GPT-1）。逐段线索、续写编辑器、单因素示例卡对照、成对迁移档案采用独立交互；08 使用本地 GPT-2 替代模型，05 不执行训练。配置、数据边界及待验收见 [LANGUAGE_CATEGORY.md](LANGUAGE_CATEGORY.md)。只修改源码，未安装、下载、编译、执行或部署。

最新分类增量（2026-09-30）：**图片空间操作**，覆盖ViT照片干预、SAM提示分割、LLaVA回答取证。三课已有本地模型前后端源码、固定输入照片、导出/回放和学习笔记；模型输出仍需自行配置本地权重。依赖、文件目录及验收边界见 [IMAGE_CATEGORY.md](IMAGE_CATEGORY.md)。未安装、下载、编译、启动或部署。

当前先补齐的分类：**原文证据实验**（Scaling Laws、Chinchilla、LLaMA、GPT-4）。在论文实验室目录选择同名分类；四课已有无需权重的固定案例、交互反馈、学习笔记和导出。来源与配置见 [EVIDENCE_CATEGORY.md](EVIDENCE_CATEGORY.md)。仅完成源码，未编译或部署，旧dist不会自动显示修改。

最新源码：剩余18篇已切换到专用交互，BERT/GPT-2有可选本地推理，其余按论文采用原文证据或实际记录回放。记录格式见 [TRACE_FORMATS.md](TRACE_FORMATS.md)，依赖和模型配置见 [REMAINING_SETUP.md](REMAINING_SETUP.md)。尚未安装、下载或运行验收；回放课程还需准备可信固定示例，不代表所有原计划实验已经完成。

当前论文课程开发以 [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) 为准：先根据每篇论文的理解目标确定表达方式，首批制作 DDPM、CLIP、ReAct 的真实实验/可信回放样板。以下历史功能记录不代表这版计划已经实现。

DDPM 已接入独立页面与离线模型任务代码，配置见 [DDPM_SETUP.md](DDPM_SETUP.md)。后续已接入 CLIP 本地图文编码、ReAct 实际档案环境/可选本机模型、ViT 照片切块干预；配置和实现边界见 [REMAINING_SETUP.md](REMAINING_SETUP.md)，21 篇详细任务见 [REMAINING_PAPERS_PLAN.md](REMAINING_PAPERS_PLAN.md)。这些新增代码没有安装依赖、下载权重或运行验收，尚未部署。

Vue 3 / TypeScript / Vite 前端 + FastAPI / 基础 PyTorch 后端。本地上传照片后，对两个约两万参数的分类器同时推理，返回真实中间张量，不生成模拟特征图。

2026-09-29 论文课程更新：24 篇现在以各自案例作为入口。ResNet 看照片响应，Transformer 追踪词元变化；其余 22 篇分别使用搜索树、对局记录、文本/图文卡、像素与噪声、提示区域、工具环境、专家路由或实验曲线。具体设计见 [CASE_TEACHING_PLAN.md](CASE_TEACHING_PLAN.md)。新增场景是有明确边界的教学计算，不等于运行原论文模型。

这批改动尚未编译或浏览器验收，`dist` 未更新；启动既有生产构建不会自动显示这些源码修改。验收待办见 [VERIFICATION.md](VERIFICATION.md)。

## 启动

当前开发环境使用项目根目录的 `.venv`（Python 3.12），前端生产文件位于 `channel_lab/frontend/dist`。已有依赖、构建和权重时，从项目根目录执行：

```bash
./channel_lab/start.sh
```

打开 http://127.0.0.1:8000 。服务仅监听本机；不自动发布到公网。可用 `CHANNEL_LAB_PORT=8001 ./channel_lab/start.sh` 指定其他端口。

在新环境安装和构建：

```bash
python3.12 -m venv .venv
.venv/bin/python -m pip install -r channel_lab/requirements-lock.txt
cd channel_lab/frontend
npm ci
npm run build
cd ../..
./channel_lab/start.sh
```

`requirements-lock.txt` 是本次环境实测版本；其他系统若具体版本不可用可使用 `requirements.txt` 并自行验证。模型推理固定在 CPU，训练可选 CPU / CUDA / MPS。
开发界面使用 `npm run dev`，Vite 将 `/api` 代理到 8000 端口。前端不用远程字体、CDN 或外部图像资源。

## 如何使用

### Transformer 学习页

首页顶部「Transformer 原理」进入第二页，地址为 `http://127.0.0.1:8000/#/transformer`。使用 hash 路由，刷新无需额外后端路由；该页纯前端计算，不请求分类接口，不训练或下载模型。

七个步骤依次解释：文字与向量、Q/K/V、缩放分数与掩码、Softmax 与 Value 加权、多头合并、残差/LayerNorm/FFN、词表输出。支持选择注意力头与 Query 位置、切换猫狗输入和因果/双向掩码、调节注意力温度。矩阵和连线来自同一次固定参数的前向计算；页面还可展开三个教学 Python 文件的完整源码。

新增 3D 数据流交互区，包含 23 个计算节点：

- 网络图明确区分 Q/K/V 分支、V 到加权求和的路径及两条残差捷径；支持播放、暂停、前后单步、速度控制和直接定位节点。
- 每个节点显示输入来源、完整输出 shape、轴名称和标量数量。3D 张量使用 CSS perspective / preserve-3d 展示真实数值格子，可拖动旋转、滑块缩放、展开或叠放注意力头、恢复正面。
- 点击格子或使用坐标下拉框，查看原始值与计算来源；Q/K/V 投影、点积、Mask、Softmax、Value 加权、残差、归一化、FFN 等均有对应追踪。加法/线性组合提供逐项累加滑块。
- 选中位置与顶部 Query/Head 控件双向同步，节点与原有七章说明联动。移动端将张量和数值面板上下排列；键盘可操作按钮、滑块和坐标框。尊重减少动态效果偏好。

3D 中每个小块是一项标量，平面是 token×特征（注意力矩阵是 query×key）；多头张量按头分成多个平面。视觉厚度不代表额外维度。连线动画是前向计算顺序演示，不表示实际耗时、训练或标量以粒子形式移动。

可观察：因果模式下选 Query 0 或 1，将输入中的「猫」换为「狗」，这些较早位置的注意力输出不受未来词元影响；双向模式允许这些位置读取被替换的词元。固定数值仅解释运算，不代表训练得到的语言关系。

实现入口：`frontend/src/TransformerLesson.vue`；数值计算在 `transformerDemo.ts`，拓扑/数值来源在 `transformerTrace.ts`，交互区在 `components/TransformerExplorer.vue`，3D 张量在 `components/TensorVolume.vue`。二维表格仍由 `components/NumberMatrix.vue` 提供。示例使用单个 Pre-LN Block、正弦位置编码、C=4、H=2、FFN 宽度 8，无 bias/dropout；与 Python 学习模型的差异在页面内注明。学习页及本次 3D 更新只做静态检查，未构建、运行或进行浏览器验收；现有 dist 不会自动更新。

### CNN / ResNet 对比页

1. 上传 JPG/PNG/WebP（≤10 MB、≤2000 万像素），或点击官方测试集的猫狗样本。
2. 使用“本地训练权重”，点击开始实验。示例按钮会自动分析。图片经 EXIF 纠正、RGB 转换，直接缩放至 64×64，再除以 255。两模型输入一致。
3. 切换普通 CNN / 残差网络 / 并排对比。切换复用本次推理结果，不重复请求模型。
4. 左侧选择输入、Stem、各 Block 或池化。上方进一步切换 Conv、BN、ReLU 等节点，展示每个输出通道。点击通道放大。
5. 在 ResNet 的 Block 中选择“残差相加”：查看同一通道的主分支、捷径、相加结果、ReLU 输出，拖动滑块选择通道。
6. “逐通道缩放”各自调整亮度便于看纹理；“统一色标”对可见图组使用同一数值范围。含负数的图使用以零为中心的蓝/橙色标，ReLU 后用连续色标。残差四图使用统一的正负配色以便追踪相加。
7. 实验记录展示实际数据划分、训练历史、验证/测试指标。随机模式会明确标记未训练，不将它当成真实分类能力。

上传图片只在服务器内存和当前网页中处理，服务器不保存用户图片，也不将其传至第三方。示例图片是本地下载的公开数据集图片。
特征响应不等于注意力或因果解释；不同网络的同编号通道未必有相同语义。纯常数通道在独立缩放时是单色，使用共享色标可比较其绝对强度。

## 模型结构与对照条件

| 层 | 通道 / 尺寸 | 主分支 |
| --- | --- | --- |
| 输入 | 3 × 64 × 64 | RGB [0,1] |
| Stem | 8 × 64 × 64 | Conv3×3 → BN → ReLU |
| Block 1 | 8 × 64 × 64 | Conv3×3 → BN → ReLU → Conv3×3 → BN |
| Block 2 | 16 × 32 × 32 | 同上，第一层 stride=2 |
| Block 3 | 32 × 16 × 16 | 同上，第一层 stride=2 |
| 分类头 | 32 → 2 | 全局平均池化 → Linear |

普通 CNN 各块输出 `ReLU(F(x))`。ResNet 输出 `ReLU(F(x)+shortcut(x))`；第一个捷径为 Identity，后两个为 stride=2 的 Conv1×1+BN。
普通 CNN 18,954 个参数；ResNet 19,690 个参数。残差相加不增加通道，额外 736 个参数来自投影捷径。它们是自定义的小模型，不是标准 ResNet-18。
所有同名主分支初始参数明确复制以保持一致，训练数据顺序、翻转决策、损失、优化器和学习率计划相同。按物种分层划分；使用类别加权交叉熵应对猫狗数量差异。没有假设 ResNet 必然优于 CNN。

## 获取数据和重新训练

使用 Oxford-IIIT Pet，图片和标注压缩包共约 774 MiB，保留压缩包与解压内容约 1.6 GiB。只读取图片及物种标签；分割掩码不参与训练。
来源：https://www.robots.ox.ac.uk/~vgg/data/pets/ ，遵循官网数据许可（CC BY-SA 4.0；图片版权归原持有人）。

```bash
.venv/bin/python -m channel_lab.backend.prepare_data
.venv/bin/python -u -m channel_lab.backend.train --epochs 30 --device auto
```

训练会更新 `channel_lab/artifacts/cnn.pt`、`resnet.pt`、`metrics.json`、`splits.json` 和每模型训练历史。同目录权重会被覆盖，保留实验前可备份 artifacts。
官方 trainval 的 3,680 张图拆为 2,944 训练和 736 验证，官方 test 的 3,669 张图用于最终评估。测试集不参与权重选择。选择指标是验证集 balanced accuracy（猫狗召回率平均值），同时报告普通 accuracy 与混淆矩阵。

每模型 30 epochs；AdamW lr=0.002、weight_decay=1e-4；cosine 学习率计划；batch_size=64；seed=42；训练随机水平翻转；验证/测试无增强。
训练结果以实际生成的 `artifacts/metrics.json` 为准。CPU/GPU 算法差异可能导致复现实验存在数值差异。本网站只是一次小规模学习实验，不是模型排名或可靠的通用动物识别产品。

只重训一个模型可加 `--only cnn` 或 `--only resnet`；会保留另一个模型的结果，并检查实验配置一致。这是重新训练，不是从中断位置恢复优化器。

停止训练：在运行训练的终端按 `Ctrl+C`。若训练在后台，先执行 `pgrep -fl 'channel_lab.backend.train'` 核对进程，再执行 `kill -INT <训练进程PID>`。已保存的最佳权重会保留，但中断模型可能没有最终测试指标。停止网站则在网站服务终端按 `Ctrl+C`；网站本身不会启动训练。
首次训练的两个模型均完成后，API 才允许 trained 模式。无权重时不暗中回退到随机模型；用户可以显式选随机模式观察结构。

## 代码入口

- `backend/models.py`：共同结构、显式中间张量、参数对齐。
- `backend/data.py`：唯一预处理实现、官方数据划分。
- `backend/train.py`：从零训练、验证选模、最终测试。
- `backend/app.py`：上传校验、双模型推理、特征序列化、静态网站。
- `frontend/src/App.vue`：上传、网络流程、切换、解释和实验记录。
- `frontend/src/components/Heatmap.vue`：真实 float32 张量转 Canvas 热力图。

特征按 NCHW、小端 float32 编码为 base64，保留原始张量数值；前端解码后按通道绘图。服务器同时提供每层和每通道最小/最大/均值；不会只返回预着色 PNG 冒充原始数值。

## 验证

```bash
.venv/bin/python -m pytest channel_lab/tests -q
cd channel_lab/frontend && npm run build
```

测试覆盖相同初始化、真实前向与带 trace 前向一致、逐元素残差关系、投影分支反传、特征序列化数值、图片上传/非法文件/尺寸限制、官方测试集隔离与划分重现。
浏览器验收记录见 `VERIFICATION.md`。

## 论文实验室（新增源码，尚未运行验收）

入口 `#/papers`，单课 `#/papers/01` 等。原 CNN / ResNet 首页与 `#/transformer` 保留。

覆盖本地四个 `ai-papers-*` 文件夹的 24 篇论文，从 ResNet、Transformer、ViT 到 CLIP、LLaVA、DDPM、Mixtral、DeepSeek-R1 和 MMaDA。不是 24 个预训练大模型；每课围绕一个明确机制进行小规模数值或状态实验。

- 分类搜索、四条学习路线、前置课程、浏览器本地保存参数/步骤/已学标记。
- 逐步播放、跳转节点、真实依赖连线、完整 shape 与轴含义。
- 拖动旋转、展开/叠放平面、缩放，点击单格查看数值、公式和代码，支持输入对照与二维数值表。
- 注意力、残差、RMSNorm、SwiGLU、DDPM、CLIP、MoE 等关键位置有具体数字展开与贡献项。
- 每课练习、理解题、原论文页码链接、简化边界；实际 TypeScript 数值源码可展开阅读。
- `teaching_models.py` 补充原生 PyTorch 模块：残差块、多头/交叉注意力、TinyViT、LLaMA 核心算子、SparseMoE、视觉连接器和 CLIP/DDPM 运算。只定义，不执行训练。

论文默认从 `/Users/Zhuanz/论文` 读取，可设置 `CHANNEL_LAB_PAPER_ROOT` 指向含 `ai-papers-01` 到 `ai-papers-04` 的目录。`GET /api/papers/{id}` 只允许 `backend/paper_sources.json` 中的文件；没有下载、整目录静态发布或自动复制 PDF。其他机器无原文时，课程小实验仍可用，PDF 链接返回明确的 404。

本批遵守“不自行编译/执行”的要求，未运行构建、测试、训练、网站或浏览器验收。既有 `dist` 不包含本批源码，需获准后构建才会更新生产页面；历史构建成功不代表新增课程已验证。论文阅读依据见 [SOURCE_NOTES.md](papers/SOURCE_NOTES.md)，继续开发检查点见 [PAPER_PROGRESS.md](PAPER_PROGRESS.md)。

### 第二版：沿论文的研究过程学习

每篇新增六步阅读：**问题与已有方法 → 思路 → 实验设计 → 结果与反例 → 固定案例对照 → 有边界的结论**。当前 24 篇都有专门内容，共 28 组原文数值证据。读者可以选择指标和参照，先预测，再揭示原表数据；实验任务、控制变量、变化条件、指标与原文页码同时说明。

固定案例与原文结果分开：同一输入下比较因果/双向范围、局部/全局连接、残差参数化、损失权重、稀疏门控等；保留“新方法并非永远更好”的反例。原先的逐层网络实验折叠在“深入网络：逐层数据流、数学与代码”中，仍可展开操作。

研究内容在 `frontend/src/papers/research*.ts`，固定对照在 `comparisons.ts`；界面为 `PaperResearch.vue`、`PaperEvidence.vue`、`PaperComparison.vue`。浏览器单独保存阅读章节和当前论文实验选择。原文可按需在页内打开 PDF。仍然没有执行构建或浏览器验收，现有 dist 不会自动变更。

### 稀疏路由与多模态生成（23 / 25）

新增双语境专家路由比较、手动Top-2练习，以及去噪帧播放/固定帧比较/图像码与位置时间线。无需新增前端依赖。真实记录工具、可选Python环境、本地权重要求和接入说明见[SPARSE_CATEGORY.md](SPARSE_CATEGORY.md)。本批仅源码实现，未运行构建或真实模型，dist未更新。
