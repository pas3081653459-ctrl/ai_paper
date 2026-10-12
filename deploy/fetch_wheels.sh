#!/bin/sh
# Fill the persistent wheelhouse used by deploy/Dockerfile (pip --no-index). Safe to re-run.
# Usage: sh deploy/fetch_wheels.sh [wheel_dir]   (default /home/ubuntu/channel_lab_wheels)
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
WHEELS=${1:-/home/ubuntu/channel_lab_wheels}
mkdir -p "$WHEELS"
for i in 1 2 3; do
  sudo docker run --rm --network host -v "$WHEELS":/wheels -v "$HERE/requirements-docker.txt":/req.txt:ro python:3.12-slim-bookworm \
    pip download --disable-pip-version-check --no-cache-dir -d /wheels -r /req.txt \
      -i https://mirrors.cloud.tencent.com/pypi/simple --trusted-host mirrors.cloud.tencent.com \
      --extra-index-url https://mirror.sjtu.edu.cn/pytorch-wheels/cpu \
    && break
  echo "pip download failed (attempt $i), retrying..."; sleep 5
done
sudo chown -R "$(id -u):$(id -g)" "$WHEELS"
echo "wheelhouse: $(ls "$WHEELS" | wc -l) files, $(du -sh "$WHEELS" | cut -f1)"
