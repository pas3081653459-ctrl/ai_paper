# DDPM 实验配置（第一步）

本次交付代码，没有执行安装、下载权重、编译、测试、启动或推理。下列命令供之后手动配置。界面实现与依赖组合仍待运行验收，不是已验证的部署结果。

## 能做什么

- 论文 11 / DDPM：上传 PNG、JPEG、WebP，浏览器缩放到 32×32，滑动加噪步数，检查单个像素的公式；图片不发给服务器。
- 配置本地模型后：从随机噪声开始，显式循环调用 UNet 与 DDPM scheduler，保存实际预测和采样结果。可停止、逐帧回放、检查 RGB 数值及删除记录。
- 未配置时仍可使用前向加噪；真实生成入口列出缺失项，不用模拟生成代替模型。
- 模型是 CIFAR-10 32×32 无条件生成，不是文生图、照片修复或猫狗分类。没有训练入口，不需要下载训练集。

## 1. Python 依赖

继续使用现有项目根目录 `.venv`。后端与子进程通过同一个 `sys.executable` 运行；只把包安装进另一个虚拟环境不会生效。

已有 Channel Lab 环境时，仅需之后按需执行：

```bash
cd /Users/Zhuanz/work/pystudy/photodeal/semantic_seg
.venv/bin/python -m pip install -r channel_lab/requirements-ddpm.txt
.venv/bin/python -m pip check
```

全新环境先按照 [README](README.md) 配置基础后端；本可选文件没有重复声明 torch、numpy、Pillow 和 FastAPI。不要全量升级现有 torch。新增包：

| 包 | 用途 | 本次状态 |
|---|---|---|
| diffusers 0.35.1 | UNet2DModel、DDPMScheduler | 根据该版本官方接口编写，未本机验证 |
| huggingface-hub ≥0.34、<1 | Diffusers 的模型文件解析依赖 | 仅解析本地文件，未安装 |
| safetensors ≥0.4.3、<0.7 | 读取指定安全张量格式 | 未安装 |

这是待验收的候选约束，不是锁文件；实际可安装性和与现有环境兼容性需手动验证。DDPM 首版不需要 transformers、accelerate、新前端 npm 包或 CUDA toolkit。worker 的进程锁使用 `fcntl`，目前面向 macOS/Linux，未适配 Windows。

## 2. 权重位置（本次不下载）

