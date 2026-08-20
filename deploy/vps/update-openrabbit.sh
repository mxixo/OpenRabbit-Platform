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
sleep 2
curl -fsS http://127.0.0.1:8790/health
echo
echo "OpenRabbit VPS gateway updated and healthy."
