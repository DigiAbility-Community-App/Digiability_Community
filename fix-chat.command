#!/usr/bin/env bash
# Double-click this file to fix the chat services.
# Mac Terminal opens it with your full shell profile (Docker Desktop env included).

set -e
cd "$(dirname "$0")"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; RESET='\033[0m'

echo -e "${CYAN}=== DigiAbility Community — Chat Service Fix ===${RESET}"
echo "Working directory: $(pwd)"
echo ""

# Verify docker is reachable
if ! docker info &>/dev/null; then
  echo -e "${RED}ERROR: Cannot reach Docker daemon. Is Docker Desktop running?${RESET}"
  exit 1
fi

echo -e "${GREEN}Docker connected ✓${RESET}"
echo ""

echo "Step 1: Building updated chat-svc image..."
docker compose build chat-svc
echo ""

echo "Step 2: Removing stale chat containers (data volumes NOT touched)..."
docker rm -f digiability_chat_svc digiability_chat_msg_worker digiability_chat_delivery_worker 2>/dev/null || true
echo ""

echo "Step 3: Starting all 3 chat services..."
docker compose up -d chat-svc chat-msg-worker chat-delivery-worker
echo ""

echo "Step 4: Waiting 20s for Cassandra schema init..."
sleep 20
echo ""

echo "Step 5: Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(digiability|NAME)"
echo ""

echo "Step 6: chat-svc startup log:"
docker logs digiability_chat_svc --tail 15 2>&1
echo ""

# Final check
if docker ps --format '{{.Names}}' | grep -q "digiability_chat_svc"; then
  echo -e "${GREEN}✓ digiability_chat_svc is running${RESET}"
else
  echo -e "${RED}✗ digiability_chat_svc is NOT running${RESET}"
  echo -e "${YELLOW}Check full logs: docker logs digiability_chat_svc --tail 50${RESET}"
fi

echo ""
echo -e "${CYAN}Done. You can close this window.${RESET}"
read -p "Press Enter to close..."
