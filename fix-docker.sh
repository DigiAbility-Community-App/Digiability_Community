#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# fix-docker.sh — Fixes the Cassandra / chat-svc crash loop
#
# What this script does:
#   1. Points to the correct Docker Desktop socket on Mac
#   2. Rebuilds only the chat-svc image (data volumes are NEVER touched)
#   3. Recreates the 3 chat containers with the fix applied
#   4. Waits for Cassandra to be healthy before starting chat services
#   5. Prints the final status of every container
#
# Data safety:
#   - postgres_data, redis_data, cassandra_data volumes are NEVER removed
#   - Only the chat container process is restarted (not the DB containers)
#   - `docker compose up --no-recreate` is used for DB/Redis/Cassandra so
#     they are not touched at all
#
# Usage:
#   chmod +x fix-docker.sh
#   ./fix-docker.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

# ── Colour helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*"; exit 1; }
step()    { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

# ── Find Docker socket (Mac Docker Desktop) ────────────────────────────────
DOCKER_SOCKETS=(
  "/Users/$USER/.docker/run/docker.sock"
  "$HOME/.docker/run/docker.sock"
  "/var/run/docker.sock"
  "$HOME/Library/Containers/com.docker.docker/Data/docker.raw.sock"
)

DOCKER_SOCK=""
for sock in "${DOCKER_SOCKETS[@]}"; do
  if [ -S "$sock" ]; then
    # Test that the daemon actually responds
    if DOCKER_HOST="unix://$sock" docker version &>/dev/null; then
      DOCKER_SOCK="$sock"
      break
    fi
  fi
done

if [ -z "$DOCKER_SOCK" ]; then
  # Last resort: try without specifying host (uses DOCKER_HOST env)
  if docker version &>/dev/null; then
    info "Using default Docker context"
    export DOCKER_HOST=""
  else
    error "Cannot connect to Docker daemon. Make sure Docker Desktop is running."
  fi
else
  export DOCKER_HOST="unix://$DOCKER_SOCK"
  info "Docker socket: $DOCKER_HOST"
fi

# ── Locate docker compose ──────────────────────────────────────────────────
if docker compose version &>/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose &>/dev/null; then
  DC="docker-compose"
else
  error "Neither 'docker compose' nor 'docker-compose' found."
fi

# ── Project root (directory of this script) ────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
info "Project root: $SCRIPT_DIR"

# ─────────────────────────────────────────────────────────────────────────────
step "1 / 5 — Checking infrastructure containers are running"
# ─────────────────────────────────────────────────────────────────────────────

REQUIRED=("digiability_postgres" "digiability_redis" "digiability_cassandra")
for name in "${REQUIRED[@]}"; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  if [ "$STATUS" = "running" ]; then
    success "$name is running"
  else
    warn "$name is $STATUS — starting it..."
    $DC up -d postgres redis cassandra --no-recreate 2>/dev/null || true
    sleep 5
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
step "2 / 5 — Waiting for Cassandra to be healthy (up to 3 minutes)"
# ─────────────────────────────────────────────────────────────────────────────

MAX_WAIT=180
ELAPSED=0
INTERVAL=10

while true; do
  HEALTH=$(docker inspect --format='{{.State.Health.Status}}' digiability_cassandra 2>/dev/null || echo "unknown")
  if [ "$HEALTH" = "healthy" ]; then
    success "Cassandra is healthy"
    break
  fi
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    error "Cassandra did not become healthy in ${MAX_WAIT}s. Check: docker logs digiability_cassandra"
  fi
  info "Cassandra status: ${HEALTH} — waiting... (${ELAPSED}s / ${MAX_WAIT}s)"
  sleep "$INTERVAL"
  ELAPSED=$((ELAPSED + INTERVAL))
done

# ─────────────────────────────────────────────────────────────────────────────
step "3 / 5 — Rebuilding chat-svc image (no data volumes touched)"
# ─────────────────────────────────────────────────────────────────────────────

info "Building chat-svc image..."
$DC build --no-cache chat-svc
success "chat-svc image built"

# ─────────────────────────────────────────────────────────────────────────────
step "4 / 5 — Restarting the 3 chat containers"
# ─────────────────────────────────────────────────────────────────────────────

# Stop and remove only the chat containers (NOT the data containers or volumes)
info "Stopping crashed chat containers..."
docker rm -f digiability_chat_svc digiability_chat_msg_worker digiability_chat_delivery_worker 2>/dev/null || true

info "Starting chat services with updated image..."
$DC up -d chat-svc chat-msg-worker chat-delivery-worker

# ─────────────────────────────────────────────────────────────────────────────
step "5 / 5 — Verifying all containers"
# ─────────────────────────────────────────────────────────────────────────────

info "Waiting 20s for chat services to initialize (Cassandra schema creation)..."
sleep 20

# Check chat-svc logs for the success marker
echo ""
info "chat-svc startup log (last 20 lines):"
docker logs digiability_chat_svc --tail 20 2>&1 || true

echo ""
info "Container status:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(digiability|NAME)" || docker ps

echo ""
# Final verdict
ALL_OK=true
for name in digiability_postgres digiability_redis digiability_cassandra digiability_user_svc digiability_chat_svc digiability_chat_msg_worker digiability_chat_delivery_worker; do
  STATUS=$(docker inspect --format='{{.State.Status}}' "$name" 2>/dev/null || echo "missing")
  if [ "$STATUS" = "running" ]; then
    success "$name ✓ running"
  else
    warn "$name ✗ $STATUS"
    ALL_OK=false
  fi
done

echo ""
if [ "$ALL_OK" = "true" ]; then
  echo -e "${GREEN}${BOLD}🎉 All services are running! Everything is healthy.${RESET}"
  echo ""
  echo -e "  ${CYAN}chat-svc API:${RESET}  http://localhost:4002"
  echo -e "  ${CYAN}user-svc API:${RESET}  http://localhost:4001"
  echo -e "  ${CYAN}PostgreSQL:${RESET}    localhost:5432"
  echo -e "  ${CYAN}Redis:${RESET}         localhost:6379"
  echo -e "  ${CYAN}Cassandra:${RESET}     localhost:9042"
  echo ""
  echo -e "  ${YELLOW}forum-svc / group-svc:${RESET} Run separately → cd services/forum-svc && npm run dev"
else
  echo -e "${RED}${BOLD}⚠  Some services are not running. Check logs above.${RESET}"
  echo -e "  Run: docker logs digiability_chat_svc --tail 50"
fi
