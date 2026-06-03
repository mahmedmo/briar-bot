#!/bin/bash

# Briar Bot Deployment Script
# Local mode: pulls git + rebuilds from source
# Server image mode: pulls the published container image instead

set -e  # Exit on error

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
COMPOSE_CMD=(docker compose -f "$COMPOSE_FILE")

echo "🌙 Briar Bot Deployment"
echo "======================"
echo ""

if [ "$COMPOSE_FILE" = "docker-compose.server.yml" ] || [ -n "${BRIAR_BOT_IMAGE:-}" ]; then
	echo "Pulling latest published image..."
	"${COMPOSE_CMD[@]}" pull briar-bot
	echo ""
else
	echo "Pulling latest code from git..."
	git pull origin main
	echo ""

	echo "Building Docker image (no cache)..."
	"${COMPOSE_CMD[@]}" build --no-cache
	echo ""
fi

echo "Stopping containers..."
"${COMPOSE_CMD[@]}" down
echo ""

echo "Starting containers..."
"${COMPOSE_CMD[@]}" up -d --remove-orphans
echo ""

echo "✅ Deployment complete!"
echo ""

# Show logs
echo "Container logs (Ctrl+C to exit):"
"${COMPOSE_CMD[@]}" logs -f
