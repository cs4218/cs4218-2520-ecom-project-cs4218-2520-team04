#!/bin/bash

# Mervyn Teo Zi Yan, A0273039A
#
# Runs each volume test scenario individually and saves separate HTML reports.
# Each scenario runs with sustained load (200 VUs for 5 minutes) to verify
# system stability under prolonged high-volume traffic.
#
# Usage:
#   chmod +x tests/volume/run-all-scenarios.sh
#   ./tests/volume/run-all-scenarios.sh
#
# Output: tests/volume/report-after-<scenario>.html for each scenario

set -e

REPORT_DIR="tests/volume"
SCRIPT="tests/volume/volume.test.js"

# Mervyn Teo Zi Yan, A0273039A
SCENARIOS=(
  "auth"
  "products"
  "categories"
  "search"
  "filters"
  "single_product"
  "related_products"
  "category_products"
  "user_orders"
)

echo "========================================"
echo " Running all volume test scenarios"
echo " (sustained load: 200 VUs for 5 min)"
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
  echo "Waiting 15s before next scenario to let server recover..."
  sleep 15
done

echo "========================================"
echo " All volume test scenarios complete!"
echo "========================================"
echo ""
echo "Reports saved in $REPORT_DIR/:"
for SCENARIO in "${SCENARIOS[@]}"; do
  echo "  - report-after-$SCENARIO.html"
done
