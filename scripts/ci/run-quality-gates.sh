#!/usr/bin/env bash
set -euo pipefail
ACTIVE_TS_PACKAGES=(
  "packages/runtime-core"
  "mcp/contracts"
  "mcp/servers"
  "mcp/adapters"
  "services/orchestrator"
  "services/workflow-engine"
  "services/api-gateway"
  "services/model-gateway"
  "services/policy"
  "services/memory"
  "services/skills"
  "services/workflows"
  "services/clients"
)

ensure_required_script() {
  local script_name="$1"
  if ! node -e "const fs=require('fs');const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));process.exit(pkg.scripts&&pkg.scripts['${script_name}']?0:1)"; then
    echo "Missing required npm script '${script_name}' in $(pwd)/package.json"
    return 1
  fi
}

run_pkg_checks() {
  local dir="$1"
  printf "\n==> Quality checks: %s\n" "${dir}"
  cd "${REPO_ROOT}/${dir}"
  npm ci --silent
  ensure_required_script "lint"
  npm run lint
  npm test
  npm exec --yes tsc --noEmit -p tsconfig.json
}

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

for package_dir in "${ACTIVE_TS_PACKAGES[@]}"; do
  run_pkg_checks "${package_dir}"
done

echo ""
echo "All quality gates passed."
