# 图片空间操作：ViT / SAM / LLaVA

2026-09-30。**本类别已接入完整前后端功能代码，尚未编译、启动、测试、推理或部署。没有安装任何依赖，没有下载权重，也没有生成模型输出。** 以下“运行”描述的是用户配置之后的代码路径，不是本机验证结果。

## 入口和三种不同的体验

论文实验室 `#/papers` → **图片空间操作**；课内也有三课互相跳转。共享的是照片读取、模型状态和学习笔记，不是教学场景。

| 课程 | 无需权重的操作 | 配置模型后的功能 |
|---|---|---|
| `#/papers/10` ViT | 内置猫/狗照片、上传、中心裁剪、教学切块、选像素、遮挡、两块交换、恢复 | 同模型两图分类，原图第一名在两条件的概率；真实patch投影变化；位置相加前16维；实际编码器层形状 |
| `#/papers/20` SAM | 正/负点、拖框、键盘坐标、逐点删除、撤销、猫头/排除身体/整猫框三个预设 | 实际多候选mask、透明叠加、固定前次候选比较、图像编码缓存状态、清理缓存 |
| `#/papers/19` LLaVA | 拖框遮挡、猫头/背景预设、同图对照、编辑问题 | 原图/遮挡/可选无图逐条件贪心解码；实际处理器裁剪图；公开输出token；逐条件取证备注 |

三课都能导出实际运行的v1记录；无权重也可导入此前的真实记录。ViT导入后查看相应图像与向量；SAM/LLaVA回放区与上方当前编辑区分开，避免把旧输出当作新提示结果。没有预置分类概率、分割mask或模型回答。内置照片只提供输入和操作任务，**不是已有真实模型输出包**。

学习作答/笔记沿用 `channel-lab:evidence:v1:<paperId>`，仅在当前浏览器保存；照片、上传记录和大向量不存localStorage。探索参数不跨刷新恢复。SAM回放和LLaVA历史回放的临时状态与主课笔记分开。

LLaVA主实验逐条件取证备注绑定比较指纹（图片、问题、解码、模型/环境/代码）；新结果的指纹不同时清空旧取证备注，避免把上一张图的判断贴到新回答旁。一般学习笔记不清空，可先导出保留旧记录。

## 输入与模型计算

### ViT：像素 → patch → 位置 → 全局分类

图片首先按比例缩至最长边768；ViT再中心裁剪正方形并缩放到224×224。遮挡用RGB(127,127,127)，交换只搬动像素。前端可选16/32/56教学网格，**不修改模型checkpoint的patch_size**。

后端限定224输入的 `ViTForImageClassification`，图像处理器只进行对应rescale/normalize，不再次resize。两图一起前向：

```text
[2,3,224,224]
→ Conv2d(kernel=stride=P)
→ flatten + transpose: [2,(224/P)²,D]
→ 拼接CLS、加学习位置表: [2,1+(224/P)²,D]
→ Encoder → 最终CLS分类
```

每个patch显示前16维投影、位置向量与相加结果；图上差异量为完整D维的 `sqrt(mean((changed-original)²))`。颜色以本次最大值归一化，不用于跨实验直接比较。位置表不重排；浮点舍入可能使显示的相加不严格等于四舍五入后各项之和。返回 `output_hidden_states` 的形状，不把形状表说成完整内部激活可视化。遮挡差异不是分割、注意力归因或ViT优于CNN的证明。

### SAM：固定图像编码，重新解释提示

模型使用 `SamModel` / `SamProcessor`；前端坐标逆映射为提交的实验图像素。每次解码都采用当前正负点/框，`multimask_output=True`；后处理把mask还原到实验图尺寸。候选质量是模型预测分，不是标注IoU。

缓存位置：`<CHANNEL_LAB_EXPERIMENT_RUNS>/.sam-image-cache/`，只写图像编码的safetensors，不写原始照片。键包含RGB像素/尺寸、权重与配置指纹、代码指纹、库版本、device和dtype。换图或换权重不能误用旧缓存。访问时清理20分钟前的缓存，成功写入后最多保留8份；这是惰性清理，不是后台定时删除。中断写入的临时文件也可清理。

“清理本地图像编码缓存”调用DELETE接口，只清理本功能命名的文件；与模型请求共用进程内锁和跨进程文件锁。缓存命中省去图像encoder前向，**每次请求仍加载模型**，不能称为实时性能实测。编码同样属于图片衍生数据，有需要可手动清理。

