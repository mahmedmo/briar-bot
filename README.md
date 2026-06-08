<div align="center">

# Briar Bot

**Epic Seven Discord bot for character build data and guild war reminders.**

Look up popular builds, gear sets, artifacts, and benchmark stats directly from Discord.

[![Docker](https://img.shields.io/badge/ghcr.io-2496ED?logo=docker&logoColor=white)](Dockerfile)
[![License](https://img.shields.io/badge/license-GPL--3.0-F47C3C)](LICENSE)

<img width="200" alt="Briar Bot icon" src="assets/briar-bot.png" />

</div>

## About

Briar Bot is a Discord bot for Epic Seven build lookups. It turns character names and aliases into visual build reports with common stat ranges, gear sets, artifact usage, and related build data.

It is intended for private Discord servers, guild communities, and home-server deployments that want quick Epic Seven build references without leaving chat.

## Features

- Look up Epic Seven character build data from Discord
- Show common stat benchmarks, gear sets, and artifacts
- Generate visual build report cards
- Support aliases and shorthand character names
- Send optional guild war attack and defense reminders
- Publish container images to GitHub Container Registry

## Screenshots

<p><strong>Build Lookup</strong></p>

<img width="250" alt="Briar Bot character build response" src="example.png" />

## Usage

Character lookups:

```text
!arbiter vildred
!luna
!seaside bellona
```

Guild war announcement tests:

```text
!testguildwar both
!testguildwar attack
!testguildwar defense
```

## Deployment

Briar Bot runs as a single Docker Compose service and stores runtime cache and logs in local bind mounts.

The published container image is available from GitHub Container Registry:

```bash
docker pull ghcr.io/mahmedmo/briar-bot:latest
```

For Docker Compose deployments, copy `.env.template` to `.env`, fill in the required Discord token, then start the bot:

```bash
docker compose pull
docker compose up -d
```

To install the optional automatic updater on a server:

```bash
bash scripts/install-updater.sh 5
```

The updater runs `scripts/update-briar-bot.sh`, pulls the configured image, and recreates the bot when a new image is available.

### Workflows

- **Manage Character Data** adds or updates a character name plus optional aliases like `spoli` or `sea politis`, validates the data, and commits the change back to the selected branch.
- **Publish Container** validates character data, builds the Docker image, and publishes fresh `latest` and SHA-tagged images to GHCR on pushes to `main` or manual runs.

### Configuration

| Variable | Requirement | Description | Default |
| -------- | ----------- | ----------- | ------- |
| `BOT_TOKEN` | Required | Discord bot token from the Discord Developer Portal | - |
| `GUILD_WAR_ANNOUNCEMENT_CHANNELS` | Optional | Comma-separated Discord channel IDs for guild war reminders. Empty disables reminders. | - |
| `CACHE_TTL_DAYS` | Optional | Number of days to keep cached data | `30` |
| `CACHE_MAX_SIZE` | Optional | Maximum cache entries | `500` |
| `RATE_LIMIT_MAX_RETRIES` | Optional | Maximum retry attempts for rate-limited requests | `12` |
| `MAX_MEMORY_RESTART` | Optional | Memory threshold used by runtime cleanup logic | `1024M` |

## Development

For local development:

```bash
npm install
npm run dev
```

For production-like local startup:

```bash
npm start
```

Run the test suite:

```bash
npm test
npm run test:character-data
```

## Transparency

AI assisted with implementation, debugging, and refactoring. Human implementation, direction, review, testing, and product decisions guided the project.

## Credits

Briar Bot uses build data aggregation from [Fribbels Epic 7 Optimizer](https://github.com/fribbels/Fribbels-Epic-7-Optimizer).
