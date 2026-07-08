# stats.fm widget

Single-user Discord bot that keeps your custom **Profile Widget** in sync with live [stats.fm](https://stats.fm) data and Spotify now-playing from Discord presence.

**Top section** — song title, artist, album, and cover art update in real time.

**Bottom 6 cards** — rotate through 4 stat pages every 30 seconds: Top Music, Listening Stats, Last Streamed, and Lifetime.

## Features

- Live now-playing from Discord Spotify presence
- stats.fm tops, listening stats, and lifetime data
- Rotating stat pages with matching header + value fields
- Payload caching — only patches Discord when something changes
- `/ping` and `/status` slash commands

## Requirements

- Node.js 18+
- A Discord application with a bot token
- A public [stats.fm](https://stats.fm) profile
- Spotify connected to Discord (for now-playing)
- The bot invited to a server you are in (for presence)

## Quick start

```bash
git clone https://github.com/akahobby/stats.fm-widget
cd stats.fm-widget
npm install
```

Edit `.env`:

| Variable | Description |
| --- | --- |
| `DISCORD_BOT_TOKEN` | Bot token from [Discord Developer Portal](https://discord.com/developers/applications) |
| `DISCORD_APP_ID` | Your Discord application ID |
| `DISCORD_USER_ID` | Your Discord user ID (the account whose widget gets updated) |
| `STATSM_USERNAME` | Your stats.fm username |
| `STATSM_PROFILE_URL` | Your stats.fm profile URL |

All other options are in `.env` with defaults already set.

### Discord setup

1. Create an application in the Developer Portal
2. Add a bot and copy the token into `.env`
3. Enable **Presence Intent** and **Server Members Intent** under Bot settings
4. Invite the bot to a server you are in
5. Enable **activity sharing for that server** — see [Activity privacy](#activity-privacy) below
6. Authorize the app once with the `sdk.social_layer` OAuth scope (required for widget PATCH)
7. Configure your profile widget in Discord — see **[Widget setup guide](docs/widget-setup.md)**

### Run

```bash
# Development (auto-reload)
npm run dev

# Production
npm run build
npm start
```

## Widget setup

The hardest part is binding fields in the Discord widget editor. Every field the bot updates must be set to **User Data** with the matching **Data Field** name.

See the full guide: **[docs/widget-setup.md](docs/widget-setup.md)**

## Rotating stat pages

When `ROTATING_STATS=true`, the bottom six cards cycle every `ROTATION_INTERVAL_SECONDS` (default 30s). Each card needs **two** User Data bindings — small text → `hdr_*`, large text → `top_*`. The field names are six fixed slots; the text inside them changes per page. If headers stay frozen, they're probably set to Custom String instead of User Data.

Pages:

1. **Top Music** — 4w / 6m artist, album, song
2. **Listening Stats** — today / week / month minutes, streams, uniques
3. **Discovery** — last streamed artist/album/song, monthly library counts
4. **Lifetime** — lifetime minutes/streams, avg daily, genre, library size, account age

To add a page, append to `STAT_PAGES` in `src/rotatingStats.ts`.

## How now-playing works

Now-playing comes from **Discord Spotify presence** (same source as the green Listening block), so track changes are near-instant via `presenceUpdate`.

Top stats and rotation data come from **stats.fm**, refreshed every `TOPS_POLL_SECONDS` (default 60s).

When Spotify is not in your presence, the widget falls back to idle — `hero_image` is omitted so Discord shows the Application Asset gif you configured in the editor.

### Activity privacy

Now-playing needs the bot to receive your Spotify listening activity. That requires **both**:

1. **Spotify connected** in User Settings → **Connections**, with **Display Spotify as your status** enabled
2. **Activity sharing enabled for the server the bot is in** — this is easy to miss

Per-server activity privacy lives under **User Settings → Activity** (not Data & Privacy). For the server where you invited the bot, make sure activity/status sharing is allowed. If it is off for that server, your profile may still show Spotify to you, but the bot will log `no Spotify activity` and the widget stays idle.

See **[docs/widget-setup.md](docs/widget-setup.md)** for the full checklist.

## Slash commands

Registered automatically on startup:

| Command | Response |
| --- | --- |
| `/ping` | Bot online check |
| `/status` | Bot / widget / stats.fm status |

By default commands are **guild-scoped** (instant). Set `COMMANDS_GUILD_ID` to your server ID, or leave empty to use the first mutual guild.

```env
COMMANDS_GLOBAL=true   # switch to global commands (slow to propagate)
```

## Hosting

For 24/7 uptime, run on a VPS or cloud host with a process manager like `pm2`:

```bash
npm run build
pm2 start dist/index.js --name statsfm-widget
pm2 save && pm2 startup
```

## License

MIT — see [LICENSE](LICENSE).
