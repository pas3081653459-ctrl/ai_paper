# CLIP / ReAct / ViT 配置与当前实现边界

## 最新：图片空间操作分类

10 / 20 / 19 的本地模型适配、完整照片交互、记录导出/回放和配置检查已接入源码；详见 [IMAGE_CATEGORY.md](IMAGE_CATEGORY.md)。仍未安装、下载权重或运行验收。后文旧“仅像素/仅回放”描述以此文档为准。

## 当前先补齐：原文证据实验分类

09 / 15 / 17 / 18 已补固定案例、独立交互、核对反馈、笔记/导出与分类导航；无需新包或权重。源码和配置说明见 [EVIDENCE_CATEGORY.md](EVIDENCE_CATEGORY.md)。09现在默认提供原文 Figure 6 的近似读图点，可选导入自己的观测点；不是作者原始测量。全部运行验收仍待授权，dist未更新。

新增：剩余18篇已经切换到独立组件，包含 BERT/GPT-2 本地推理接口、原文证据实验和专用轨迹回放。轨迹契约见 [TRACE_FORMATS.md](TRACE_FORMATS.md)；没有导入数据的页面显示空态。新增代码同样没有运行验收。

## BERT / GPT-2 可选本地推理

本类别最新配置以 [LANGUAGE_CATEGORY.md](LANGUAGE_CATEGORY.md) 为准。新增08上下文示例实验，复用GPT-2本地目录；无需新的模型服务。05只读真实训练记录。可选 `requirements-language.txt` 复用下列依赖约束。

沿用 `requirements-clip.txt` 的 Transformers 4.55.4 候选依赖，不新增 npm 包。只接收本地 safetensors，使用明确的 BertForMaskedLM/GPT2LMHeadModel 类，不加载远程代码。之后手动配置目录：

```text
channel_lab/models/bert/
  config.json
  model.safetensors
  tokenizer_config.json
  vocab.txt
  special_tokens_map.json   # 与来源保持一致（如有）
channel_lab/models/gpt2/
  config.json
  model.safetensors
  tokenizer_config.json
  vocab.json
  merges.txt
  special_tokens_map.json   # 如有
```

分别设置 `CHANNEL_LAB_BERT_MODEL`、`CHANNEL_LAB_GPT2_MODEL`，设备使用 `CHANNEL_LAB_LANGUAGE_DEVICE=cpu`（可手动改 mps/cuda）。示例已加入 experiments.env.example。模型、配置和 tokenizer 必须同一来源版本；建议第一步使用原始英语 BERT/GPT-2 兼容 checkpoint，不把本地路径随意指向其他 AutoModel 架构。**本轮未查询或下载具体权重文件，也未验证这些包的本机兼容性。**

接口 `GET /api/experiments/language/config/06`、`.../07`、`.../08`；`POST /api/experiments/language/run`，请求：`paper_id` 为06/07，`texts`为1–3条输入，`max_new_tokens`为1–128，默认48。08走 `POST /api/experiments/language/context`，只接收两组示例ID和干预参数，后端拼接固定四题，每题最多12新token。请求体最多16 KiB。页面只在点击运行时调用。

- BERT：每条输入恰好一个 `[MASK]`，对该位置完整词表 softmax 后取top8。返回token、ID、mask位置与候选。输入移除右文不改变双向模型本身。
- GPT-2：显式逐token argmax贪心解码，记录所选token及概率；EOS或长度上限结束。三条件顺序运行，均从原始前缀重新开始，不共享上一条件的KV缓存。
- 两者共用 CLIP 的按需子进程、180秒总请求期限、取消/断连清理，并与DDPM共用文件锁。一次请求结束释放模型，不启动训练。外部ReAct模型服务仍不在该锁管理范围。
- 输出采用 TRACE_FORMATS 的v1外层，附权重/文件指纹、设备、版本、实际设置。配置接口仅检查存在；权重加载、设备支持和推理结果待用户运行验证。

接口参考：[BERT 4.55.4](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/bert)、[GPT-2 4.55.4](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/gpt2)。无需为了其他论文提前下载大型语言或多模态模型。

## 回放类课程如何启用

13/14/22/24最新配置见 [TRAINING_CATEGORY.md](TRAINING_CATEGORY.md)。13无需模型；14/22/24新增 `/api/experiments/training` 复用GPT2目录与requirements-language.txt，不需下载新的大模型。三课也支持v2记录导入，旧格式放在各自折叠区。

02/03最新分类实现与详细准备见 [SEARCH_CATEGORY.md](SEARCH_CATEGORY.md)：无需新包、权重或服务。02使用有来源的树JSON，03使用selfplay-v2真实训练档案；网页井字棋UCT样本明确无训练，不能导入为训练检查点。SGF/GTP/任意引擎日志不是此导入器的直接格式，需按TRACE_FORMATS转换。

