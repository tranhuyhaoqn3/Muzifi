import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { initDatabase } from './db.js';

import authRouter from './routes/auth.js';
import tracksRouter from './routes/tracks.js';
import youtubeRouter from './routes/youtube.js';
import jobsRouter from './routes/jobs.js';
import playlistsRouter from './routes/playlists.js';
import playerRouter from './routes/player.js';
import systemRouter from './routes/system.js';
import lyricsRouter from './routes/lyrics.js';
import { initGeminiWeeklyScheduler } from './services/geminiRecommend.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Initialize database
initDatabase();

// Initialize Gemini weekly recommendation scheduler
initGeminiWeeklyScheduler();

const app = express();
app.disable('x-powered-by');

// Trust proxy for secure cookies behind reverse proxies (Tailscale, Cloudflare)
app.set('trust proxy', 1);

// Standard HTTP Security Headers (prevent MIME-sniffing, clickjacking, etc.)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/tracks', tracksRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/player-state', playerRouter);
app.use('/api/lyrics', lyricsRouter);
app.use('/api/system', systemRouter);
app.use('/api/settings', systemRouter); // Alias for settings

// iOS Web Clip .mobileconfig profile generator
app.get('/api/install-profile', (req, res) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto || (req.secure ? 'https' : (req.get('host')?.includes('localhost') ? req.protocol : 'https'));
  const host = req.get('host') || 'm.baokien.site';
  const baseUrl = `${proto}://${host}`;
  const profileUUID = 'muzifi-webclip-' + Buffer.from(host).toString('hex').slice(0, 8);

  let iconBase64 = '';
  try {
    const iconPath = path.join(ROOT_DIR, 'web', 'apple-touch-icon.png');
    if (fs.existsSync(iconPath)) {
      iconBase64 = fs.readFileSync(iconPath).toString('base64');
    }
  } catch (e) {
    console.warn('[Profile] Could not read app icon:', e.message);
  }

  const mobileconfig = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>FullScreen</key>
      <true/>
      <key>Icon</key>
      <data>${iconBase64}</data>
      <key>IsRemovable</key>
      <true/>
      <key>Label</key>
      <string>Muzifi</string>
      <key>PayloadDescription</key>
      <string>Thêm Muzifi vào Màn hình chính</string>
      <key>PayloadDisplayName</key>
      <string>Muzifi Web App</string>
      <key>PayloadIdentifier</key>
      <string>com.muzifi.webclip.${profileUUID}</string>
      <key>PayloadType</key>
      <string>com.apple.webClip.managed</string>
      <key>PayloadUUID</key>
      <string>${profileUUID}-clip</string>
      <key>PayloadVersion</key>
      <integer>1</integer>
      <key>Precomposed</key>
      <true/>
      <key>URL</key>
      <string>${baseUrl}/</string>
    </dict>
  </array>
  <key>PayloadDescription</key>
  <string>Cài đặt Muzifi lên Màn hình chính iPhone/iPad của bạn</string>
  <key>PayloadDisplayName</key>
  <string>Muzifi - Cài đặt App</string>
  <key>PayloadIdentifier</key>
  <string>com.muzifi.install.${profileUUID}</string>
  <key>PayloadOrganization</key>
  <string>Muzifi</string>
  <key>PayloadRemovalDisallowed</key>
  <false/>
  <key>PayloadType</key>
  <string>Configuration</string>
  <key>PayloadUUID</key>
  <string>${profileUUID}-root</string>
  <key>PayloadVersion</key>
  <integer>1</integer>
</dict>
</plist>`;

  res.setHeader('Content-Type', 'application/x-apple-aspen-config');
  res.setHeader('Content-Disposition', 'attachment; filename="Muzifi.mobileconfig"');
  res.send(mobileconfig);
});

// Serve Web Frontend
const distPath = path.join(ROOT_DIR, 'dist');
const webPath = path.join(ROOT_DIR, 'web');

if (fs.existsSync(distPath)) {
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      if (req.path === '/privacy' || req.path === '/privacy.html') {
        return res.sendFile(path.join(distPath, 'privacy.html'));
      }
      if (req.path === '/terms' || req.path === '/terms.html') {
        return res.sendFile(path.join(distPath, 'terms.html'));
      }
      if (req.path === '/about' || req.path === '/about.html') {
        return res.sendFile(path.join(distPath, 'about.html'));
      }
      if (req.path === '/install' || req.path === '/install.html') {
        return res.sendFile(path.join(distPath, 'install.html'));
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(path.join(distPath, 'index.html'));
    }
    next();
  });
} else if (fs.existsSync(webPath)) {
  app.use(express.static(webPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      if (req.path === '/privacy' || req.path === '/privacy.html') {
        return res.sendFile(path.join(webPath, 'privacy.html'));
      }
      if (req.path === '/terms' || req.path === '/terms.html') {
        return res.sendFile(path.join(webPath, 'terms.html'));
      }
      if (req.path === '/about' || req.path === '/about.html') {
        return res.sendFile(path.join(webPath, 'about.html'));
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.sendFile(path.join(webPath, 'index.html'));
    }
    next();
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

app.listen(config.PORT, config.HOST, () => {
  console.log(`===============================================`);
  console.log(`[Server] Muzifi Music & Video Server is running!`);
  console.log(`[Address] http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}`);
  console.log(`[Data] ${config.DATA_DIR}`);
  console.log(`[Auth] Enabled: ${!config.DISABLE_AUTH}`);
  console.log(`===============================================`);
});
