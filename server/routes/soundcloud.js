import express from 'express';
import crypto from 'crypto';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getSoundCloudFeed,
  searchSoundCloud,
  getSoundCloudSuggestions,
  getSoundCloudRelated,
  getSoundCloudStreamUrl,
  resolveSoundCloud,
  normalizeSoundCloudId
} from '../services/soundcloud.js';
import {
  isStreamCached,
  getCachePath,
  touchCache,
  cacheStreamInBackground,
  preloadTrack
} from '../services/streamCache.js';
import { queue } from '../services/queue.js';

const router = express.Router();

// 1. Trending & Recommended Feed
router.get('/feed', requireAuth, async (req, res) => {
  const { topic, page } = req.query;
  try {
    const pageNum = parseInt(page, 10) || 1;
    const feed = await getSoundCloudFeed(topic || '', pageNum, 20);
    res.json(feed);
  } catch (err) {
    console.error('[SoundCloud Feed Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2. Search Tracks
router.get('/search', requireAuth, async (req, res) => {
  const { q, page } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Search query required' });
  }
  try {
    const pageNum = parseInt(page, 10) || 1;
    const results = await searchSoundCloud(q.trim(), 20, pageNum);
    res.json(results);
  } catch (err) {
    console.error('[SoundCloud Search Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 2b. Search Auto-complete Suggestions
router.get('/suggest', async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json({ suggestions: [] });
  }
  try {
    const suggestions = await getSoundCloudSuggestions(q.trim());
    res.json(suggestions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Related Tracks / Continuous Radio
router.get('/related', requireAuth, async (req, res) => {
  const v = normalizeSoundCloudId(req.query.v || req.query.id);
  if (!v) {
    return res.status(400).json({ error: 'Track ID required' });
  }

  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const results = await getSoundCloudRelated(v, limit);
    res.json(results);
  } catch (err) {
    console.error('[SoundCloud Related Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 4a. Available Qualities
router.get('/qualities', requireAuth, async (req, res) => {
  res.json({
    qualities: [
      { height: 0, label: 'HQ Audio (MP3 128kbps)' }
    ]
  });
});

// 4b. Online Audio Stream Proxy (With Range headers for iOS/Android & Local Disk Cache)
router.get('/stream', requireAuth, async (req, res) => {
  const { type = 'audio' } = req.query;
  const rawId = req.query.v || req.query.id;
  const v = normalizeSoundCloudId(rawId);
  if (!v) {
    return res.status(400).send('Track ID required');
  }

  // 1. FAST PATH: Local disk cache hit
  if (isStreamCached(v, type)) {
    touchCache(v, type);
    const { filePath, mime } = getCachePath(v, type);
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days
    return res.sendFile(filePath, { acceptRanges: true });
  }

  // 2. SLOW PATH: Stream directly from CloudFront CDN & cache in background
  try {
    const { streamUrl, mime } = await getSoundCloudStreamUrl(v);

    // Cache stream in background for zero-latency repeats
    cacheStreamInBackground(v, type, streamUrl);

    const parsed = new URL(streamUrl);
    const client = parsed.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    };

    if (req.headers.range) {
      options.headers['Range'] = req.headers.range;
    }

    const proxyReq = client.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode || 200);

      const forwardedHeaders = [
        'content-type',
        'content-length',
        'content-range',
        'accept-ranges',
        'cache-control'
      ];

      for (const h of forwardedHeaders) {
        if (proxyRes.headers[h]) {
          res.setHeader(h, proxyRes.headers[h]);
        }
      }

      if (!res.getHeader('content-type')) {
        res.setHeader('Content-Type', mime || 'audio/mpeg');
      }
      res.setHeader('Accept-Ranges', 'bytes');

      proxyRes.pipe(res);
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.on('error', (err) => {
      if (err.code === 'ECONNRESET' || proxyReq.destroyed || req.destroyed) return;
      console.error('[SoundCloud Stream Proxy Error]:', err);
      if (!res.headersSent) {
        res.status(502).send('Error streaming online audio');
      }
    });

    proxyReq.end();
  } catch (err) {
    console.error('Error resolving SoundCloud stream URL:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ code: 'STREAM_ERROR', error: err.message });
    }
  }
});

// 5. Preload Next Track in Background
router.get('/preload', requireAuth, async (req, res) => {
  const { type = 'audio' } = req.query;
  const v = normalizeSoundCloudId(req.query.v || req.query.id);
  if (!v) {
    return res.status(400).json({ error: 'Track ID required' });
  }

  try {
    const status = await preloadTrack(v, type);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. SoundCloud Info / URL Resolve
router.post('/info', requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  try {
    const info = await resolveSoundCloud(url);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Download SoundCloud Track
router.post('/download', requireAuth, async (req, res) => {
  const { url, id, mediaType = 'audio', quality = 'HQ', items, createPlaylist, playlistName, title, artist, thumbnail } = req.body || {};
  const jobs = [];
  const userId = req.user?.id || 'default';

  // Batch download
  if (Array.isArray(items) && items.length > 0) {
    let playlistId = null;
    if (createPlaylist) {
      playlistId = crypto.randomUUID();
      const pName = playlistName || 'Danh sách phát trực tuyến';
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO playlists (id, user_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(playlistId, userId, pName, now, now);
    }

    for (const item of items) {
      const itemUrl = item.url || (item.id ? `https://soundcloud.com/tracks/${item.id}` : null);
      if (!itemUrl) continue;
      const job = queue.createJob({
        kind: 'soundcloud',
        url: itemUrl,
        mediaType: 'audio',
        quality,
        userId,
        extra: {
          playlistId,
          soundcloudId: item.id,
          title: item.title,
          artist: item.artist || item.channel,
          thumbnail: item.thumbnail || item.thumbnail_url || thumbnail
        }
      });
      jobs.push(job);
    }

    return res.json({ jobs, playlistId });
  }

  // Single download
  const targetId = id || normalizeSoundCloudId(url);
  const targetUrl = url || (targetId ? `https://soundcloud.com/tracks/${targetId}` : null);

  if (!targetUrl && !targetId) {
    return res.status(400).json({ error: 'URL or track ID required' });
  }

  const job = queue.createJob({
    kind: 'soundcloud',
    url: targetUrl || '',
    mediaType: 'audio',
    quality,
    userId,
    extra: {
      soundcloudId: targetId,
      title,
      artist,
      thumbnail
    }
  });

  return res.json({ jobs: [job] });
});

// 8. User personal data stub
router.get('/me-data', requireAuth, async (req, res) => {
  res.json({ isGoogle: false, subscriptions: [], liked: [], playlists: [] });
});

router.post('/me-data/sync', requireAuth, async (req, res) => {
  res.json({ success: true, subscriptions: [], liked: [], playlists: [] });
});

export default router;
