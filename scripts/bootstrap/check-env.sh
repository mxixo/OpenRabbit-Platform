#!/usr/bin/env bash
set -euo pipefail

REQUIRED_CMDS=(git node npm bash)
MISSING=()

for cmd in "${REQUIRED_CMDS[@]}"; do
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    MISSING+=("${cmd}")
  fi
done

if [ "${#MISSING[@]}" -gt 0 ]; then
  printf "Missing required tooling: %s\n" "${MISSING[*]}"
  exit 1
fi

echo "Environment baseline check passed."
