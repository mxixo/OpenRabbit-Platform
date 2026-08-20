#!/bin/sh
set -eu

DATA_DIR="${OPENRABBIT_GATEWAY_DATA_DIR:-/data}"
KEY_FILE="$DATA_DIR/token-encryption.key"

mkdir -p "$DATA_DIR"

if [ -z "${OPENRABBIT_TOKEN_ENCRYPTION_KEY:-}" ]; then
  if [ ! -s "$KEY_FILE" ]; then
    umask 077
    node -e "process.stdout.write(require('crypto').randomBytes(48).toString('base64url'))" > "$KEY_FILE"
  fi
  export OPENRABBIT_TOKEN_ENCRYPTION_KEY="$(cat "$KEY_FILE")"
fi

exec node services/connection-gateway/server.js
