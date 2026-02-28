#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/infra/prod/.env.prod"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose plugin is not available." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  echo "Create it from infra/prod/.env.prod.example before deployment." >&2
  exit 1
fi

echo "Deploying WAR PROTOCOL production stack..."
docker compose \
  -f "${ROOT_DIR}/docker-compose.prod.yml" \
  --env-file "${ENV_FILE}" \
  up -d --build

echo "Deployment complete."
echo "Current status:"
docker compose \
  -f "${ROOT_DIR}/docker-compose.prod.yml" \
  --env-file "${ENV_FILE}" \
  ps

