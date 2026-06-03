#!/bin/sh
# Briar Bot Docker Entrypoint Script

# This script runs as root to fix permissions, then switches to briar-bot

# Ensure cache directory exists
if [ ! -d "/app/cache" ]; then
    mkdir -p /app/cache
fi

if [ ! -d "/app/cache/heroes" ]; then
    mkdir -p /app/cache/heroes
fi

# Fix ownership - only if we're root (UID 0)
if [ "$(id -u)" = "0" ]; then
    echo "Running as root, fixing permissions..."
    chown -R briar-bot:briar-bot /app/cache 2>/dev/null || echo "Warning: Could not change cache ownership"
    if [ -d "/app/logs" ]; then
        chown -R briar-bot:briar-bot /app/logs 2>/dev/null || echo "Warning: Could not change logs ownership"
    fi
    # Switch to briar-bot user
    exec su-exec briar-bot "$@"
else
    echo "Running as non-root user $(id -u), skipping permission changes"
    # Just run directly
    exec "$@"
fi