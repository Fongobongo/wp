#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/infra/prod/.env.prod"
FULL_STACK_COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.yml"
WEB_STACK_COMPOSE_FILE="${ROOT_DIR}/docker-compose.prod.web.yml"
LEGACY_BACKEND_SERVICES=(
  game-data-service
  player-service
  matchmaking-service
  battle-service
  economy-service
)

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

echo "Stopping unused WAR PROTOCOL backend containers..."
docker compose \
  -f "${FULL_STACK_COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  stop "${LEGACY_BACKEND_SERVICES[@]}" >/dev/null 2>&1 || true

docker compose \
  -f "${FULL_STACK_COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  rm -f -s "${LEGACY_BACKEND_SERVICES[@]}" >/dev/null 2>&1 || true

echo "Deploying WAR PROTOCOL web-only production stack..."
docker compose \
  -f "${WEB_STACK_COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  up -d --build --remove-orphans

echo "Deployment complete."
echo "Current status:"
docker compose \
  -f "${WEB_STACK_COMPOSE_FILE}" \
  --env-file "${ENV_FILE}" \
  ps
