import express from 'express';
import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { getGeminiRecommendations } from '../services/geminiRecommend.js';

import { 
  validateYouTubeUrl, 
  fetchYouTubeInfo, 
  getFeed, 
  searchYouTube, 
  getSearchSuggestions,
  getStreamUrl, 
  getAvailableQualities,
  saveCookies,
  normalizeYouTubeId,
  getRelatedTracks,
  getAuthAndCookieHeaders,
  ensureCookieFile
} from '../services/ytdlp.js';
import { 
  isStreamCached, 
  getCachePath, 
  touchCache, 
  cacheStreamInBackground, 
  preloadTrack 
} from '../services/streamCache.js';
import { queue } from '../services/queue.js';
import { fetchUserYouTubeData } from '../services/googleAuth.js';

const router = express.Router();

// 1. Get YouTube Recommendations / Trending Feed
router.get('/feed', requireAuth, async (req, res) => {
  const { topic, page } = req.query;
  try {
    const pageNum = parseInt(page, 10) || 1;
    const feed = await getFeed(topic || '', pageNum);
    res.json(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Search YouTube Music
router.get('/search', requireAuth, async (req, res) => {
  const { q, page } = req.query;
  if (!q || !q.trim()) {
    return res.status(400).json({ error: 'Search query required' });
  }
  try {
    const pageNum = parseInt(page, 10) || 1;
    const results = await searchYouTube(q.trim(), 20, pageNum);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2b. Search Suggestions (Auto-complete)
router.get('/suggest', async (req, res) => {
  const { q } = req.query;
  if (!q || !q.trim()) {
    return res.json({ suggestions: [] });
  }
  try {
    const suggestions = await getSearchSuggestions(q.trim());
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. YouTube Radio / Related Recommendations
router.get('/related', requireAuth, async (req, res) => {
  const v = normalizeYouTubeId(req.query.v);
  if (!v) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  try {
    const limit = Math.min(50, Math.max(5, parseInt(req.query.limit, 10) || 20));
    const results = await getRelatedTracks(v, limit);
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4a. Get Available Video Qualities
router.get('/qualities', requireAuth, async (req, res) => {
  const v = normalizeYouTubeId(req.query.v);
  if (!v) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  try {
    const qualities = await getAvailableQualities(v);
    res.json({ qualities });
  } catch (err) {
    console.error('[qualities] Error:', err.message);
    res.json({ qualities: [
      { height: 360, label: '360p' },
      { height: 480, label: '480p' },
      { height: 720, label: '720p HD' }
    ]});
  }
});

// 4a2. Public track info for shared YouTube links
router.get('/track-info', async (req, res) => {
  const v = normalizeYouTubeId(req.query.v);
  if (!v) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  // Fast path: YouTube oEmbed (< 100ms, no heavy yt-dlp child process spawn)
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${encodeURIComponent(v)}&format=json`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const oembedRes = await fetch(oembedUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (oembedRes.ok) {
      const data = await oembedRes.json();
      const rawTitle = data.title || 'Bản nhạc trực tuyến';
      const cleanTitle = rawTitle.replace(/\s*-\s*YouTube$/i, '').trim();
      let rawArtist = data.author_name || 'Nghệ sĩ';
      if (/^youtube$/i.test(rawArtist.trim())) rawArtist = 'Nghệ sĩ';
      else rawArtist = rawArtist.replace(/\byoutube\b/gi, '').trim() || 'Nghệ sĩ';

      return res.json({
        track: {
          id: v,
          youtube_id: v,
          youtubeId: v,
          title: cleanTitle,
          artist: rawArtist,
          duration_sec: 0,
          thumbnail_url: data.thumbnail_url || `https://i.ytimg.com/vi/${v}/hqdefault.jpg`,
          isOnline: true
        }
      });
    }
  } catch (e) {
    // If oEmbed fails or times out, fallback to yt-dlp
  }

  try {
    const info = await fetchYouTubeInfo(`https://www.youtube.com/watch?v=${v}`);
    const rawTitle = info.title || 'Bản nhạc trực tuyến';
    const cleanTitle = rawTitle.replace(/\s*-\s*YouTube$/i, '').trim();
    let rawArtist = info.artist || info.uploader || 'Nghệ sĩ';
    if (/^youtube$/i.test(rawArtist.trim())) rawArtist = 'Nghệ sĩ';
    else rawArtist = rawArtist.replace(/\byoutube\b/gi, '').trim() || 'Nghệ sĩ';

    res.json({
      track: {
        id: v,
        youtube_id: v,
        youtubeId: v,
        title: cleanTitle,
        artist: rawArtist,
        duration_sec: info.duration || 0,
        thumbnail_url: info.thumbnail || `https://i.ytimg.com/vi/${v}/hqdefault.jpg`,
        isOnline: true
      }
    });
  } catch (err) {
    res.json({
      track: {
        id: v,
        youtube_id: v,
        youtubeId: v,
        title: 'Bản nhạc chia sẻ',
        artist: 'Nghệ sĩ',
        duration_sec: 0,
        thumbnail_url: `https://i.ytimg.com/vi/${v}/hqdefault.jpg`,
        isOnline: true
      }
    });
  }
});

// 4b. Online Proxy Stream (With Local Disk Cache for Instant Back/Repeat & Background Preload)
router.get('/stream', async (req, res) => {
  const { type = 'audio', quality } = req.query;
  const v = normalizeYouTubeId(req.query.v);
  if (!v) {
    return res.status(400).send('Video ID required');
  }

  // Validate video ID (alphanumeric, dash, underscore)
  if (!/^[a-zA-Z0-9_-]{8,15}$/.test(v)) {
    return res.status(400).send('Invalid Video ID');
  }

  // 1. FAST PATH: Check if track is already cached on local disk
  if (isStreamCached(v, type)) {
    touchCache(v, type);
    const { filePath, mime } = getCachePath(v, type);
    res.setHeader('Content-Type', mime);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'public, max-age=604800'); // 7 days browser cache
    return res.sendFile(filePath, { acceptRanges: true });
  }

  // 2. SLOW PATH: Stream directly from YouTube and cache in background
  try {
    const qualityNum = (type === 'video' && quality) ? parseInt(quality, 10) || null : null;
    const { streamUrl, mime } = await getStreamUrl(v, type, qualityNum);

    // Trigger background cache so that replaying or pressing "Back" is 0ms instant!
    cacheStreamInBackground(v, type, streamUrl);

    const parsed = new URL(streamUrl);

    const options = {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    };

    if (req.headers.range) {
      options.headers['Range'] = req.headers.range;
    }

    const proxyReq = https.request(options, (proxyRes) => {
      // Forward status code (200 or 206)
      res.status(proxyRes.statusCode || 200);

      // Forward headers
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

      // Ensure mime type if not present
      if (!res.getHeader('content-type')) {
        res.setHeader('Content-Type', mime);
      }
      res.setHeader('Accept-Ranges', 'bytes');

      proxyRes.pipe(res);
    });

    req.on('close', () => {
      proxyReq.destroy();
    });

    proxyReq.on('error', (err) => {
      if (err.code === 'ECONNRESET' || proxyReq.destroyed || req.destroyed) return;
      console.error('Stream proxy error:', err);
      if (!res.headersSent) {
        res.status(502).send('Error streaming from YouTube');
      }
    });

    proxyReq.end();
  } catch (err) {
    console.error('Error resolving stream URL:', err);
    if (!res.headersSent) {
      const msg = err.message || '';
      if (msg.includes('confirm your age') || msg.includes('inappropriate for some users')) {
        res.status(403).json({
          code: 'AGE_RESTRICTED',
          error: 'Video này bị giới hạn độ tuổi (18+).'
        });
      } else if (msg.includes('Private video') || msg.includes('Video unavailable') || msg.includes('blocked')) {
        res.status(404).json({
          code: 'UNAVAILABLE',
          error: 'Video này không khả dụng hoặc bị chặn trên YouTube.'
        });
      } else {
        res.status(500).json({ code: 'STREAM_ERROR', error: err.message });
      }
    }
  }
});

// 5. Preload Next Track in Background
router.get('/preload', requireAuth, async (req, res) => {
  const { type = 'audio' } = req.query;
  const v = normalizeYouTubeId(req.query.v);
  if (!v) {
    return res.status(400).json({ error: 'Video ID required' });
  }

  try {
    const status = await preloadTrack(v, type);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Check Cookie Status
router.get('/cookie-status', requireAuth, async (req, res) => {
  ensureCookieFile();
  const { hasCookie, isAuthed, headers } = getAuthAndCookieHeaders();
  if (!hasCookie) {
    return res.json({ hasCookie: false, isAuthed: false, isValid: false, message: 'Chưa nạp cookie' });
  }

  // Quick check if session is still accepted by YouTube
  let isValid = isAuthed;
  try {
    const testRes = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
        'x-youtube-client-name': '1',
        'x-youtube-client-version': '2.20260320.01.00',
        ...headers
      },
      body: JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: '2.20260320.01.00', hl: 'vi', gl: 'VN' } },
        browseId: 'FEsubscriptions'
      }),
      signal: AbortSignal.timeout(3500)
    });
    if (testRes.ok) {
      const data = await testRes.json();
      const str = JSON.stringify(data);
      const isLoggedOut = str.includes('AVATAR_LOGGED_OUT') || str.includes('Đăng nhập để xem cập nhật') || str.includes('Sign in to view');
      isValid = !isLoggedOut;
    }
  } catch {}

  res.json({
    hasCookie: true,
    isAuthed,
    isValid,
    message: isValid
      ? 'Đã kết nối tài khoản YouTube thành công (Đề xuất & Tìm kiếm chuẩn theo tài khoản)'
      : 'Cookie tài khoản đã hết hạn trên YouTube (vui lòng xuất lại cookies mới từ trình duyệt)'
  });
});

// 5. Save YouTube Cookies
router.post('/cookie', requireAuth, (req, res) => {
  const { cookies } = req.body || {};
  if (!cookies || !cookies.trim()) {
    return res.status(400).json({ error: 'Cookies text required' });
  }

  try {
    saveCookies(cookies.trim());
    db.prepare(`
      INSERT INTO settings (key, value) VALUES ('ytdlp_cookies', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(cookies.trim());

    res.json({ success: true, message: 'Đã lưu cookie thành công!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. YouTube Info Prefetch
router.post('/info', requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: 'YouTube URL is required' });
  }

  const validation = validateYouTubeUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  try {
    const info = await fetchYouTubeInfo(validation.url);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Download YouTube Video/Audio
router.post('/download', requireAuth, async (req, res) => {
  const { url, mediaType = 'audio', quality = '720p', items, createPlaylist, playlistName, title, artist, thumbnail } = req.body || {};
  const jobs = [];
  const userId = req.user?.id || 'default';

  // Batch / playlist download
  if (Array.isArray(items) && items.length > 0) {
    let playlistId = null;
    if (createPlaylist) {
      playlistId = crypto.randomUUID();
      const pName = playlistName || 'YouTube Playlist';
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO playlists (id, user_id, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(playlistId, userId, pName, now, now);
    }

    for (const item of items) {
      const itemUrl = item.url || (item.id ? `https://www.youtube.com/watch?v=${item.id}` : null);
      if (!itemUrl) continue;
      const v = validateYouTubeUrl(itemUrl);
      if (v.valid) {
        const job = queue.createJob({
          kind: 'youtube',
          url: v.url,
          mediaType,
          quality,
          userId,
          extra: { 
            playlistId, 
            title: item.title, 
            artist: item.artist || item.channel,
            thumbnail: item.thumbnail || item.thumbnail_url || thumbnail
          }
        });
        jobs.push(job);
      }
    }

    return res.json({ jobs, playlistId });
  }

  // Single download
  if (!url) {
    return res.status(400).json({ error: 'URL or items required' });
  }

  const validation = validateYouTubeUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.message });
  }

  const job = queue.createJob({
    kind: 'youtube',
    url: validation.url,
    mediaType,
    quality,
    userId,
    extra: { title, artist, thumbnail }
  });

  return res.json({ jobs: [job] });
});

