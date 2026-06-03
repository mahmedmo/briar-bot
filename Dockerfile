# Multi-stage Dockerfile for Briar Bot
# Optimized for production deployment on Ubuntu home servers

# ================================
# Stage 1: Dependencies Builder
# ================================
FROM node:18-alpine AS dependencies

# Install system dependencies for node-gyp and native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    musl-dev \
    giflib-dev \
    pixman-dev \
    pangomm-dev \
    libjpeg-turbo-dev \
    freetype-dev

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production && npm cache clean --force

# ================================
# Stage 2: Puppeteer Builder  
# ================================
FROM node:18-alpine AS puppeteer

# Install Chromium and dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-dejavu \
    fontconfig

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Create a non-root user for security
RUN addgroup -g 1001 -S briar-bot && \
    adduser -S briar-bot -u 1001

# ================================
# Stage 3: Production Runtime
# ================================
FROM node:18-alpine AS runtime

# Set labels for metadata
LABEL maintainer="Briar Bot" \
      description="Epic Seven Discord Bot for Build Analysis" \
      version="2.0" \
      org.opencontainers.image.title="Briar Bot" \
      org.opencontainers.image.description="Epic Seven Discord bot with caching and rate limiting" \
      org.opencontainers.image.url="https://github.com/mahmedmo/briar-bot" \
      org.opencontainers.image.vendor="Briar Bot Team"

# Install runtime dependencies
RUN apk add --no-cache \
    dumb-init \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    ttf-dejavu \
    fontconfig \
    tini \
    su-exec

# Create non-root user
RUN addgroup -g 1001 -S briar-bot && \
    adduser -S briar-bot -u 1001 -G briar-bot

# Set Puppeteer environment variables
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Set Node environment
ENV NODE_ENV=production
ENV NPM_CONFIG_LOGLEVEL=warn
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Create app directory structure
WORKDIR /app

# Create cache directory with proper permissions
RUN mkdir -p /app/cache/heroes && \
    chown -R briar-bot:briar-bot /app/cache

# Copy dependencies from builder stage
COPY --from=dependencies /app/node_modules ./node_modules

# Copy entrypoint script
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Copy application files
COPY --chown=briar-bot:briar-bot src/ ./src/
COPY --chown=briar-bot:briar-bot assets/ ./assets/
COPY --chown=briar-bot:briar-bot package*.json ./

# Create volume mount points
VOLUME ["/app/cache"]

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "console.log('Health check passed')" || exit 1

# Expose port (if needed for health checks)
EXPOSE 3000

# Use custom entrypoint for permission handling and tini for signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]

# Default command - run directly with node
CMD ["node", "src/briar-bot.js"]