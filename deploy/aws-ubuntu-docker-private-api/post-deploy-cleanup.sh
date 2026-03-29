#!/bin/sh

set -eu

IMAGE_PRUNE_UNTIL="${DEPLOY_IMAGE_PRUNE_UNTIL:-168h}"
BUILDER_PRUNE_UNTIL="${DEPLOY_BUILDER_PRUNE_UNTIL:-168h}"
JOURNAL_VACUUM_TIME="${DEPLOY_JOURNAL_VACUUM_TIME:-7d}"

log() {
  printf '%s\n' "$1"
}

run_optional() {
  "$@" || true
}

log "Deployment succeeded, starting post-deploy cleanup..."

run_optional docker container prune -f
run_optional docker image prune -af --filter "until=${IMAGE_PRUNE_UNTIL}"
run_optional docker volume prune -f
run_optional docker builder prune -af --filter "until=${BUILDER_PRUNE_UNTIL}"

if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    run_optional sudo -n apt-get autoremove -y
    run_optional sudo -n apt-get clean
  fi

  if command -v journalctl >/dev/null 2>&1; then
    run_optional sudo -n journalctl --vacuum-time="${JOURNAL_VACUUM_TIME}"
  fi
else
  log "Skipping apt/journal cleanup because passwordless sudo is unavailable."
fi

run_optional docker system df
