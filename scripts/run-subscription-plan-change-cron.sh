#!/usr/bin/env bash

set -euo pipefail

APP_DIR="${APP_DIR:-/root/ryaneko-license}"
SUBSCRIPTION_CRON_URL="${SUBSCRIPTION_CRON_URL:-https://license.ryanekoapp.web.id/api/cron/subscription-plan-changes}"

if [[ -f "$APP_DIR/.env.local" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$APP_DIR/.env.local"
  set +a
fi

if [[ -z "${SUBSCRIPTION_CRON_SECRET:-}" ]]; then
  echo "SUBSCRIPTION_CRON_SECRET is not configured" >&2
  exit 1
fi

curl -fsS \
  -X POST \
  -H "Authorization: Bearer $SUBSCRIPTION_CRON_SECRET" \
  "$SUBSCRIPTION_CRON_URL"
