# Roles Bot

Production-ready Discord.js bot for **voice leveling**, **rank role rewards**, **loot boxes**, **VIP+**, **reputation**, and a configurable **achievement engine**.

Rebuilt from a legacy monolithic script (`message.txt`). See [docs/ORIGINAL_SYSTEM.md](docs/ORIGINAL_SYSTEM.md) for the reverse-engineering report.

**Deploying to ModVC?** → see **[MODVC.md](MODVC.md)** and upload `dist/roles-bot-modvc.zip`.

---

## Features

- Voice XP every 3 minutes (VIP+ boost, anti-AFK / mute filters)
- Rank ladder with exclusive role sync and reward boxes
- Configurable achievement engine (XP, level, voice time, reputation, …)
- VIP+ timed / lifetime memberships + name colors
- Loot boxes with optional VIP lottery rolls
- Slash commands + legacy `$` prefix aliases
- Pure-JS JSON storage (no native modules — works on ModVC / free hosts)
- Central `RoleManager` (exclusive groups, hierarchy checks, temporary roles)
- Structured logging, cooldowns, graceful shutdown

---

## Installation

### Requirements

- Node.js **18+**
- Privileged Intents: Server Members + Message Content
- Bot permissions: Manage Roles, Send Messages, Embed Links
- Bot role above rank / color / VIP roles

### Setup

```bash
npm install
cp .env.example .env
```

Set `DISCORD_TOKEN` in `.env`, fix `config/ranks.json` Bronze V role ID, then:

```bash
npm start
```

### Pack for ModVC

```bash
npm run pack:modvc
```

Creates `dist/roles-bot-modvc.zip`. Full steps: [MODVC.md](MODVC.md).

> **Security:** Revoke any token that appeared in `message.txt`. Never upload tokens in the ZIP — use ModVC env vars.

---

## Configuration

| File | Purpose |
|------|---------|
| `config/config.json` | Guild, VIP/admin roles, voice rates, cooldowns, features |
| `config/ranks.json` | Rank ladder + role IDs |
| `config/colors.json` | VIP+ name colors |
| `config/boxes.json` | Loot tables |
| `config/achievements.json` | Achievements |
| `config/messages.json` | User-facing strings |
| `.env` | `DISCORD_TOKEN` (local); on ModVC use panel env |

Data lives in `data/bot.json` (created at runtime).

---

## Folder structure

```
index.js                 Panel entrypoint (ModVC)
src/                     Application code
config/                  Tunables
docs/                    Legacy reverse-engineering notes
scripts/                 pack-modvc, migrate, register-commands
dist/                    Upload ZIP output
```

---

## Commands

Slash: `/top`, `/color`, `/profile`, `/levelup`, `/boxes`, `/membership`, `/modifier`, `/rep`, `/achievements`, `/sync`, `/givevipplus`, `/givebox`, `/setlevel`, `/setxp`

Prefix aliases: `$p`, `$levelup`, `$boxes`, `$membership`, `$modifier`, `$rep`, `$achievements`, `$sync`, `$givevipplus`, `$givebox`, `$setlevel`, `$setxp`

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm start` | Run the bot |
| `npm run pack:modvc` | Build ModVC upload ZIP |
| `npm run register-commands` | Register slash commands |
| `npm run migrate:quickdb` | Import legacy QuickDB data |

More detail on achievements and extending the bot: see earlier docs in this repo and [docs/ORIGINAL_SYSTEM.md](docs/ORIGINAL_SYSTEM.md).
# Ultra-Discord-Roles-Bot-2026-By-ELTG
