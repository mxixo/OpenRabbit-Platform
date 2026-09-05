#!/usr/bin/env bash
set -euo pipefail
ROOT="${OPENRABBIT_ROOT:-/opt/openrabbit/OpenRabbit-Platform}"
cd "$ROOT"
git fetch origin main
git checkout main
git pull --ff-only origin main
if [ ! -f services/connection-gateway/.env ]; then
  cp services/connection-gateway/.env.example services/connection-gateway/.env
  chmod 600 services/connection-gateway/.env
  echo "Created services/connection-gateway/.env. Fill the OAuth/encryption secrets, then rerun this script."
  exit 2
fi
docker compose -f deploy/vps/docker-compose.yml up -d --build
for attempt in $(seq 1 30); do
  gateway_id="$(docker compose -f deploy/vps/docker-compose.yml ps -q connection-gateway)"
  edge_id="$(docker compose -f deploy/vps/docker-compose.yml ps -q gateway-edge)"
  gateway_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$gateway_id" 2>/dev/null || true)"
  edge_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$edge_id" 2>/dev/null || true)"
  if [ "$gateway_status" = "healthy" ] && [ "$edge_status" = "healthy" ]; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    docker compose -f deploy/vps/docker-compose.yml ps
    docker compose -f deploy/vps/docker-compose.yml logs --tail 100
    echo "OpenRabbit VPS gateway failed to become healthy." >&2
    exit 1
  fi
  sleep 2
done
docker compose -f deploy/vps/docker-compose.yml exec -T connection-gateway node -e "fetch('http://127.0.0.1:8790/health').then(r=>{if(!r.ok)process.exit(1);return r.text()}).then(console.log).catch(()=>process.exit(1))"
echo "OpenRabbit VPS gateway updated and healthy."
