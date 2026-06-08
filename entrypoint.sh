#!/bin/sh

if [ ! -d "/app/cache" ]; then
    mkdir -p /app/cache
fi

if [ ! -d "/app/cache/heroes" ]; then
    mkdir -p /app/cache/heroes
fi

if [ "$(id -u)" = "0" ]; then
    chown -R briar-bot:briar-bot /app/cache 2>/dev/null || echo "Warning: Could not change cache ownership"
    if [ -d "/app/logs" ]; then
        chown -R briar-bot:briar-bot /app/logs 2>/dev/null || echo "Warning: Could not change logs ownership"
    fi
    exec su-exec briar-bot "$@"
else
    exec "$@"
fi
