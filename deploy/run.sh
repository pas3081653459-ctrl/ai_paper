#!/bin/sh
# Recreate the channel-lab container (weights mounted read-only, experiment records persisted).
# ReAct model mode: SiliconFlow (OpenAI-compatible). The API key lives only in /home/ubuntu/channel_lab_secrets.env (chmod 600).
SECRETS=/home/ubuntu/channel_lab_secrets.env
ENVFILE=""; [ -f "$SECRETS" ] && ENVFILE="--env-file $SECRETS"
sudo docker rm -f channel-lab 2>/dev/null
sudo docker run -d --name channel-lab -p 80:8000 --restart unless-stopped \
  -v /home/ubuntu/channel_lab_models:/app/channel_lab/models:ro \
  -v /home/ubuntu/channel_lab_runs:/app/experiment_runs \
  $ENVFILE \
  -e CHANNEL_LAB_REACT_ENDPOINT=https://api.siliconflow.cn/v1/chat/completions \
  -e CHANNEL_LAB_REACT_MODEL=deepseek-ai/DeepSeek-V3 \
  -e CHANNEL_LAB_REACT_ALLOWED_HOSTS=api.siliconflow.cn \
  "${1:-channel-lab:latest}"
