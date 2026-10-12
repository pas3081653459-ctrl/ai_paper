# syntax=docker/dockerfile:1
FROM python:3.12-slim-bookworm AS deps

WORKDIR /app

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    TORCH_NUM_THREADS=2

# Pinned deps (pip freeze of the verified image) installed OFFLINE from the host wheelhouse
# /home/ubuntu/channel_lab_wheels (filled by deploy/fetch_wheels.sh). No network, no index => reproducible.
# Build: docker build --build-context wheels=/home/ubuntu/channel_lab_wheels -f Dockerfile -t channel-lab:X .
#        (add --target deps -t channel-lab:base for the base used by Dockerfile.code-update)
COPY requirements-docker.txt /tmp/requirements-docker.txt
RUN --mount=type=bind,from=wheels,target=/wheels \
    pip install --no-index --find-links /wheels -r /tmp/requirements-docker.txt

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

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "channel_lab.backend.app:app", "--host", "0.0.0.0", "--port", "8000"]

FROM deps AS app
COPY channel_lab /app/channel_lab
RUN mkdir -p /app/experiment_runs /app/papers /app/channel_lab/models