// 8. Personal YouTube Data (Subscriptions, Liked Videos, Playlists)
router.get('/me-data', requireAuth, async (req, res) => {
  const user = req.user;
  if (!user || !user.google_id) {
    return res.json({ isGoogle: false, subscriptions: [], liked: [], playlists: [] });
  }

  const cached = db.prepare('SELECT * FROM user_youtube_data WHERE user_id = ?').get(user.id);
  let ytData = { subscriptions: [], liked: [], playlists: [] };
  if (cached) {
    try {
      ytData = {
        subscriptions: JSON.parse(cached.subscriptions || '[]'),
        liked: JSON.parse(cached.liked_videos || '[]'),
        playlists: JSON.parse(cached.playlists || '[]'),
      };
    } catch {}
  }

  // Auto-fetch if not cached yet
  if (!cached || !ytData.subscriptions.length) {
    try {
      const fresh = await fetchUserYouTubeData(user, req);
      ytData = fresh;
      db.prepare(`
        INSERT INTO user_youtube_data (user_id, subscriptions, liked_videos, playlists, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          subscriptions = excluded.subscriptions,
          liked_videos = excluded.liked_videos,
          playlists = excluded.playlists,
          updated_at = excluded.updated_at
      `).run(user.id, JSON.stringify(fresh.subscriptions), JSON.stringify(fresh.liked), JSON.stringify(fresh.playlists));
    } catch (e) {
      console.warn('Failed to fetch user youtube data:', e.message);
    }
  }

  res.json({ isGoogle: true, ...ytData });
});

router.post('/me-data/sync', requireAuth, async (req, res) => {
  const user = req.user;
  if (!user || !user.google_id) {
    return res.status(400).json({ error: 'Chỉ áp dụng cho tài khoản đăng nhập bằng Google' });
  }

  try {
    const fresh = await fetchUserYouTubeData(user, req);
    db.prepare(`
      INSERT INTO user_youtube_data (user_id, subscriptions, liked_videos, playlists, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        subscriptions = excluded.subscriptions,
        liked_videos = excluded.liked_videos,
        playlists = excluded.playlists,
        updated_at = excluded.updated_at
    `).run(user.id, JSON.stringify(fresh.subscriptions), JSON.stringify(fresh.liked), JSON.stringify(fresh.playlists));

    res.json({ success: true, ...fresh });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Trending Recommendations (Gemini-powered, weekly cached)
router.get('/recommendations', requireAuth, async (req, res) => {
  try {
    const force = req.query.force === 'true';
    const result = await getGeminiRecommendations({ force });
    res.json(result);
  } catch (err) {
    console.error('[Recommendations Error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
