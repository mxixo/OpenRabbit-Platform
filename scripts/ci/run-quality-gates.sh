#!/usr/bin/env bash
set -euo pipefail

run_pkg_checks() {
  local dir="$1"
  printf "\n==> Quality checks: %s\n" "${dir}"
  cd "${REPO_ROOT}/${dir}"
  npm ci --silent
  npm test
  npx tsc --noEmit -p tsconfig.json
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

run_pkg_checks "packages/runtime-core"
run_pkg_checks "mcp/contracts"
run_pkg_checks "mcp/servers"
run_pkg_checks "services/orchestrator"
run_pkg_checks "services/workflow-engine"

echo ""
echo "All quality gates passed."
