# ai_paper · Channel Lab

论文学习网站：Vue 3 / TypeScript / Vite 前端 + FastAPI / PyTorch 后端。包含 CNN/ResNet 特征图对比、Transformer 原理页、24 篇 AI 里程碑论文实验室（`#/papers`）、术语词典（`#/glossary`）和数学学习室（`#/math`）。详细说明见 [channel_lab/README.md](channel_lab/README.md) 及各分类文档。

## 目录

```
bert_model.py gpt_model.py transformer_layers.py   # 前端 Transformer 页以 ?raw 引用的教学源码（必须与 channel_lab/ 同级）
channel_lab/backend/      FastAPI 应用 channel_lab.backend.app:app 与各模型 worker
channel_lab/frontend/     Vue 源码；public/papers 放论文 PDF（PDF 未入库，见下）
channel_lab/artifacts/    两个约 2 万参数的已训练小模型 cnn.pt / resnet.pt 及指标
channel_lab/data/         仅 2 张示例图 + 官方划分列表（完整 Oxford-IIIT Pet 数据集未入库）
deploy/                   Dockerfile、服务器下载权重脚本、容器启动脚本
```

## 本地运行

```bash
python3.12 -m venv .venv
.venv/bin/pip install -r channel_lab/requirements.txt
# 可选模型实验：
.venv/bin/pip install -r channel_lab/requirements-vision.txt -r channel_lab/requirements-ddpm.txt
cd channel_lab/frontend && npm ci && npm run build && cd ../..
./channel_lab/start.sh            # http://127.0.0.1:8000
```

模型目录默认 `channel_lab/models/<name>`，也可用 `CHANNEL_LAB_*_MODEL` 环境变量指定（见 `channel_lab/experiments.env.example`、`ddpm.env.example`）。

## 部署（Docker）

```bash
# 在仓库根目录；镜像直接复制 channel_lab/，需先构建前端 dist（并放入论文 PDF）
cd channel_lab/frontend && npm ci && npm run build && cd ../..
docker build -f deploy/Dockerfile -t channel-lab:latest .
sh deploy/download_models.sh      # 下载权重到 /home/ubuntu/channel_lab_models（可改脚本里的 BASE）
sh deploy/run.sh                  # -p 80:8000，挂载权重(ro)与实验记录目录
```

验证：`/`、`/api/health`、`POST /api/analyze?mode=trained`、`/api/experiments/*/config`。

## 模型权重（未入库）

| 目录 (`channel_lab/models/`) | 来源 (Hugging Face，固定 revision) | 文件 | 大小 |
|---|---|---|---|
| `ddpm-cifar10-32` | google/ddpm-cifar10-32 | diffusion_pytorch_model.safetensors | 143 MB |
| `vit` | google/vit-base-patch16-224 | model.safetensors | 346 MB |
| `sam` | facebook/sam-vit-base | model.safetensors | 375 MB |
| `bert` | google-bert/bert-base-uncased | model.safetensors | 440 MB |
| `gpt2` | openai-community/gpt2 | model.safetensors | 548 MB |
| `clip-vit-base-patch32` | openai/clip-vit-base-patch32 | pytorch_model.bin | 605 MB |
| `llava` | llava-hf/llava-1.5-7b-hf | 分片 safetensors | ~14 GB（未部署：CPU float32 需约 28 GB 内存） |

`deploy/download_models.sh` 从 hf-mirror.com 取配置/分词器，大文件从 ModelScope 镜像下载，并按 HF LFS 的 SHA-256 校验。

## 未入库的内容

- 模型权重（上表）、`node_modules/`、`frontend/dist/`、虚拟环境、缓存与实验记录。
- 完整数据集（约 1.6 GB）：`python -m channel_lab.backend.prepare_data` 重新获取。
- 论文 PDF（约 97 MB，第三方版权）：来源与校验和见 `channel_lab/frontend/public/papers/SOURCES-0*.md`、`SHA256SUMS.txt`，按清单下载放入该目录后再构建前端。
