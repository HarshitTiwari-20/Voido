#!/usr/bin/env bash
# Export YouTube cookies for Render (or any cloud host).
#
# Usage:
#   1. Log into youtube.com in Chrome (or Brave).
#   2. Close Chrome completely (recommended so cookies unlock).
#   3. Run this script from the project root:
#        ./scripts/export-cookies-for-render.sh
#   4. Copy the printed base64 string into Render:
#        Environment → YOUTUBE_COOKIES_B64 = <paste>
#   5. Redeploy / restart the service.
#
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
YTDLP="$ROOT/bin/yt-dlp"
OUT="$ROOT/cookies.txt"
BROWSER="${1:-chrome}"

if [[ ! -x "$YTDLP" ]]; then
  echo "yt-dlp not found at $YTDLP — downloading..."
  mkdir -p "$ROOT/bin"
  curl -L "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" -o "$YTDLP"
  chmod +x "$YTDLP"
fi

echo "Exporting cookies from browser: $BROWSER"
echo "(If this fails, close the browser and retry, or pass: chrome | brave | firefox)"
echo

"$YTDLP" \
  --cookies-from-browser "$BROWSER" \
  --cookies "$OUT" \
  --skip-download \
  --print id \
  "https://www.youtube.com/watch?v=jNQXAC9IVRw" || true

if [[ ! -s "$OUT" ]]; then
  echo "ERROR: cookies.txt was not created. Try another browser:"
  echo "  ./scripts/export-cookies-for-render.sh brave"
  exit 1
fi

echo
echo "Wrote $OUT ($(wc -c < "$OUT") bytes)"
echo
echo "========== Paste this into Render env var YOUTUBE_COOKIES_B64 =========="
base64 -w0 "$OUT" 2>/dev/null || base64 "$OUT" | tr -d '\n'
echo
echo "======================================================================="
echo
echo "Then set on Render Dashboard → your service → Environment:"
echo "  Key:   YOUTUBE_COOKIES_B64"
echo "  Value: (the long base64 line above)"
echo "Redeploy after saving."
