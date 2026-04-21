#!/usr/bin/env bash
set -u

# ==============================
# Configuration
# ==============================
FHIR_HOST="http://10.13.52.210:5022"
MEDIATOR_HOST="http://localhost:5022"

SLEEP_BETWEEN_CALLS=180
SLEEP_BETWEEN_REGIONS=60
SYNCFHIR_PERIODID=161
SYNCDHIS2_PERIOD="2025-11"

BASE_DIR="/opt/script_sync"
REGION_FILE="$BASE_DIR/regions.list"
LOG_DIR="$BASE_DIR/logs"
LOG_FILE="$LOG_DIR/sync_$(date +%Y%m%d).log"

mkdir -p "$LOG_DIR"

log() {
  echo "[$(date '+%F %T')] $*" >> "$LOG_FILE"
}

# ==============================
# Sync function (never exits)
# ==============================
run_sync() {
  local region="$1"
  local fhir_periodid=$2
  local dhis_periodid="$3"

  log "START region=$region sync2fhir"
  if ! curl -fsS "${MEDIATOR_HOST}/syncrequisition2fhir?regionid=${region}&periodid=${fhir_periodid}" >>"$LOG_FILE" 2>&1; then
    log "ERROR region=$region sync2fhir FAILED"
  else
    log "SUCCESS region=$region sync2fhir"
  fi

  sleep "$SLEEP_BETWEEN_CALLS"

  log "START region=$region sync2dhis"
  if ! curl -fsS "${MEDIATOR_HOST}/syncrequisition2dhis?regionid=${region}&synchronizationperiod=${dhis_periodid}" >>"$LOG_FILE" 2>&1; then
    log "ERROR region=$region sync2dhis FAILED"
  else
    log "SUCCESS region=$region sync2dhis"
  fi
}

# ==============================
# Main loop (LIST-DRIVEN)
# ==============================
log "===== BATCH START SYNC PNLP DATA====="

while IFS= read -r region || [[ -n "$region" ]]; do
  # skip empty lines and comments
  [[ -z "$region" || "$region" =~ ^# ]] && continue

  run_sync "$region" 161 "2025-11"
  sleep "$SLEEP_BETWEEN_REGIONS"

done < "$REGION_FILE"

log "===== BATCH END ====="
