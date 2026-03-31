#!/bin/bash

# Runs each spike test scenario individually and saves separate HTML reports.
# This avoids overloading the server with 9,000 concurrent VUs.
#
# Usage:
#   chmod +x tests/spike/run-all-scenarios.sh
#   ./tests/spike/run-all-scenarios.sh
#
# Output: tests/spike/report-after-<scenario>.html for each scenario

set -e

REPORT_DIR="tests/spike"
SCRIPT="tests/spike/spike.test.js"

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
echo " Running all spike scenarios one by one"
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
echo " All scenarios complete!"
echo "========================================"
echo ""
echo "Reports saved in $REPORT_DIR/:"
for SCENARIO in "${SCENARIOS[@]}"; do
  echo "  - report-after-$SCENARIO.html"
done
