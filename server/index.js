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
import soundCloudRouter from './routes/soundcloud.js';
import jobsRouter from './routes/jobs.js';
import playlistsRouter from './routes/playlists.js';
import playerRouter from './routes/player.js';
import systemRouter from './routes/system.js';
import lyricsRouter from './routes/lyrics.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Initialize database
initDatabase();

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
app.use('/api/online', soundCloudRouter);
app.use('/api/soundcloud', soundCloudRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/playlists', playlistsRouter);
app.use('/api/player-state', playerRouter);
app.use('/api/lyrics', lyricsRouter);
app.use('/api/system', systemRouter);
app.use('/api/settings', systemRouter); // Alias for settings

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
