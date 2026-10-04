# 语言上下文：BERT / GPT-2 / GPT-3 / GPT-1

2026-09-30。本类别完成源码增量与人工静态检查；**未安装依赖、下载权重、编译、执行程序、推理、训练、启动服务或浏览器验收，dist 未更新。** 以下配置命令供用户以后手动执行，本轮没有执行。代码存在不代表模型运行成功。

## 入口与四种理解方式

论文实验室 `#/papers` → **语言上下文**，课内可互相跳转。

| 课 | 不配置模型也可以做 | 配置后 / 有真实记录后 |
|---|---|---|
| 06 BERT | 选择两组歧义句、逐段开放右文、编辑三个实际输入 | 同权重三条件 MLM；追踪同一候选概率，查看实际 WordPiece、ID、MASK 位置、attention_mask；导出记录 |
| 07 GPT-2 | 两篇固定文章、三个后缀、长度设置 | 三条件独立贪心推理；文章/后缀/新输出分色；逐 token 前进/后退；原文核查标注；导出记录 |
| 08 GPT-3 | 移动示例卡、改数量、重命名标签、制造一条错误示例；完整提示预览 | **GPT-2 架构替代模型**实际运行两条件 × 四题；盲揭示输出，混淆表、格式失败与完整 prompt；导出记录 |
| 05 GPT-1 | 原文 Table 5 指标切换、预测再揭示、辅助 LM 差值比较 | 外部成对训练记录的预算/seed/step 选择、观测点联动错例、控制条件核查与逐 seed 改善；**没有训练接口** |

四课均有学习问题、反馈、浏览器笔记、JSON 导出和重做。笔记只保存读者判断，不保存上传模型轨迹。07 核查标注是当前结果的暂存，重要内容可抄入课末笔记；更换输入即清除，避免标到新结果上。

### BERT 的控制变量

固定前缀，输入为：无右文、开放的 A 右文、开放的 B 右文。右文词卡按空白分段，只用于阅读；结果中的 tokenizer WordPiece 才是实际词元。点击词卡会开放它之前的所有片段。不是把隐藏内容作为 padding 传入。

`p(v | 输入) = softmax(logits[0, mask_index, :])[v]`。完整词表 softmax 后取 top8；top8 之外的词未记录概率，页面明确显示“未进入 top-k”，不填零。不保证预设句子一定产生期望词，也不将候选变化伪装成注意力归因。

要求恰好一个 `[MASK]`；无 MASK 或多 MASK 均报错。无 padding 时 attention_mask 全 1，[MASK] 自身也是有效词元。删除右文改变序列长度、[SEP] 位置；这不是论文的 LTR 预训练消融。80/10/10 属于预训练目标，不能当作推理随机替换。

### GPT-2 的连续文本

两段本站编写英语输入，用换行、`TL;DR:`、固定问答后缀构造三条前缀；每条单独清空 KV 缓存。每步执行模型前向 → 完整词表 softmax → argmax → 追加 ID。遇到 EOS 或达到用户设置（1–128，页面 8–128）结束。不训练，不使用 pipeline，不自动截断输入。

逐 token 展示是推理完成后的回放，不是流式推理。单 token 解码片段可能有不完整 UTF-8 字符，最终完整 `output` 单独提供。空 output 合法，不能替换成编写好的答案。核查标注由读者作出；token 概率不是事实正确率。

### GPT-3 的示例对照（明确采用替代模型）

`backend/context_cases.json` 是本站手写的 4 张带标签示例卡、4 道测试输入及评分目标，版本 `sentiment-cards-v1`。不是训练数据集下载，不是 GPT-3 论文基准，也没有预置模型输出。

- 数量：零样本 vs 前 1/2/4 张卡。
- 顺序：四张不变，通过上移/下移改变顺序；可以恢复原顺序做无变化对照。
- 标签改名：positive/negative → A/B，任务说明与示例同步改，目标通过同一映射评分。
- 错误示例：固定四张，反转其中一张标签。

页面每次只开放一种因素。API 接收两组卡片 ID 和干预标记，由后端构造 prompt；测试目标没有进入提示拼接函数。模型仍能看到任务说明和**示例**标签，这是设计要求，不是测试答案泄漏。没有发送外部 API。

数量对照采用固定前缀子集，1张卡只有正例，2/4张才正负平衡；观察到的差异同时涉及具体示例内容和标签覆盖，不是脱离示例选择的纯数量因果结论。

每条件四次，最多 12 新 token，贪心解码，条件之间不共享 cache。取 output 去除首尾空白后的首行，要求整行精确等于映射标签；多余解释、大小写变化、标点或空答案记 other。混淆表行是目标类别，列是 positive/negative/other。导入时页面独立重算分数，不相信记录自报的 correct。四题成绩仅用于观察此次干预；GPT-2 失败不能反驳 GPT-3 原文结论，成功也不能替代其成绩。

### GPT-1 的成对记录

原文证据复用仓库已核查 `researchLanguage.ts` Table 5，未新增论文数值。平均分和 QNLI 分开，辅助 LM 去留效果方向不同；这张表并不是少标签学习曲线。

新版 `paired-transfer-v2` 要求声明架构、预训练来源、指标方向/单位、划分；每次 run 提供 seed、标签预算、标签子集 hash、优化设置 hash、总步数及真实观测点。每个点可以附当时的错例，空数组表示未提供而非零错误。

只有同预算/seed、相同标签子集/优化设置/总步数且 random/pretrained 都有同一 step 才计算配对差值：越高越好用 pretrained−random，越低越好反过来。列出各 seed 与均值，不伪造置信区间。曲线虚线仅连接观测点，点击或下拉只选择实际 step。缺点不插值。主页面保留旧版格式的独立只读查看区，不把旧记录纳入新统计。记录哈希只是来源声明，不能验证其真实性。