后续自行准备 [google/ddpm-cifar10-32 官方仓库](https://huggingface.co/google/ddpm-cifar10-32/tree/main) 同一个 revision 下的三个文件：

```text
channel_lab/models/ddpm-cifar10-32/
├── config.json
├── scheduler_config.json
└── diffusion_pytorch_model.safetensors
```

保持三个文件在同一层，不要套用其他模型的 unet/scheduler 子目录布局。只支持 `.safetensors`；仅有 `.bin`、Git LFS 指针文本或空占位文件不能生成。权重约 143 MB，另有配置；体积不等于运行内存，不承诺 CPU 生成速度。

不要自己编造配置。当前适配要求 RGB 32×32、epsilon 预测、不启用 dynamic thresholding，方差类型为 fixed_large 或 fixed_small。网页前向例子使用 1000 步线性 β（0.0001→0.02）；反向生成读取实际 scheduler 配置，若换模型配置，不能假定二者完全一致。

运行时同时使用本地绝对路径、`local_files_only=True`、`use_safetensors=True` 和 Hub 离线环境变量。不按 Hub ID 自动获取文件，不回退其他权重格式。配置查询只检查包及文件存在，不验证文件内容；加载失败显示真实错误。

## 3. 环境变量与启动

默认目录就是上面的模型目录，记录默认保存到 `channel_lab/experiment_runs`；默认 CPU。需要修改时：

```bash
cd /Users/Zhuanz/work/pystudy/photodeal/semantic_seg
cp channel_lab/ddpm.env.example channel_lab/ddpm.env.local
# 按实际路径编辑 ddpm.env.local 后：
source channel_lab/ddpm.env.local
./channel_lab/start.sh
```

`start.sh` 不会自动读取 env 文件，必须在启动它的终端先 source。路径含空格须保留引号。环境变量更改后重启后端。

| 变量 | 含义 |
|---|---|
| CHANNEL_LAB_DDPM_MODEL | 三个模型文件所在目录 |
| CHANNEL_LAB_EXPERIMENT_RUNS | 实验记录持久化目录；需可写 |
| CHANNEL_LAB_DDPM_DEVICE | cpu / mps / cuda，默认 cpu |

Mac 可以自行尝试 mps；代码检查可用性但不自动回退 CPU，失败后改回 cpu 重启。不同设备的浮点计算可能不同，相同种子不能保证跨设备逐位复现。

后端仍是本机 8000 端口，一个 Uvicorn 服务进程；不要设置多个 workers。点击生成才启动一个子进程并加载模型，完成后退出释放模型。无需新增数据库、Redis 或外部服务。

## 4. 前端显示新版页面

源码已改，既有 dist 不会自动更新。之后由你选择开发模式或构建：

```bash
cd channel_lab/frontend
# 已有 node_modules 时不需要新增安装；新环境先 npm ci
npm run dev
# 或用于现有 FastAPI 静态托管：npm run build
```

开发模式要求后端同时在 8000 端口，Vite 已代理 `/api`。在论文目录选择 11 / DDPM。先上传照片验证加噪，再配置模型点击“刷新配置 / 记录”。配置不足时生成按钮禁用。不要把未更新的生产构建当成最新页面。

全新环境没有 `dist/index.html` 时，`start.sh` 会要求先构建。若只想使用开发模式，可在另一个终端从项目根目录 source 配置后，手动运行 `.venv/bin/python -m uvicorn channel_lab.backend.app:app --host 127.0.0.1 --port 8000`，绕过该脚本的构建文件检查；无需启动第二个后端实例。

## 5. 采样与回放

- 默认 1000 个真实推理步骤；100/250 是跳步预览，改变时间表和生成分布，不能当原论文质量复现。
- `save_every` 默认 20，仅控制存储：执行所有采样步骤，保存首步、每 N 步和末步。
- 每帧六个 `[1,3,32,32]` 张量：xₜ、预测 ε、裁剪后的 x̂₀、后验均值、实际随机增量、下一步样本。
- PNG 用固定范围显示；JSON 保留 float32 转出的数值，排列为 BCHW。均值使用实际 scheduler 系数；随机增量由真实输出减去均值得到，存在浮点舍入误差。
- seed、时间表、设备、库版本、权重/配置/worker SHA-256 保存进 manifest。哈希用于识别本地文件，不是官方真实性认证。
- 一次默认任务约保存 51 帧。每帧六组 3072 数值，JSON 存储通常为几十 MB/任务量级（估算，未测量）。最多保留 20 次任务，包括失败记录，超过后需手动删除；没有自动清理用户结果。

目录内容：`request.json`、`status.json`、`manifest.json`、`worker.log`、首末 PNG、各帧 PNG/JSON。网页只按需读取选中帧，不一次传全部数值。目录及本地模型已加入 `.gitignore`。

## 6. 停止与排障

点击“停止生成，保留已保存帧”终止当前 worker，之后可以回放已有完整帧。关闭浏览器不会取消任务；回到页面可从本地记录中选择任务。正常 Ctrl+C 关闭后端会终止其 worker。

异常断电/强制杀死服务可能留下非终态记录。先确认后端和 worker 已停止，再手动移走对应 UUID 目录；不要在采样运行时修改记录。当前尚无异常记录自动修复功能。

| 现象 | 处理 |
|---|---|
| 缺少可选包 | 确认安装到 start.sh 使用的项目 `.venv`，重启服务 |
| 缺少文件 | 核对实际目录与文件名，source 环境变量后重启 |
| 存在但加载失败 | 查看页面错误和该任务 worker.log，检查同 revision 的配置/权重 |
| 设备不可用或内存不足 | 改 cpu；先取消其他任务，避免并行模型占用 |
| 409 已有任务 | 等待完成或停止原任务；文件锁也防止多个服务并发采样 |
| 页面仍是旧加噪演示 | 使用新开发服务或手动重新构建前端 |

API：`GET /api/experiments/ddpm/config`；`GET/POST .../jobs`；`GET/DELETE .../jobs/{id}`；`POST .../jobs/{id}/cancel`；`GET .../jobs/{id}/files/{filename}`。接口仅为现有本机服务设计，未新增公网鉴权部署。

## 7. 待运行验收

见 [VERIFICATION.md](VERIFICATION.md) 的 DDPM 清单。尤其要确认缺失权重下既有 CNN/ResNet 不受影响、真实模型六阶段数值一致、取消释放进程、离页重入不串帧。当前只做源码检查，不能据此声称生成质量或设备兼容性已通过。

接口依据：[Diffusers 0.35.1 显式 UNet + scheduler 流程](https://huggingface.co/docs/diffusers/v0.35.1/en/using-diffusers/write_own_pipeline)。后续 CLIP/ReAct 有各自独立的配置步骤，本文件不要求提前安装它们。
