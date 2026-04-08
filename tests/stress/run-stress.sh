#!/bin/bash

# Tan Wei Lian, A0269750U
#
# Loads local .env values before invoking k6 so the stress suite stays aligned
# with the app's configured port and any optional stress-related env vars.

set -e

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BASE_PORT="${PORT:-6060}"
export BASE_URL="${BASE_URL:-http://localhost:${BASE_PORT}}"

exec k6 run "$@"
