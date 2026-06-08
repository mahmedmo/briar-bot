#!/bin/bash

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
LOCK_DIR="${TMPDIR:-/tmp}/briar-bot-auto-update.lock"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
	echo "[briar-bot-auto-update] ${TIMESTAMP} update already in progress"
	exit 0
fi

cleanup() {
	rmdir "$LOCK_DIR"
}

trap cleanup EXIT

cd "$REPO_ROOT"

echo "[briar-bot-auto-update] ${TIMESTAMP} checking for image updates"
docker compose -f "$COMPOSE_FILE" pull briar-bot
docker compose -f "$COMPOSE_FILE" up -d --no-deps --remove-orphans briar-bot
echo "[briar-bot-auto-update] ${TIMESTAMP} update check complete"