读取本地JSON仅用浏览器，不需要新Python包。按 TRACE_FORMATS 导入实际记录。支持的体验已接入：围棋树/棋盘、井字棋训练目标、迁移曲线、上下文条件、回答盲评、公开解答审查、图像问答取证、SAM提示/掩码、工具损失过滤、专家路由、组内奖励、多模态去噪分镜。来源只作展示及结构校验，不自动证明真实性。

目前没有为这些大模型生成全套真实输出示例。SAM任意提示解码、LLaVA输入问答与ViT分类适配已经写入代码，需用户配置权重后验收；AlphaGo等其它类别仍缺引擎/训练轨迹等资源，不能把“界面可导入”算作全部实验完成。原文证据四课已有默认案例。

状态：代码接入，未安装依赖、下载权重、编译、启动或运行测试。以下命令只供用户之后手动执行。本轮计划见 [REMAINING_PAPERS_PLAN.md](REMAINING_PAPERS_PLAN.md)。

## 不配置权重时可以做什么

| 页面 | 可使用的源码功能 | 暂不可用部分 |
|---|---|---|
| 10 / ViT | 固定照片、上传、切块、遮挡、交换、RGB检查 | 已写模型分类/投影适配；需本地权重，未配置不显示预测 |
| 20 / SAM | 添加正负点、框、撤销、坐标编辑、真实记录回放 | 多候选解码需要本地SAM；无权重不显示假掩码 |
| 19 / LLaVA | 照片遮挡、编辑问题、真实回答回放与取证 | 三条件实际回答需要匹配的本地LLaVA与模板 |
| 12 / CLIP | 编辑候选、准备图片、查看缺失配置 | 实际排名需要本地 checkpoint 和可选依赖 |
| 21 / ReAct | 后端的封闭档案环境，读者模式实际执行搜索/读取/结论校验 | 模型选择行动需自行配置本地语言模型服务 |

这些源码需用户手动构建或启动开发服务才能在网页看到。不是已部署结果。

## CLIP：依赖

新增候选依赖约束在 `requirements-clip.txt`，使用已有基础 PyTorch 环境。后端与子进程使用相同解释器：

```bash
cd /Users/Zhuanz/work/pystudy/photodeal/semantic_seg
.venv/bin/python -m pip install -r channel_lab/requirements-clip.txt
.venv/bin/python -m pip check
```

这里固定 Transformers 4.55.4 以对应编写时参考的接口；Hub 与 safetensors 的范围兼容 DDPM 可选文件的约束，但尚未实测组合。不修改现有基础锁文件、不要求升级全部 torch。Transformers 会带入自身必要依赖，例如 tokenizers；不要求新增前端包、accelerate 或完整训练集。

## CLIP：本地模型文件

