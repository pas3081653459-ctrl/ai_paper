#!/bin/sh
# Recreate the channel-lab container on the server (weights mounted read-only, records persisted).
sudo docker rm -f channel-lab 2>/dev/null
sudo docker run -d --name channel-lab -p 80:8000 --restart unless-stopped \
  -v /home/ubuntu/channel_lab_models:/app/channel_lab/models:ro \
  -v /home/ubuntu/channel_lab_runs:/app/experiment_runs \
  "${1:-channel-lab:latest}"
