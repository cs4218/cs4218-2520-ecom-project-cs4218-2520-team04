#!/bin/bash

# Tan Wei Lian, A0269750U
#
# Runs the stress suite across a configurable peak-VU ladder and exports
# separate HTML dashboard reports for each scenario at each load level.
#
# Default ladder:
#   100,200,400,600,800,1200
#
# Optional env vars:
#   STRESS_LADDER=100,200,400,600,800,1200
#   STRESS_BASE_VUS_RATIO=0.25
#   STRESS_HIGH_VUS_RATIO=0.5
#
# Example:
#   STRESS_LADDER=100,300,500 bash tests/stress/run-ladder.sh

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
SCENARIOS=("auth" "catalog" "orders")

LADDER_CSV="${STRESS_LADDER:-100,200,400,600,800,1200}"
BASE_RATIO="${STRESS_BASE_VUS_RATIO:-0.25}"
HIGH_RATIO="${STRESS_HIGH_VUS_RATIO:-0.5}"

sanitize_ratio() {
  printf "%s" "$1" | tr -d '[:space:]'
}

compute_ratio_target() {
  local peak="$1"
  local ratio="$2"

  awk -v peak="$peak" -v ratio="$ratio" 'BEGIN {
    value = int((peak * ratio) + 0.5);
    if (value < 1) value = 1;
    print value;
  }'
}

echo "==============================================="
echo " Running stress ladder across peak VU levels"
echo "==============================================="
echo "Base URL: $BASE_URL"
echo "Peak ladder: $LADDER_CSV"
echo ""

OLD_IFS="$IFS"
IFS=','
read -r -a PEAK_LEVELS <<< "$LADDER_CSV"
IFS="$OLD_IFS"

for RAW_PEAK in "${PEAK_LEVELS[@]}"; do
  PEAK_VUS="$(printf "%s" "$RAW_PEAK" | tr -d '[:space:]')"

  if ! [[ "$PEAK_VUS" =~ ^[0-9]+$ ]] || [ "$PEAK_VUS" -le 0 ]; then
    echo "[ SKIP ] Invalid peak VU value: $RAW_PEAK"
    continue
  fi

  BASE_VUS="$(compute_ratio_target "$PEAK_VUS" "$(sanitize_ratio "$BASE_RATIO")")"
  HIGH_VUS="$(compute_ratio_target "$PEAK_VUS" "$(sanitize_ratio "$HIGH_RATIO")")"

  echo "-----------------------------------------------"
  echo " Peak VUs: $PEAK_VUS"
  echo " Derived base/high/peak: $BASE_VUS / $HIGH_VUS / $PEAK_VUS"
  echo "-----------------------------------------------"
  echo ""

  for SCENARIO in "${SCENARIOS[@]}"; do
    REPORT_PATH="$REPORT_DIR/report-${SCENARIO}-peak-${PEAK_VUS}.html"

    echo "[ RUNNING ] scenario=$SCENARIO peak=$PEAK_VUS"
    echo "  Output: $REPORT_PATH"
    echo ""

    k6 run \
      -e SCENARIO="$SCENARIO" \
      -e STRESS_BASE_VUS="$BASE_VUS" \
      -e STRESS_HIGH_VUS="$HIGH_VUS" \
      -e STRESS_PEAK_VUS="$PEAK_VUS" \
      --out "web-dashboard=export=$REPORT_PATH" \
      "$SCRIPT" || true

    echo ""
    echo "[ DONE ] scenario=$SCENARIO peak=$PEAK_VUS"
    echo ""
    echo "Waiting 10s before next run to let server recover..."
    sleep 10
  done
done

echo "==============================================="
echo " Stress ladder complete"
echo "==============================================="