## 依赖与部署

**不增加 npm 包、数据库、外部服务或新的运行进程管理器。** Vue/SVG/原生文本组件沿用现有网站。06/07/08 使用已有 FastAPI 的 `/api/experiments/language`，共用 CLIP worker 生命周期及跨进程模型锁。

Python 可选依赖使用 `requirements-language.txt` → `requirements-clip.txt`，候选固定 `transformers==4.55.4`、`huggingface-hub>=0.34,<1.0`、`safetensors>=0.4.3,<0.7`，还需项目基础 `requirements.txt`（PyTorch/FastAPI 等）。这是适配目标版本，不是本机测试通过的锁文件。torch float32，设备 cpu / mps / cuda；本类没有量化、分片权重、自动设备分配或远程代码路径。

以后需要配置时，从仓库根目录手动执行（本轮未执行）：

```bash
source .venv/bin/activate
pip install -r channel_lab/requirements.txt -r channel_lab/requirements-language.txt
```

自行准备同一 revision 的本地模型/分词文件，不要创建假权重占位文件，不要把其他模型架构目录填入。参考模型类型可查 [BERT 官方文档](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/bert) 与 [GPT-2 官方文档](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/gpt2)。这里只核对了接口文档，没有下载或逐项确认某个远程仓库当前的文件列表。

```text
channel_lab/models/bert/
  config.json                 # model_type=bert, is_decoder=false
  model.safetensors
  tokenizer_config.json
  vocab.txt
channel_lab/models/gpt2/
  config.json                 # model_type=gpt2
  model.safetensors
  tokenizer_config.json
  vocab.json
  merges.txt
```

若来源带 `special_tokens_map.json`、`added_tokens.json`、`tokenizer.json`，一起保留并记录指纹。默认使用英语原始架构 checkpoint；聊天模型、GPT-3 服务或其它 AutoModel 类型不能直接代替。08 与 07 共用 GPT2 目录，不要求新增大模型。

```bash
export CHANNEL_LAB_BERT_MODEL="$PWD/channel_lab/models/bert"
export CHANNEL_LAB_GPT2_MODEL="$PWD/channel_lab/models/gpt2"
export CHANNEL_LAB_LANGUAGE_DEVICE=cpu
```

也可参考现有 `experiments.env.example`。参数进入启动后端的环境后才生效；配置查询是依赖、文件和 model_type 检查，不加载权重。设备可用性、tokenizer 兼容、checkpoint 完整性在显式运行时检查。全部 `from_pretrained` 使用 local_files_only，worker 环境设为 offline；不会因缺文件转为在线下载。

以后用户要显示修改，按 README 构建和启动流程重新构建前端、重启后端；只有旧 dist 的生产页面不会自动更新。本轮未执行这些步骤。

## API 与记录

- `GET /api/experiments/language/config/06|07|08`：08 指向 GPT2 配置。
- `POST /api/experiments/language/run`：`{paper_id:"06"|"07",texts:[...],max_new_tokens:48}`；1–3 条、每条 1–2000 字符，生成上限 128。
- `POST /api/experiments/language/context`：`{conditions:[{name,example_ids,renamed,corrupt_id}, ...]}`；必须 2 条件、各至多4个不重复合法卡片ID，corrupt_id 为 null 或已有卡片 ID。
- 语言 POST 请求体最多 16 KiB。180 秒是**整个请求**预算（包括加载与最多八次生成），不是每条预算；超时不返回半批结果。取消/断连/超时清理子进程；其他本地模型任务占用时返回409。
- 完整导出采用 schema_version=1、paper_id、provenance、data 外层；文件/权重/worker/request 指纹、设备、包版本、解码方式都写入。08 额外记录题集指纹和替代模型声明。
- 导入器最多20 MiB，JSON字符串当文本展示；不会运行导入文件代码。06/07旧记录缺 attention_mask 时明确标“未提供”。05/08旧版格式在各自折叠区查看。
- 记录结构见 [TRACE_FORMATS.md](TRACE_FORMATS.md)。模型输出只留在请求与页面内存，下载由用户点击；无新训练、自动保存模型或磁盘缓存功能。

## 后续人工验收（尚未执行）

1. 目录筛选/四课互跳；来源、实际源码、问题核对、笔记刷新/导出/重做。
2. 无依赖/无模型/错误 model_type/错误设备时显示具体原因，不出现候选、答案或伪曲线。
3. 06：0段/1段/全部右文；无MASK/多MASK报错；WordPiece与ID对齐；缺失候选不作0概率；编辑输入清除旧结果。
4. 07：三种前缀互相独立；逐步回放边界；EOS空输出；长度上限、超长输入和不完整字符；修改文章/长度清除旧结果及核查标注。
5. 08：单因素变化；完整提示与示例卡一致、没有测试目标；反向恢复顺序作为相同输入对照；标签映射准确；4题分母、other和错误回答保留；导入伪造correct/错位题集拒绝。
6. 05：读取真实v2记录；缺配对、错位step、不同优化/子集hash不计算收益；向上/向下指标符号；只有实际点，错例随step变化；旧记录不混入统计。
7. 推理中换输入、取消、离开页面；旧响应不可覆盖新输入，不能错误解除新请求busy状态；超时/锁冲突/设备不可用可恢复。
8. 导出后重新导入，同输入输出一致；非法尺寸/非有限概率/重复候选/超限文件拒绝；所有真实模型与浏览器行为仍待用户运行验收。
