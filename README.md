# शौर्य Shaurya — Indian Armed Forces Radio

A one-page, music-only radio for Indian patriotic anthems. Press play once and it
keeps going:

- **49 patriotic bangers on shuffle** — streamed from YouTube as audio only (the
  video is never shown), reshuffled fresh on every visit
- **Rotating quotes** — war heroes, regimental war cries, service mottos, freedom
  fighters and motivational lines, changing every 13 seconds and on every refresh
- **Rotating photographs** — a curated wall of Indian Army, Navy and Air Force
  images that crossfade every 20 seconds with a slow Ken Burns drift
- No login, no ads, no build step, no backend

## Run it locally

It is a plain static site, so any static server works:

```bash
cd shaurya
python3 -m http.server 8787
# open http://localhost:8787
```

Opening `index.html` directly from the filesystem also mostly works, but a local
server is recommended because YouTube's embedded player prefers a real origin.

One local-only quirk: Python's `http.server` ignores HTTP `Range` requests, so
the progress bar cannot seek within a self-hosted audio file — the browser marks
the media unseekable and snaps back to the start. Playback itself is unaffected,
and real hosts (GitHub Pages, Netlify, Vercel) all serve ranges properly, so
seeking works once deployed. To check seeking locally, use a server that
supports ranges, e.g. `npx serve`.

## Deploy and share with friends

Pick whichever you find easiest — all three are free and give you a shareable
link.

### Option 1 — Netlify Drop (fastest, no account juggling)

1. Go to <https://app.netlify.com/drop>
2. Drag the whole `shaurya` folder onto the page
3. You get a live URL like `https://shaurya-abc123.netlify.app` — share it

`netlify.toml` is already included with sensible caching headers.

### Option 2 — Vercel

```bash
npm i -g vercel
cd shaurya
vercel        # preview deploy
vercel --prod # production deploy
```

`vercel.json` is already included. Vercel will detect a static site — no build
command or framework is needed.

### Option 3 — GitHub Pages

```bash
cd shaurya
git add -A
git commit -m "Shaurya — Indian Armed Forces radio"
git branch -M main
git remote add origin https://github.com/<your-username>/shaurya.git
git push -u origin main
```

Then in the repository: **Settings → Pages → Source: Deploy from a branch →
`main` / `root`**. Your site appears at
`https://<your-username>.github.io/shaurya/`. A `.nojekyll` file is already
included so the `assets/` folder is served correctly.

### Custom domain

All three hosts let you attach a domain (e.g. `shaurya.in`) from their dashboard
after you buy it from any registrar.

## Play your own YouTube playlist

The built-in playlist is curated, but you can point the site at your own:

- **Per visit:** add `?list=YOUR_PLAYLIST_ID` to the URL, e.g.
  `https://your-site.netlify.app/?list=PLxxxxxxxxxxxxxxxx`
- **Permanently:** open `assets/js/app.js` and set `playlistId` in the `CONFIG`
  block near the top.

The playlist ID is the `list=` value in a YouTube playlist URL. A few notes:

- The playlist must be **public or unlisted** — private playlists cannot be
  embedded.
- YouTube Music "auto-generated" mixes (IDs starting with `RD`) usually cannot be
  embedded. Create a normal playlist and add the songs to it instead.
- In playlist mode, YouTube supplies the track titles and shuffling, so the
  built-in tracklist panel is hidden.

## Background playback (screen off)

A YouTube track cannot play with the screen locked. Phone browsers suspend media
inside an embedded third-party player, and YouTube reserves background play for
Premium — no amount of client-side code gets around either. For YouTube tracks
Shaurya therefore does the next best thing: it holds a screen wake lock while one
is playing, and resumes the song when you come back to the page.

Tracks served from this site have no such limit. They play through the page's own
`<audio>` element, which keeps running when the phone is locked or the browser is
backgrounded, and the Media Session API puts the title, artwork and transport
controls on the lock screen.

To give a track that treatment, drop an audio file into `assets/audio/` and run:

```bash
python3 tools/sync_audio.py
```

The script matches files to the playlist by name, so `Teri Mitti.m4a` attaches
itself to the existing Teri Mitti entry and inherits its credit. Leading track
numbers and boilerplate like `(Official Video)` are ignored while matching.
Anything it cannot place is added as its own track. It writes
`assets/data/local-audio.js`; commit that along with the audio files, since the
site serves them from wherever you deploy it.

Those tracks are marked **BG** in the playlist drawer. Everything else keeps
streaming from YouTube exactly as before — the two backends sit behind the same
controls, progress bar and keyboard shortcuts.

Supported formats: `.m4a`, `.mp3`, `.aac`, `.ogg`, `.opus`, `.webm`, `.flac`,
`.wav`. Prefer `.m4a` or `.mp3` for size and universal support.

> **Note on rights.** Anything you put in `assets/audio/` is published by
> whichever host you deploy to, and a public GitHub repository makes those files
> public too. Only self-host audio you have the right to distribute — your own
> recordings, or recordings old enough to be out of copyright. Keep the rest on
> YouTube, where the rights holders are paid.

## Editing the content

Everything is plain data, no build step required.

| What | File |
| --- | --- |
| Songs | `assets/data/tracks.js` |
| Quotes | `assets/data/quotes.js` |
| Background photos | `assets/data/backgrounds.js` + `assets/backgrounds/` |
| Rotation speeds, volume, playlist ID | `CONFIG` at the top of `assets/js/app.js` |
| Colours, layout | `assets/css/style.css` |

To add a song, append an entry with its YouTube video ID:

```js
{ "id": "tionpZAVPd4", "name": "Teri Mitti", "credit": "Kesari (2019) · B Praak", "duration": 326 }
```

To add your own background photos, drop images into `assets/backgrounds/` and add
them to `assets/data/backgrounds.js`:

```js
{ "src": "assets/backgrounds/my-photo.jpg", "label": "Republic Day parade", "author": "", "license": "" }
```

If a video is ever removed or blocked, the player detects the error, marks it in
the tracklist and skips to the next song automatically.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `Space` | play / pause |
| `N` / `P` | next / previous track |
| `Q` | new quote |
| `B` | new background |
| `R` | reshuffle playlist |
| `L` | open playlist |
| `S` | salute |

## Regenerating the data (optional)

The `tools/` folder holds the scripts used to build the datasets. You only need
them if you want to rebuild the playlist or image set from scratch.

```bash
python3 tools/resolve_tracks2.py > data/tracks.json   # find + verify songs on YouTube
python3 tools/build_data.py                           # -> assets/data/tracks.js
python3 tools/resolve_images.py  > data/images.json    # find freely-licensed photos
python3 tools/download_images.py 30                    # download + compress + credits
```

`tools/download_images.py` deliberately stores the photographs locally rather
than hotlinking Wikimedia, and throttles its requests.

## Credits and licensing

- **Music** — streamed from YouTube, and no downloads are offered. The repository
  ships no audio of its own; `assets/audio/` is empty until you add files, and
  what you put there is your responsibility. All songs remain the property of
  their respective rights holders.
- **Photographs** — freely licensed images of the Indian Armed Forces from
  Wikimedia Commons (public domain, Creative Commons, or the Government Open Data
  Licence – India). Per-photo credit is shown on screen and listed in
  [`CREDITS.md`](CREDITS.md).
- **Fonts** — Teko, Rajdhani and Tiro Devanagari Hindi via Google Fonts.

Built as a tribute to the Indian Army, Navy and Air Force. जय हिन्द 🇮🇳
