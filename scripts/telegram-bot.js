/**
 * Void Downloader - Telegram Bot Service (Zero Dependencies)
 * 
 * Instructions:
 * 1. Set your bot token in .env or run with: TELEGRAM_BOT_TOKEN="your_token" node scripts/telegram-bot.js
 * 2. Send any video/audio URL (YouTube, Twitter, TikTok, etc.) to your bot.
 * 3. The bot will download and process it using yt-dlp/ffmpeg and send the file directly back to you.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');

// Load environment variables manually if .env exists
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error('\x1b[31mError: TELEGRAM_BOT_TOKEN environment variable is missing.\x1b[0m');
  console.error('Please create a .env file with TELEGRAM_BOT_TOKEN="your_token" or run:');
  console.error('  TELEGRAM_BOT_TOKEN="your_token" node scripts/telegram-bot.js\n');
  process.exit(1);
}

// Find yt-dlp executable path
const ytdlpPath = path.join(__dirname, '..', 'bin', 'yt-dlp');
if (!fs.existsSync(ytdlpPath)) {
  console.error(`\x1b[31mError: yt-dlp binary not found at ${ytdlpPath}\x1b[0m`);
  console.error('Please run the web app once to initialize the yt-dlp engine.\n');
  process.exit(1);
}

const TEMP_DIR = path.join(__dirname, '..', 'temp-downloads');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

console.log('\x1b[32mVoid Downloader Telegram Bot starting...\x1b[0m');
console.log(`Using yt-dlp path: ${ytdlpPath}`);
console.log('Bot is polling for messages. Press Ctrl+C to stop.');

let offset = 0;

// Polling loop
function poll() {
  const options = {
    hostname: 'api.telegram.org',
    port: 443,
    path: `/bot${TOKEN}/getUpdates?offset=${offset}&timeout=30`,
    method: 'GET'
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      try {
        const response = JSON.parse(data);
        if (response.ok && response.result.length > 0) {
          for (const update of response.result) {
            offset = update.update_id + 1;
            if (update.message) {
              handleMessage(update.message);
            }
          }
        }
      } catch (err) {
        console.error('Failed to parse update updates JSON:', err.message);
      }
      setTimeout(poll, 100);
    });
  });

  req.on('error', (err) => {
    console.error('Polling connection error:', err.message);
    setTimeout(poll, 5000); // Wait longer on connection failure
  });

  req.end();
}

// Start polling
poll();

// Helper to send a simple text message
function sendMessage(chatId, text, replyToMessageId = null) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      reply_to_message_id: replyToMessageId
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) resolve(parsed.result);
          else reject(new Error(parsed.description));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Helper to update text of a message (for status updates)
function editMessageText(chatId, messageId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      message_id: messageId,
      text: text
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/editMessageText`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) resolve(parsed.result);
          else reject(new Error(parsed.description));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Native multipart uploader
function uploadFile(chatId, method, filePath, fileName) {
  return new Promise((resolve, reject) => {
    const boundary = '----Boundary' + crypto.randomBytes(8).toString('hex');
    const stat = fs.statSync(filePath);
    
    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TOKEN}/${method}`,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.ok) resolve(parsed.result);
          else reject(new Error(parsed.description || 'Telegram rejected the upload. It might exceed the size limit (50MB).'));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    // Write fields
    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="chat_id"\r\n\r\n`);
    req.write(`${chatId}\r\n`);

    let fieldName = 'document';
    if (method === 'sendVideo') fieldName = 'video';
    else if (method === 'sendAudio') fieldName = 'audio';

    req.write(`--${boundary}\r\n`);
    req.write(`Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`);
    req.write(`Content-Type: application/octet-stream\r\n\r\n`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(req, { end: false });
    
    fileStream.on('end', () => {
      req.write(`\r\n--${boundary}--\r\n`);
      req.end();
    });

    fileStream.on('error', (err) => {
      req.destroy(err);
    });
  });
}

// Handle incoming messages
async function handleMessage(message) {
  const chatId = message.chat.id;
  const text = message.text || '';
  const messageId = message.message_id;

  if (text.startsWith('/start') || text.startsWith('/help')) {
    const welcomeText = 
      "👋 Welcome to Void Downloader Bot!\n\n" +
      "Send me any video link from YouTube, Twitter, TikTok, Instagram, Facebook, etc.\n" +
      "I will download and convert it, then send the file back to you directly!\n\n" +
      "Commands:\n" +
      "/start - Restart the bot\n" +
      "/audio <link> - Download the audio version (MP3) only";
    
    try {
      await sendMessage(chatId, welcomeText);
    } catch (e) {
      console.error('Error sending start message:', e.message);
    }
    return;
  }

  // Parse URL
  const urlRegex = /(https?:\/\/[^\s]+)/;
  const match = text.match(urlRegex);

  if (!match) {
    sendMessage(chatId, "⚠️ Please send a valid video URL (e.g. YouTube, Twitter, etc.).");
    return;
  }

  const targetUrl = match[1];
  const isAudioOnly = text.startsWith('/audio');

  let statusMsg;
  try {
    statusMsg = await sendMessage(chatId, "🔍 Analyzing link... Please wait.", messageId);
  } catch (e) {
    console.error('Error sending analysis status:', e.message);
    return;
  }

  const downloadId = crypto.randomUUID();
  const outputTemplate = path.join(TEMP_DIR, `${downloadId}.%(ext)s`);

  // Configure formats and flags
  let formatArgs = [];
  let method = 'sendVideo';
  let ext = 'mp4';

  if (isAudioOnly) {
    formatArgs = ['-f', 'bestaudio', '-x', '--audio-format', 'mp3', '--audio-quality', '0'];
    method = 'sendAudio';
    ext = 'mp3';
  } else {
    // Default video format (Limit size so it fits inside Telegram bot upload limits - max 50MB)
    // We select 720p or lower combined to stay within size bounds
    formatArgs = ['-f', 'bestvideo[height<=720]+bestaudio/best[height<=720]', '--merge-output-format', 'mp4'];
    method = 'sendVideo';
    ext = 'mp4';
  }

  // Build ytdlp spawn args
  const args = [
    targetUrl,
    '--newline',
    '--progress',
    '-4', // IPv4 to avoid slow DNS lookup
    '--no-warnings',
    ...formatArgs,
    '-o', outputTemplate,
    '--no-playlist',
    // MULTI-THREADING (User requirement):
    // Instruct FFmpeg to use all available cores (threads=0) for postprocessing and merging
    '--downloader-args', 'ffmpeg:-threads 0',
    '--postprocessor-args', 'ffmpeg:-threads 0'
  ];

  if (fs.existsSync('/usr/bin/ffmpeg')) {
    args.push('--ffmpeg-location', '/usr/bin/ffmpeg');
  }

  editMessageText(chatId, statusMsg.message_id, "📥 Starting download on server...");

  const child = spawn(ytdlpPath, args);
  let lastProgressTime = 0;
  let title = 'video';

  // Read metadata first to get the title (async spawn yt-dlp --get-title)
  const metadataChild = spawn(ytdlpPath, ['--get-title', targetUrl]);
  metadataChild.stdout.on('data', (data) => {
    title = data.toString().trim();
  });

  child.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      if (line.includes('[download]') && line.includes('%')) {
        const matches = line.match(/\[download\]\s+([0-9.]+)%\s+of\s+~?([^\s]+)\s+at\s+([^\s]+)\s+ETA\s+([^\s]+)/);
        if (matches) {
          const progress = parseFloat(matches[1]);
          const size = matches[2];
          const speed = matches[3];
          const eta = matches[4];
          
          // Throttling Telegram message updates to avoid rate limit (max 1 update per 2 seconds)
          const now = Date.now();
          if (now - lastProgressTime > 2500) {
            editMessageText(chatId, statusMsg.message_id, `📥 Downloading: ${Math.round(progress)}% of ${size}\nSpeed: ${speed} | ETA: ${eta}`);
            lastProgressTime = now;
          }
        }
      } else if (line.includes('[Merger]') || line.includes('[ffmpeg]')) {
        editMessageText(chatId, statusMsg.message_id, "⚙️ Processing: Merging audio & video in parallel using multiple threads...");
      }
    }
  });

  child.on('close', async (code) => {
    if (code !== 0) {
      editMessageText(chatId, statusMsg.message_id, "❌ Download failed on the server. Please verify the URL is valid and try again.");
      return;
    }

    try {
      editMessageText(chatId, statusMsg.message_id, "📤 Uploading file to Telegram... Please wait.");

      // Find the file in the temp-downloads directory
      const files = fs.readdirSync(TEMP_DIR);
      const matchedFile = files.find(file => file.startsWith(downloadId));

      if (!matchedFile) {
        throw new Error('Downloaded file not found in temp directory.');
      }

      const localFilePath = path.join(TEMP_DIR, matchedFile);
      const safeTitle = title.replace(/[\/\\?%*:|"<>]/g, '_');
      const finalFileName = `${safeTitle}.${matchedFile.split('.').pop()}`;

      // Telegram upload size limit check (50MB for standard bots)
      const stats = fs.statSync(localFilePath);
      const sizeInMB = stats.size / (1024 * 1024);

      if (sizeInMB > 49.5) {
        editMessageText(chatId, statusMsg.message_id, `⚠️ File size is ${sizeInMB.toFixed(1)}MB, which exceeds the Telegram Bot API upload limit of 50MB. Please use a lower resolution or download it directly via the web app.`);
        
        // Clean up
        fs.unlinkSync(localFilePath);
        return;
      }

      await uploadFile(chatId, method, localFilePath, finalFileName);
      
      // Success
      editMessageText(chatId, statusMsg.message_id, `✅ Download completed! Sent "${title}".`);
      
      // Clean up local file
      fs.unlinkSync(localFilePath);
    } catch (err) {
      console.error('Upload error:', err);
      editMessageText(chatId, statusMsg.message_id, `❌ Failed to send file: ${err.message}`);
    }
  });
}
