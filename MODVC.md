# Deploy on ModVC

This project is packaged for a **direct ZIP upload** to [ModVC](https://modvc.org) (free Discord bot hosting).

## What’s already ModVC-ready

- Root `index.js` + `"start": "node index.js"` (panel default)
- **No native modules** (JSON database instead of `better-sqlite3`)
- Secrets via environment variables / `.env` on the panel
- `dist/roles-bot-modvc.zip` built by `npm run pack:modvc`

## Upload steps

1. On your PC (optional — zip may already exist):

   ```bash
   npm run pack:modvc
   ```

2. Open the ModVC dashboard → create / open your bot server.

3. Upload **`dist/roles-bot-modvc.zip`** (or extract and upload the folder contents so `index.js` and `package.json` are at the **server root**).

4. Set the environment variable (Startup / Environment tab):

   | Variable | Value |
   |----------|--------|
   | `DISCORD_TOKEN` | your **new** bot token |

   Optional:

   | Variable | Value |
   |----------|--------|
   | `GUILD_ID` | your Discord server ID |
   | `DATABASE_PATH` | `./data/bot.json` |

5. Confirm startup file / command:

   - **Main file:** `index.js`
   - **Start command:** `npm start` or `node index.js`
   - **Node.js:** 18+ (20 LTS preferred)

6. Start the server. First boot runs `npm install`, then launches the bot.

7. In Discord Developer Portal, enable:
   - Server Members Intent
   - Message Content Intent

8. Put the bot role **above** rank / color / VIP roles.

## Do not upload

- `node_modules/` (panel installs deps)
- `.env` with secrets in the ZIP (use panel env vars)
- `message.txt` (legacy source containing a leaked token)
- `data/` (runtime DB — let the host create it)

## After upload checklist

- [ ] Fix Bronze V role ID in `config/ranks.json` if still a placeholder
- [ ] Confirm `config/config.json` guild / role IDs
- [ ] Regenerate Discord token if it was ever in `message.txt`
- [ ] Watch console for: `Logged in as ...`
