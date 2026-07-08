# Widget setup

If the bot runs but the widget shows defaults, the editor bindings are wrong.

## Checklist

- Bot is running
- `.env` has `DISCORD_APP_ID`, `DISCORD_USER_ID`, `DISCORD_BOT_TOKEN`
- App authorized with `sdk.social_layer` OAuth scope
- Bot in a shared server with Presence + Server Members intents
- Activity sharing enabled for that server (User Settings → Activity)
- Spotify connected with **Display Spotify as your status** on

## Now playing

Bind each field to **User Data**:

| Widget element | Data Field |
| --- | --- |
| Title | `title` |
| Subtitle / artist | `artist` or `subtitle` |
| Album | `album` |
| Cover image | `hero_image` |

When idle, the bot omits `hero_image`. Set an Application Asset as the image fallback in the editor if you want an animated idle gif — User Data image URLs don't animate.

## Bottom stat cards

Each card has two text slots:

| Editor slot | Data Field |
| --- | --- |
| Value (small text) | `hdr_*` |
| Label (large text) | `top_*` |

Both must be User Data, not Custom String.

| Card | Header | Value |
| --- | --- | --- |
| #1 | `hdr_artist_4w` | `top_artist_4w` |
| #2 | `hdr_album_4w` | `top_album_4w` |
| #3 | `hdr_song_4w` | `top_song_4w` |
| #4 | `hdr_artist_6m` | `top_artist_6m` |
| #5 | `hdr_album_6m` | `top_album_6m` |
| #6 | `hdr_song_6m` | `top_song_6m` |

With `ROTATING_STATS=true`, the bot cycles pages every `ROTATION_INTERVAL_SECONDS` (default 30s) using the same six field names.

Pages:

1. Top Music — 4w/6m artist, album, song
2. Listening Stats — today/week/month minutes, streams, uniques
3. Discovery — last streamed artist/album/song, monthly library counts
4. Lifetime — lifetime minutes/streams, avg daily, genre, library size, account age

Optional: bind a User Data field to `stats_page` for a page indicator.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Widget shows sample text | All fields must be User Data |
| Now playing stuck | Presence intent, shared server, Spotify connected, activity sharing on for bot's server |
| Headers don't rotate | Small text must be `hdr_*` User Data, not Custom String |
| Idle gif is still | Use Application Asset fallback, not a User Data URL |
| 401 / 403 on PATCH | Check token, app id, user id, `sdk.social_layer` auth |

## API

```
PATCH https://discord.com/api/v9/applications/{DISCORD_APP_ID}/users/{DISCORD_USER_ID}/identities/0/profile
Authorization: Bot {DISCORD_BOT_TOKEN}
```

Payload must include `username` or Discord keeps showing fallback values.
