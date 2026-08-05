#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ] || [ "$#" -gt 2 ]; then
  echo "Usage: $0 <release-tag> [--execute]"
  exit 1
fi

RELEASE_TAG="$1"
MODE="${2:---dry-run}"

if [ "${MODE}" != "--dry-run" ] && [ "${MODE}" != "--execute" ]; then
  echo "Invalid mode: ${MODE}"
  echo "Allowed modes: --dry-run, --execute"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ROLLOUT_FILE="${REPO_ROOT}/deploy/production/rollout-strategy.yaml"
SERVICES_FILE="${REPO_ROOT}/deploy/production/services.yaml"

for required_file in "${ROLLOUT_FILE}" "${SERVICES_FILE}"; do
  if [ ! -f "${required_file}" ]; then
    echo "Missing required deployment file: ${required_file}"
    exit 1
  fi
done

CURRENT_BRANCH="$(git -C "${REPO_ROOT}" rev-parse --abbrev-ref HEAD)"
if [ "${CURRENT_BRANCH}" != "main" ]; then
  if [ "${MODE}" = "--execute" ]; then
    echo "Production deployment must run from main branch. Current branch: ${CURRENT_BRANCH}"
    exit 1
  fi
  echo "Warning: not on main branch (current: ${CURRENT_BRANCH}; allowed for dry-run)."
fi

if ! git -C "${REPO_ROOT}" diff --quiet || ! git -C "${REPO_ROOT}" diff --cached --quiet; then
  if [ "${MODE}" = "--execute" ]; then
    echo "Working tree must be clean before production rollout execution."
    exit 1
  fi
  echo "Warning: working tree is not clean (allowed for dry-run)."
fi

echo "Release tag: ${RELEASE_TAG}"
echo "Mode: ${MODE#--}"
echo "Using rollout config: ${ROLLOUT_FILE}"
echo "Using services config: ${SERVICES_FILE}"
echo ""
echo "Validating rollout/service YAML files..."
ruby -e 'require "yaml"; YAML.load_file(ARGV[0]); YAML.load_file(ARGV[1]); puts "YAML validation passed."' \
  "${ROLLOUT_FILE}" "${SERVICES_FILE}"
echo ""

echo "Production rollout stages:"
ruby -e 'require "yaml"; c=YAML.load_file(ARGV[0]); (c.dig("deployment","execution_order") || []).each_with_index { |s,i| puts "#{i+1}. #{s}" }' \
  "${ROLLOUT_FILE}"
echo ""

echo "Service deployment order:"
ruby -e 'require "yaml"; c=YAML.load_file(ARGV[0]); (c["services"] || []).sort_by { |s| s["deploy_order"] || 999 }.each { |s| puts "- ##{s["deploy_order"]}: #{s["name"]} (min_instances=#{s["min_instances"]})" }' \
  "${SERVICES_FILE}"
echo ""

if [ "${MODE}" = "--dry-run" ]; then
  echo "Dry run complete. No deployment actions were executed."
  exit 0
fi

echo "Executing production rollout phases (simulation)."
for stage in preflight canary full_rollout post_verify; do
  echo "-> ${stage}"
done
echo "Rollout execution simulation complete for release ${RELEASE_TAG}."
echo "Apply your platform-specific deployment commands for each stage."
