#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <from-env> <to-env>"
  exit 1
fi

FROM_ENV="$1"
TO_ENV="$2"

case "${FROM_ENV}:${TO_ENV}" in
  dev:staging|staging:prod)
    ;;
  *)
    echo "Invalid promotion path: ${FROM_ENV} -> ${TO_ENV}"
    echo "Allowed paths: dev -> staging, staging -> prod"
    exit 1
    ;;
esac

echo "Promotion path validated: ${FROM_ENV} -> ${TO_ENV}"
echo "Apply required gates from deploy/release-checklists/promotion-gates.md before rollout."
