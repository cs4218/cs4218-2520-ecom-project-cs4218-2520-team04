#!/bin/bash

# Tan Wei Lian, A0269750U
#
# Runs each stress scenario individually and exports one HTML dashboard report
# per scenario. Running them separately avoids multiplying concurrent VUs across
# scenarios and makes bottlenecks easier to attribute.

set -e

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

BASE_PORT="${PORT:-6060}"
export BASE_URL="${BASE_URL:-http://localhost:${BASE_PORT}}"

REPORT_DIR="tests/stress"
SCRIPT="tests/stress/stress.test.js"

SCENARIOS=(
  "auth"
  "catalog"
  "orders"
)

echo "========================================"
echo " Running all stress scenarios one by one"
echo "========================================"
echo ""

for SCENARIO in "${SCENARIOS[@]}"; do
  echo "[ RUNNING ] $SCENARIO..."
  echo "  Output: $REPORT_DIR/report-after-$SCENARIO.html"
  echo ""

  k6 run \
    -e SCENARIO="$SCENARIO" \
    --out "web-dashboard=export=$REPORT_DIR/report-after-$SCENARIO.html" \
    "$SCRIPT" || true

  echo ""
  echo "[ DONE ] $SCENARIO — report saved."
  echo ""
  echo "Waiting 10s before next scenario to let server recover..."
  sleep 10
done

echo "========================================"
echo " All stress scenarios complete!"
echo "========================================"
echo ""
echo "Reports saved in $REPORT_DIR/:"
for SCENARIO in "${SCENARIOS[@]}"; do
  echo "  - report-after-$SCENARIO.html"
done
