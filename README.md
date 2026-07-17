# Void — Video Downloader

Next.js app that downloads videos (and audio-only) via yt-dlp.

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## YouTube cookies (required on cloud)

YouTube blocks cloud IPs (Render, etc.) unless you provide cookies from a logged-in browser.

**Local:** place a Netscape `cookies.txt` in the project root, or stay logged into Chrome/Brave.

**Render:** set env var `YOUTUBE_COOKIES_B64` — see [docs/render-setup.md](./docs/render-setup.md).

```bash
./scripts/export-cookies-for-render.sh   # prints base64 for Render
```

## Deploy on Render

1. Connect the GitHub repo and create a **Web Service**
2. Build: `npm install && npm run build`
3. Start: `npm run start`
4. Add env `YOUTUBE_COOKIES_B64` (see setup doc)
5. Install ffmpeg if merges fail (native env: add build step to install ffmpeg, or use an image that includes it)

Full steps: [docs/render-setup.md](./docs/render-setup.md).

## Environment variables

| Variable | Description |
|----------|-------------|
| `YOUTUBE_COOKIES_B64` | Base64 of Netscape cookies file (**recommended for Render**) |
| `YOUTUBE_COOKIES` | Raw Netscape cookie text |
| `YOUTUBE_COOKIES_FILE` | Absolute path to a cookies file |
| `YOUTUBE_PROXY` | Default HTTP/SOCKS proxy for yt-dlp |
| `FFMPEG_PATH` | Optional path to ffmpeg binary |
