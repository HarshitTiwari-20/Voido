# Deploy on Render — YouTube cookies setup

YouTube blocks most cloud/datacenter IPs (including Render) with a bot check.
**You must provide logged-in YouTube cookies** via an environment variable.

Local Chrome cookies are **not** available on Render.

---

## 1. Export cookies on your computer

```bash
# From the project root (Chrome must be installed; close it if export fails)
chmod +x ./scripts/export-cookies-for-render.sh
./scripts/export-cookies-for-render.sh

# Or for Brave / Firefox:
./scripts/export-cookies-for-render.sh brave
```

The script prints a long **base64** string.

Alternatively with yt-dlp only:

```bash
./bin/yt-dlp --cookies-from-browser chrome --cookies cookies.txt --skip-download "https://www.youtube.com"
base64 -w0 cookies.txt   # macOS: base64 cookies.txt | tr -d '\n'
```

You must be **logged into youtube.com** in that browser.

---

## 2. Set env vars on Render

Render Dashboard → your **Web Service** → **Environment** → **Add Environment Variable**:

| Key | Value |
|-----|--------|
| `YOUTUBE_COOKIES_B64` | paste the full base64 string (one line) |

Optional:

| Key | Value |
|-----|--------|
| `YOUTUBE_PROXY` | `http://user:pass@host:port` residential proxy (if IP still blocked) |
| `FFMPEG_PATH` | path to ffmpeg if not in `/usr/bin/ffmpeg` |

Click **Save Changes** and **Manual Deploy** (or wait for auto-redeploy).

---

## 3. Verify

Open your app. Sidebar should show:

- `Cookies: env-b64` (good)
- not `Cookies: missing`

If downloads still fail with bot check:

1. Re-export **fresh** cookies (old ones expire or get invalidated)
2. Update `YOUTUBE_COOKIES_B64` and restart
3. Prefer a **residential proxy** via `YOUTUBE_PROXY` — free Render IPs are heavily flagged

---

## Security notes

- Never commit `cookies.txt` to Git (already gitignored)
- Treat `YOUTUBE_COOKIES_B64` as a **secret** (full browser session access)
- Rotate cookies if you suspect they leaked

---

## Other env vars

| Variable | Description |
|----------|-------------|
| `YOUTUBE_COOKIES_B64` | **Recommended** base64 of Netscape cookies file |
| `YOUTUBE_COOKIES` | Raw Netscape cookie text (awkward multi-line on Render) |
| `YOUTUBE_COOKIES_FILE` | Absolute path if you mount a secret file |
| `YOUTUBE_PROXY` | Default proxy for all yt-dlp requests |
