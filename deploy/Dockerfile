FROM python:3.12-slim-bookworm

WORKDIR /app

# Tencent PyPI mirror for speed in CN; torch CPU from official CPU index
ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TORCH_NUM_THREADS=2

COPY channel_lab/requirements.txt /tmp/requirements.txt

# Base deps (identical to previous image so the cached layer is reused)
RUN pip install -i https://mirrors.cloud.tencent.com/pypi/simple --trusted-host mirrors.cloud.tencent.com \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      "torch==2.14.0" \
      "numpy>=1.24" \
      "Pillow>=10" \
      "fastapi>=0.115" \
      "uvicorn>=0.30" \
      "python-multipart>=0.0.18" \
      "httpx>=0.27"

# Optional model adapters (requirements-clip/-language/-vision/-ddpm.txt). Weights are NOT in the image.
RUN pip install -i https://mirrors.cloud.tencent.com/pypi/simple --trusted-host mirrors.cloud.tencent.com \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      "torch==2.14.0" \
      "transformers==4.55.4" \
      "diffusers==0.35.1" \
      "huggingface-hub>=0.34,<1.0" \
      "safetensors>=0.4.3,<0.7"

# Model weights live on the host (/home/ubuntu/channel_lab_models) and are mounted read-only here.
ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    HF_HUB_DISABLE_TELEMETRY=1 \
    CHANNEL_LAB_DDPM_MODEL=/app/channel_lab/models/ddpm-cifar10-32 \
    CHANNEL_LAB_CLIP_MODEL=/app/channel_lab/models/clip-vit-base-patch32 \
    CHANNEL_LAB_BERT_MODEL=/app/channel_lab/models/bert \
    CHANNEL_LAB_GPT2_MODEL=/app/channel_lab/models/gpt2 \
    CHANNEL_LAB_VIT_MODEL=/app/channel_lab/models/vit \
    CHANNEL_LAB_SAM_MODEL=/app/channel_lab/models/sam \
    CHANNEL_LAB_LLAVA_MODEL=/app/channel_lab/models/llava \
    CHANNEL_LAB_DDPM_DEVICE=cpu \
    CHANNEL_LAB_CLIP_DEVICE=cpu \
    CHANNEL_LAB_LANGUAGE_DEVICE=cpu \
    CHANNEL_LAB_VISION_DEVICE=cpu \
    CHANNEL_LAB_VISION_DTYPE=float32 \
    CHANNEL_LAB_VISION_TIMEOUT=600 \
    CHANNEL_LAB_EXPERIMENT_RUNS=/app/experiment_runs \
    CHANNEL_LAB_PAPER_ROOT=/app/papers

COPY channel_lab /app/channel_lab
RUN mkdir -p /app/experiment_runs /app/papers /app/channel_lab/models

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "channel_lab.backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
