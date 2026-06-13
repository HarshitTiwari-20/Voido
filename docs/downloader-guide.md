# Void Downloader - Engine Throttling & Conversion Speed Guide

This guide explains how to control and optimize download and conversion speeds for the Void Downloader backend.

---

## 1. Controlling Conversion Speed (FFmpeg CPU Usage)

By default, FFmpeg runs in multi-threaded mode to merge or transcode streams as quickly as possible. This utilizes all CPU cores and speeds up completion.

### Multi-threading (High Performance - Currently Enabled)
We have added these flags to both the web downloader backend ([downloader.ts](file:///home/harshit/Desktop/projects/videos-downloader/src/lib/downloader.ts)) and the Telegram bot ([telegram-bot.js](file:///home/harshit/Desktop/projects/videos-downloader/scripts/telegram-bot.js)):
```javascript
'--downloader-args', 'ffmpeg:-threads 0',
'--postprocessor-args', 'ffmpeg:-threads 0'
```
Passing `-threads 0` instructs FFmpeg to utilize all available CPU threads in parallel for processing/merging, bypassing single-core bottlenecks.

### Throttling CPU Usage (Low Performance / Background Task)
If you want to **limit** FFmpeg's CPU footprint (e.g. to prevent it from consuming 100% of all cores so other processes can run smoothly), you can restrict the thread count. 

Modify the thread flag in [downloader.ts](file:///home/harshit/Desktop/projects/videos-downloader/src/lib/downloader.ts):
- Limit to **2 cores**: `'ffmpeg:-threads 2'`
- Limit to **1 core**: `'ffmpeg:-threads 1'` (pure single-core execution)

---

## 2. Throttling Download Speed (Bandwidth Throttling)

If downloads saturate your network connection, you can limit the download rate using the `--limit-rate` argument.

### How to apply
In [downloader.ts](file:///home/harshit/Desktop/projects/videos-downloader/src/lib/downloader.ts), add the `--limit-rate` parameter to the `args` array:

```typescript
const args = [
  url,
  '--newline',
  '--progress',
  '-4',
  '--no-warnings',
  '--limit-rate', '1.5M', // Limits download rate to 1.5 Megabytes per second
  ...formatArgs,
  '-o', outputTemplate,
  '--no-playlist',
  '--downloader-args', 'ffmpeg:-threads 0',
  '--postprocessor-args', 'ffmpeg:-threads 0'
];
```

You can set rate limits like:
- `50K` (50 Kilobytes/sec)
- `1M` (1 Megabyte/sec)
- `5M` (5 Megabytes/sec)
