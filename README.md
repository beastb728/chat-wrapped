# Chat Wrapped

Fun, private experiences built from your WhatsApp chat export. It runs **entirely in your browser**: nothing is uploaded, there's no login, and it works in airplane mode.

- **Chat Wrapped**: Spotify-Wrapped-style stat cards, sized for Status and Stories.
- **Who Said It?**: a pass-and-play party game. See a real message from the chat and guess who sent it.

## Run it

```bash
npm run dev     # http://localhost:5173 (zero dependencies)
npm test        # parser + stats tests (node --test)
```

No build step and no npm dependencies, so the code in this repo is exactly what runs.

## Deploy

Any static host works (Cloudflare Pages, Netlify, GitHub Pages). Before deploying:

- Set `SITE_DOMAIN` in `src/config.js`. That domain is printed on every share card.
- Set `REPO_URL` so "Report format" links to your issues page.
- Bump `VERSION` in `sw.js` when you change the list of cached files.
- `_headers` sets the CSP and other security headers on Netlify and Cloudflare Pages. The pages also set the CSP in a `<meta>` tag.

## How it works

| File | What it does |
| --- | --- |
| `src/parser.js` | WhatsApp export parser: Android and iOS, 12h/24h clocks, DMY/MDY/YMD dates (auto-detected), system messages, media and deleted markers in many languages, edited messages, multi-line messages |
| `src/zip.js` | ~80-line zip reader built on the browser's `DecompressionStream` |
| `src/stats.js` | Stats, awards and per-person archetypes. The output never contains message text |
| `src/cards.js` | Draws each 1080×1920 card on canvas. The same image is shown on screen and shared |
| `src/worker.js` | Parsing and stats run in a Web Worker, so 100k+ message chats don't freeze the page |
| `src/app.js` | UI, Web Share API (sends images straight to WhatsApp/Instagram), network-request counter |
| `src/game.js` | Who Said It? round builder: skips links, emails, phone numbers, short and self-naming messages and (by default) spicy ones; balances rounds across people; adds emoji bonus rounds |
| `src/game-ui.js` | Game screens: players and turns, host check (preview and swap messages without names), scoring, result card |
| `src/sample.js` | Fictional demo chat |
| `sw.js` | Offline cache and the Android share target ("Share to Chat Wrapped" from WhatsApp, once the app is installed) |

## Privacy guarantees (and how they're enforced)

- The page's CSP has `connect-src 'none'`, so the browser blocks every fetch/XHR/WebSocket from the page.
- The worker is started on page load, so after you choose a file the page makes **0** network requests. The badge at the bottom counts them using `PerformanceObserver`.
- Cards contain counts, names, emojis and single "signature words" only. Both names and words can be switched off.
- Who Said It? shows real messages on screen, so the host can preview and swap them first. The game result card shows scores only, never message text.

## Adding a new export format

If the parser fails on someone's export, the error screen shows a redacted sample with every letter replaced by `x`. Add a matching case to `tests/parser.test.js`, fix `src/parser.js`, and run `npm test`.

## Not built yet

Chat Court and Instagram Wrapped.