### LLaVA：原图 / 遮挡 / 无图

仅支持HF `model_type=llava`、文本主干 `model_type=llama` 的checkpoint，例如LLaVA-1.5；不支持LLaVA-NeXT、OneVision或任意AutoModel远程代码。LLaVA-1.5是原论文之后的替代模型，不能声称复现原版线性连接器或训练成绩。

保持同一模型、问题和贪心规则，各条件独立初始化KV缓存。使用随模型提供的聊天模板和processor配置，将图像占位符展开到匹配的视觉token；显式执行 `forward → softmax → argmax → 追加token`，最多128个新token，EOS提前停止。无图时移除图片及其占位符；这是输入条件对照，不是训练视觉消融。

返回完整提示、input_ids、新token与所选概率、结束原因、图像指纹，并反归一化实际pixel_values显示处理器裁剪。逐token片段单独解码可能与整段空格不同，最终回答使用整段解码。不索取私有思维；不伪造回答到空间的热图。

## 本地文件和可选依赖

**新增npm包：无。** 新增 `requirements-vision.txt` 引用已有 `requirements-clip.txt`，统一固定 `transformers==4.55.4`，沿用hub/safetensors范围。torch、numpy、Pillow、FastAPI等来自基础环境。没有增加pipeline、外部推理服务、accelerate或量化插件。

只有之后选择启用真实模型时才需要安装可选依赖。下列命令仅供用户手动执行，本轮未执行：

```bash
cd /Users/Zhuanz/work/pystudy/photodeal/semantic_seg
.venv/bin/python -m pip install -r channel_lab/requirements-vision.txt
.venv/bin/python -m pip check
```

依赖约束是按接口编写的候选组合，不是经过本机测试的锁文件。不自动升级现有基础torch环境。加载失败、设备不支持或内存不足由页面显示错误。

模型目录由用户之后准备，**不需要现在下载，也不提供自动下载路径**。仅接受本地safetensors；可以是单文件或索引加全部分片。索引不允许越出模型目录。配置、处理器、分词器与权重必须来自同一固定revision。

```text
channel_lab/models/vit/
  config.json                    # model_type=vit, image_size=224
  preprocessor_config.json
  model.safetensors
channel_lab/models/sam/
  config.json                    # model_type=sam
  preprocessor_config.json
  model.safetensors
channel_lab/models/llava/
  config.json                    # model_type=llava, text_config.model_type=llama
  preprocessor_config.json
  processor_config.json          # image_token, patch_size, feature selection
  tokenizer_config.json
  tokenizer.json                 # fast tokenizer；不临时转换模型
  tokenizer.model                # 若原revision提供，保留
  special_tokens_map.json        # 若原revision提供，保留
  added_tokens.json              # 若原revision提供，保留
  generation_config.json         # EOS等生成配置
  chat_template.jinja            # 保留原模板；旧revision可能为chat_template.json
  model.safetensors.index.json
  model-00001-of-00003.safetensors
  model-00002-of-00003.safetensors
  model-00003-of-00003.safetensors
```

