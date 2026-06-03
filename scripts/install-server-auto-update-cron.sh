#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INTERVAL_MINUTES="${1:-5}"
LOG_FILE="$REPO_ROOT/logs/auto-update.log"
SCRIPT_PATH="$REPO_ROOT/scripts/server-auto-update.sh"

if ! [[ "$INTERVAL_MINUTES" =~ ^[0-9]+$ ]] || [ "$INTERVAL_MINUTES" -lt 1 ] || [ "$INTERVAL_MINUTES" -gt 59 ]; then
	echo "Usage: $0 [interval-minutes]"
	echo "Interval must be an integer from 1 to 59."
	exit 1
fi

mkdir -p "$REPO_ROOT/logs"

CRON_JOB="*/${INTERVAL_MINUTES} * * * * cd \"$REPO_ROOT\" && /bin/bash \"$SCRIPT_PATH\" >> \"$LOG_FILE\" 2>&1"
EXISTING_CRONTAB="$(crontab -l 2>/dev/null || true)"
FILTERED_CRONTAB="$(printf '%s\n' "$EXISTING_CRONTAB" | grep -Fv "$SCRIPT_PATH" || true)"

if [ -n "$FILTERED_CRONTAB" ]; then
	printf '%s\n%s\n' "$FILTERED_CRONTAB" "$CRON_JOB" | crontab -
else
	printf '%s\n' "$CRON_JOB" | crontab -
fi

echo "Installed Briar Bot auto-update cron job:"
echo "$CRON_JOB"
echo ""
echo "Logs will be written to $LOG_FILE"
