#!/bin/sh
# Recreate a channel-lab container (weights mounted read-only, experiment records persisted, paper PDFs from the host).
# Secrets (SiliconFlow key, site password) live only in /home/ubuntu/channel_lab_secrets.env (chmod 600).
# Usage: run.sh [image]            -> production container "channel-lab" on :80
#        NAME=channel-lab-test PORT=127.0.0.1:8001 RESTART=no run.sh <image>   -> test container
SECRETS=/home/ubuntu/channel_lab_secrets.env
PAPERS=/home/ubuntu/channel_lab_papers
NAME=${NAME:-channel-lab}
PORT=${PORT:-80}
RESTART=${RESTART:-unless-stopped}
ENVFILE=""; [ -f "$SECRETS" ] && ENVFILE="--env-file $SECRETS"
PAPERVOL=""; [ -d "$PAPERS" ] && PAPERVOL="-v $PAPERS:/app/channel_lab/frontend/dist/papers:ro"
sudo docker rm -f "$NAME" >/dev/null 2>&1
sudo docker run -d --name "$NAME" -p "$PORT:8000" --restart "$RESTART" \
  -v /home/ubuntu/channel_lab_models:/app/channel_lab/models:ro \
  -v /home/ubuntu/channel_lab_runs:/app/experiment_runs \
  $PAPERVOL \
  $ENVFILE \
  -e CHANNEL_LAB_REACT_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions \
  -e CHANNEL_LAB_REACT_MODEL=deepseek-ai/DeepSeek-V3 \
  -e CHANNEL_LAB_REACT_ALLOWED_HOSTS=api.siliconflow.cn \
  "${1:-channel-lab:latest}"
