#!/bin/sh
# 在任意目录调用均可；不自动安装依赖或重新训练。
set -eu
PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_DIR"
if [ ! -x .venv/bin/python ]; then
  echo '请先按 channel_lab/README.md 创建 .venv 并安装后端依赖。'
  exit 1
fi
if [ ! -f channel_lab/frontend/dist/index.html ]; then
  echo '请先运行：cd channel_lab/frontend && npm ci && npm run build'
  exit 1
fi
exec .venv/bin/python -m uvicorn channel_lab.backend.app:app --host 127.0.0.1 --port "${CHANNEL_LAB_PORT:-8000}"
