#!/usr/bin/env bash
set -u

# ==============================
# Configuration
# ==============================
MEDIATOR_HOST="http://localhost:5022"

SLEEP_BETWEEN_CALLS=60
SLEEP_BETWEEN_REGIONS=60
SYNCDHIS2_PERIOD="2025-11"

BASE_DIR="/opt/script_sync"
REGION_FILE="$BASE_DIR/regions.list"
LOG_DIR="$BASE_DIR/logs"
LOG_FILE="$LOG_DIR/sync_pnlpdashboard_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%F %T')] $*" >> "$LOG_FILE"
}

# ==============================
# Sync function (never exits)
# ==============================
run_sync() {
  local region="$1"
  local dhis_periodid="$2"

  log "START region=$region generateDataValues "
  log "START codeOp=2 executed "
  if ! curl -fsS "${MEDIATOR_HOST}/generatedaevalues?regionid=${region}&synchronizationperiod=${dhis_periodid}&codeop=2" >>"$LOG_FILE" 2>&1; then
    log "ERROR codeOp=2 GenerateDatavalues FAILED"
  else
    log "SUCCESS codeOp=2 GenerateDatavalues"
  fi

  sleep "$SLEEP_BETWEEN_CALLS"

  log "START codeOp=3 executed "
  if ! curl -fsS "${MEDIATOR_HOST}/generatedaevalues?regionid=${region}&synchronizationperiod=${dhis_periodid}&codeop=3" >>"$LOG_FILE" 2>&1; then
    log "ERROR codeOp=3 GenerateDatavalues FAILED"
  else
    log "SUCCESS codeOp=3 GenerateDatavalues"
  fi

  sleep "$SLEEP_BETWEEN_CALLS"

  log "START codeOp=4 executed "
  if ! curl -fsS "${MEDIATOR_HOST}/generatedaevalues?regionid=${region}&synchronizationperiod=${dhis_periodid}&codeop=4" >>"$LOG_FILE" 2>&1; then
    log "ERROR codeOp=4 GenerateDatavalues FAILED"
  else
    log "SUCCESS codeOp=4 GenerateDatavalues"
  fi
}

# ==============================
# Main loop (LIST-DRIVEN)
# ==============================
log "===== BATCH START SYNC PNLP DASHBOARD INDICATORS====="

while IFS= read -r region || [[ -n "$region" ]]; do
  # skip empty lines and comments
  [[ -z "$region" || "$region" =~ ^# ]] && continue

  run_sync "$region" "2025-11"
  sleep "$SLEEP_BETWEEN_REGIONS"

done < "$REGION_FILE"

log "===== BATCH END ====="
