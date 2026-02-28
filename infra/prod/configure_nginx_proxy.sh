#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${ROOT_DIR}/infra/prod/.env.prod"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

DOMAIN="$(grep -E '^DOMAIN=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- || true)"
LE_EMAIL="$(grep -E '^LE_EMAIL=' "${ENV_FILE}" | tail -n1 | cut -d'=' -f2- || true)"

if [[ -z "${DOMAIN}" ]]; then
  echo "DOMAIN is not set in ${ENV_FILE}" >&2
  exit 1
fi

NGINX_CONF_SRC="${ROOT_DIR}/infra/prod/nginx.play.hadoop21.click.conf"
NGINX_CONF_DST="/etc/nginx/sites-available/${DOMAIN}.conf"
NGINX_CONF_LINK="/etc/nginx/sites-enabled/${DOMAIN}.conf"

if ! command -v nginx >/dev/null 2>&1; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y nginx
fi

cp "${NGINX_CONF_SRC}" "${NGINX_CONF_DST}"
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${NGINX_CONF_DST}"

ln -sf "${NGINX_CONF_DST}" "${NGINX_CONF_LINK}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "Nginx proxy configured for ${DOMAIN} -> 127.0.0.1:8080"

if [[ -n "${LE_EMAIL}" ]]; then
  if ! command -v certbot >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y certbot python3-certbot-nginx
  fi

  certbot --nginx \
    -d "${DOMAIN}" \
    --non-interactive \
    --agree-tos \
    -m "${LE_EMAIL}" \
    --redirect

  systemctl reload nginx
  echo "TLS certificate configured for ${DOMAIN}"
else
  echo "LE_EMAIL is not set. Skipping certbot step (HTTP-only proxy active)."
fi