之后自行从同一 revision 准备 [openai/clip-vit-base-patch32 官方仓库](https://huggingface.co/openai/clip-vit-base-patch32/tree/main) 的 PyTorch 文件：

```text
channel_lab/models/clip-vit-base-patch32/
├── config.json
├── preprocessor_config.json
├── tokenizer_config.json
├── vocab.json
├── merges.txt
├── special_tokens_map.json     # 建议与仓库保持一致
└── pytorch_model.bin           # 或同架构的 model.safetensors
```

查询时该官方仓库列出约 605 MB 的 PyTorch `.bin`，并未列出 `model.safetensors`；不用为了满足文件名创建空占位文件，也不下载其他框架的权重副本。若自行提供 safetensors，代码优先使用它，必须与配置匹配。`.bin` 通过 Transformers 的 `weights_only=True` 路径加载，受 PyTorch/Transformers 的版本检查约束；不要通过禁用该检查绕过兼容错误。

只传绝对本地路径、`local_files_only=True`，并强制 Hub/Transformers offline；不会自动补下载缺失文件，不使用 `trust_remote_code`。配置接口只检查文件和包存在，真正兼容性在请求加载时验证。

## CLIP：推理过程与资源

1. 浏览器把上传照片缩到最长边 768，并以 JPEG 质量 .92 编码；白底合成透明背景。用户点击运行才发送到本机。
2. 后端限制整个请求 3 MB，图片 base64 字段最多 2,800,000 字符，2–8 个不同候选，每个最多 300 字符。模型 tokenizer 检查实际 token 上限，超长拒绝而不是静默截断。
3. 子进程读取本地模型，运行实际图像/文字编码，显式 L2 归一化、点积、learned logit scale 与 softmax。
4. 返回真实模型裁剪图、向量、token IDs、分数和文件 SHA-256。照片不持久化到后端磁盘；浏览器可主动导出 JSON，导出文件包含模型裁剪图和用户描述。
5. 请求完成后进程退出，下一次重新加载。最长 180 秒，用户取消/浏览器断连会终止；加载速度、MPS 和取消路径尚未运行验证。

DDPM 与 CLIP 共用记录目录下的文件锁，避免同时加载两个本地模型。只部署一个 Uvicorn 服务进程；不要为不同进程配置不同锁目录。ReAct 的外部本机模型服务不受这个锁管理，应自行避免内存争用。

同图改描述的对比保留当前/上一次结果，页面刷新后清空。分数属于这组候选，不是识别正确率；图片可能被中心裁剪，界面特地显示实际模型输入。当前不做多图训练损失，不使用 CLIP 分数宣称定位能力。

## ReAct：无需额外 Python 包的读者模式

现有 FastAPI/httpx 环境即可。前端选择“我来调查”，真实调用 `/api/experiments/react` 下的环境接口。工具只有 search/read/finish，不执行任意命令、不访问外部网页、不自动给答案。

首次故障开关在会话创建时固定；只影响第一个工具查询，故障不返回任何证据。最终结果分别检查答案和实际读取的来源；直接猜中城市但没读取证据不能算成功。

会话在内存中，最多 20 个，创建新会话时清理超过一小时且不繁忙的旧会话。重启后端清空。最多 8 次尝试（失败也计数），每次点击推进一步；不启动自主后台循环。可以导出页面实际事件，或 DELETE 删除已不繁忙的会话。

## ReAct：可选本地模型服务

本轮不安装/启动推理框架或语言模型。适配器只要求用户已有服务满足以下契约：

- 监听 `127.0.0.1` / `localhost` / `::1`，HTTP(S)；不接受非回环地址和重定向。
- 完整聊天接口 URL，例如 `http://127.0.0.1:1234/v1/chat/completions`。这只是路径示例，不代表该服务已部署。
- 接受 `model`、`messages`、`temperature: 0`、`max_tokens: 256`、`stream: false`。
- 返回 `choices[0].message.content` 字符串，内容为一个行动 JSON，例如 `{"action":"search","query":"玻璃之舟"}`；不得只返回 tool_calls 或把 JSON 包进 Markdown 代码块。
- 只请求公开行动，不请求私有思维；忽略 `reasoning_content`。非法 JSON/未知行动不能执行，错误显示在轨迹上。

使用支持该格式的本机模型即可，真实名称填 `CHANNEL_LAB_REACT_MODEL`。不会自动发现/拉取模型。模型权重 revision 由外部服务管理，记录会明确注明未验证，不把服务返回的模型名字当作权重指纹。

请求超时 60 秒、响应上限 128 KB。停止点击即不再发起新步骤；已经发出的那一步仍可能返回，最长等待由服务/HTTP 超时控制。关闭页面不会撤回已送达本机模型的请求。此版本没有专用 ReAct 取消接口。

此实现是替代模型的公开行动—环境反馈实验，**没有实现原文完整 Thought 提示或 Act-only/CoT 消融**。不能用本例两跳查询的成功率代表原论文结果。

## 环境变量、启动与新版页面

```bash
cd /Users/Zhuanz/work/pystudy/photodeal/semantic_seg
cp channel_lab/experiments.env.example channel_lab/experiments.env.local
# 按实际路径、本机 endpoint 和模型名编辑后：
source channel_lab/experiments.env.local
./channel_lab/start.sh
```

`start.sh` 不自动 source 配置。CLIP 默认 CPU；Mac 上可尝试 `CHANNEL_LAB_CLIP_DEVICE=mps`，不支持时显示错误，不自动更换设备。

前端没有新增 npm 依赖。已有 node_modules 时可手动 `cd channel_lab/frontend && npm run dev`；生产托管需自己执行 `npm run build`。没有 dist 时，后端开发模式可从根目录手动执行 `.venv/bin/python -m uvicorn channel_lab.backend.app:app --host 127.0.0.1 --port 8000`，另一个终端运行 Vite；不重复启动后端。

API 入口：CLIP `GET /api/experiments/clip/config`、`POST .../compare`；ReAct `GET .../config`、`POST .../sessions`、`GET/DELETE .../sessions/{id}`、`POST .../sessions/{id}/step`。这些接口沿用现有本机部署范围，未新增公网鉴权。

## 其余论文依赖

目前只生成详细任务，没有要求一次性安装所有模型。BERT/GPT-2/ViT 模型适配后续分别声明 checkpoint；SAM/LLaVA 的权重与预处理必须成套；搜索/训练/Mixtral/MMaDA 优先准备可追溯记录。证据桌面用已有 Vue/SVG 与原文数据，不需要模型。不要因为计划中出现名字就提前下载。

官方接口参考：[Transformers 4.55.4 CLIP](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/clip)、[ReAct 作者项目页](https://react-lm.github.io/)。这些来源用于设计；本站当前实现与完整原论文实验的区别如上。

## 稀疏类别可选环境

23/25页面不需要新增npm依赖或服务。Mixtral真实导出需独立Python环境、torch、transformers==4.55.4、safetensors、sentencepiece和完整本地模型；无量化/offload，多数笔记本不满足内存需求。MMaDA记录适配器只有标准库，真正生成另按官方固定commit部署。命令、资源边界、记录挂点见SPARSE_CATEGORY.md。本轮未安装或下载。
