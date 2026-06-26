#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "=== Rebuilding chat-svc (groups fix) ==="
DOCKER_BUILDKIT=0 docker-compose build chat-svc && \
  docker-compose stop chat-svc && \
  docker-compose rm -f chat-svc && \
  docker-compose up -d chat-svc && \
  sleep 10 && \
  docker logs digiability_chat_svc --tail 10 && \
  echo "=== DONE ==="
read -p "Press Enter to close..."