参考文件仓库（仅查阅，没有下载）：[ViT base](https://huggingface.co/google/vit-base-patch16-224/tree/main)、[SAM base](https://huggingface.co/facebook/sam-vit-base/tree/main)、[HF LLaVA-1.5 7B](https://huggingface.co/llava-hf/llava-1.5-7b-hf/tree/main)。目录中的其他框架权重无需重复准备；按实际选择的revision文件为准。

建议分课配置，不要求一次装齐。7B模型仅按float32参数存储就约28GB，float16约14GB，尚未包含视觉主干、激活、KV和加载峰值；本适配器不自动卸载到多设备或量化。硬件不适合LLaVA时可以保留照片干预与真实记录回放，不填充生成答案。

## 环境变量与部署

将已有 `experiments.env.example` 按需复制到被gitignore忽略的 `experiments.env.local`，在项目根目录设置：

```bash
export CHANNEL_LAB_VIT_MODEL="$PWD/channel_lab/models/vit"
export CHANNEL_LAB_SAM_MODEL="$PWD/channel_lab/models/sam"
export CHANNEL_LAB_LLAVA_MODEL="$PWD/channel_lab/models/llava"
export CHANNEL_LAB_VISION_DEVICE="cpu"
export CHANNEL_LAB_VISION_DTYPE="float32"
export CHANNEL_LAB_VISION_TIMEOUT="600"
export CHANNEL_LAB_EXPERIMENT_RUNS="$PWD/channel_lab/experiment_runs"
```

MPS/CUDA可选float16，CPU限定float32。超时范围60–1800秒；同一个请求包括权重指纹、加载和全部条件的推理。每次请求独立子进程，正常结束、取消、断连、超时会清理进程；与DDPM/CLIP/语言模型串行使用设备。权重SHA256会读取大文件，首次等待可能明显。文件存在检查并不加载模型或创建缓存。

接口：

- `GET /api/experiments/vision/config/{10|19|20}`：配置/依赖检查。
- `POST /api/experiments/vision/run`：按paper_id执行，返回TRACE_FORMATS v1外层。
- `DELETE /api/experiments/vision/sam-cache`：仅清理SAM图像编码缓存。

请求体上限6,600,000字节，两张base64图片各最多3,200,000字符；图片最长边768，ViT必须224方图，SAM最多32个点。图像只在运行时发往当前网站后端。这个项目仍按本机学习部署，不新增公网发布或认证功能。实验JSON的图片与回答只由用户点击导出后保存。

前端沿用README的开发/构建流程；Vite `/api` 默认代理到 `127.0.0.1:8000`。修改后端端口时同步调整代理。未重新构建的生产dist不会显示新分类。停止浏览器请求使用页面取消按钮；服务关闭也沿用共享worker清理机制。**本轮没有执行这些启动或构建命令。**

## 源码位置

- `backend/vision_api.py`：文件、版本、输入验证及路由。
- `backend/vision_worker.py`：三种实际前向、指纹、缓存、解码、v1输出。
- `frontend/src/components/cases/ViTPatchExperiment.vue` / `SAMExperiment.vue` / `LLaVAExperiment.vue`。
- `LabPhotoPicker.vue` / `PromptCanvas.vue` / `VisionModelStatus.vue`：共享基础交互。
- `VisionImplementation.vue`：网页内读取实际worker/API源码。
- `papers/useVisionModel.ts` / `visionInputs.ts` / `visionTraces.ts` / `lessonCategories.ts`。
- `assets/vision-lab/`：从已有Oxford-IIIT Pet数据复制的两张原图及来源说明；不是评测集或预测结果。

API参考：[SAM 4.55.4](https://huggingface.co/docs/transformers/v4.55.4/en/model_doc/sam)、[ViT源码4.55.4](https://github.com/huggingface/transformers/blob/v4.55.4/src/transformers/models/vit/modeling_vit.py)、[LLaVA源码4.55.4](https://github.com/huggingface/transformers/blob/v4.55.4/src/transformers/models/llava/modeling_llava.py)。基础模型由库负责加载，教学中关心的投影读取、缓存分离和逐token选择显式写在worker中。

## 未执行的验收清单

1. TypeScript/Vue构建及后端导入；三条路由、图片资源、分类筛选；旧证据四课/CLIP/语言接口回归。
2. 无任何权重时照片、切块、提示、遮挡仍可操作，模型按钮不可用，原因明确；服务离线可恢复查询。
3. ViT原图与恢复图分类/投影差在浮点容差内为零；交换只改指定像素；模型patch固定；前16维相加与实际输出一致；灰区输入像素正确。
4. SAM横竖图片/窄屏/触控坐标，正负点、框、撤销/删除、多候选与对照；mask尺寸不符不覆盖；一张图第二次提示应命中缓存，换图/权重/dtype应失效。
5. SAM清理缓存与运行互斥；跨进程锁、损坏缓存回退、20分钟惰性清理、8份上限及取消时临时文件清理。
6. LLaVA三条件模板、image token计数、输入哈希、实际处理器裁剪、EOS/长度停止；相同图/问题/设置贪心对照；不支持模板或配置时给出错误，不降级为假回答。
7. 图片/参数/问题改变后取消旧请求、清除旧结果；离开页面后不回填；连续取消/重试、超时/断连释放进程；所有模型共用锁。
8. 导出后在对应回放区导入；空回答允许保留；非法JSON、来源字段缺失、NaN、尺寸错配及超过20MB文件有反馈。
9. 390px宽度、键盘坐标、按钮/滑块、长回答、模型配置错误显示；笔记刷新恢复且重做可清空。

目前只有文件编辑、源码阅读、官方接口资料核对及现有输入照片目视检查；以上均未运行，不能声称模型识别、分割或回答已通过验证。
