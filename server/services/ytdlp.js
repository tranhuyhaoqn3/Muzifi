import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { config } from '../config.js';
import { getSetting } from '../db.js';

// Safe domain whitelist for SSRF prevention
const ALLOWED_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'www.youtu.be'
]);

export function validateYouTubeUrl(urlStr) {
  if (typeof urlStr !== 'string' || !urlStr.trim() || urlStr.trim().startsWith('-')) {
    return { valid: false, message: 'Invalid URL format' };
  }
  try {
    const parsed = new URL(urlStr.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, message: 'Invalid URL protocol' };
    }
    const host = parsed.hostname.toLowerCase();
    const isAllowed = ALLOWED_HOSTS.has(host) || Array.from(ALLOWED_HOSTS).some(h => host.endsWith('.' + h));
    if (!isAllowed) {
      return { valid: false, message: 'Only supported URLs are allowed' };
    }
    return { valid: true, url: parsed.toString() };
  } catch (err) {
    return { valid: false, message: 'Invalid URL format' };
  }
}

/**
 * Ensure cookie file is written from database to disk, returns path or null
 */
export function ensureCookieFile() {
  const cookiePath = path.join(config.DATA_DIR, 'cookies.txt');
  const cookiesText = getSetting('ytdlp_cookies', '').trim();
  if (cookiesText) {
    try {
      const existing = fs.existsSync(cookiePath) ? fs.readFileSync(cookiePath, 'utf8') : '';
      if (existing !== cookiesText) {
        fs.writeFileSync(cookiePath, cookiesText, 'utf8');
      }
    } catch {
      fs.writeFileSync(cookiePath, cookiesText, 'utf8');
    }
    return cookiePath;
  }
  return (fs.existsSync(cookiePath) && fs.statSync(cookiePath).size > 0) ? cookiePath : null;
}

/**
 * Get yt-dlp cookie argument if configured
 */
export function getCookieArgs() {
  const file = ensureCookieFile();
  return file ? ['--cookies', file] : [];
}

/**
 * Generate authenticated headers for YouTube InnerTube API requests
 * Includes cookies + SAPISIDHASH signature for genuine account access
 */
export function getAuthAndCookieHeaders(origin = 'https://www.youtube.com') {
  let cookiesText = getSetting('ytdlp_cookies', '').trim();
  const cookiePath = path.join(config.DATA_DIR, 'cookies.txt');
  if (!cookiesText && fs.existsSync(cookiePath)) {
    try { cookiesText = fs.readFileSync(cookiePath, 'utf8'); } catch {}
  }
  if (!cookiesText) return { headers: {}, hasCookie: false, cookieHeader: '', isAuthed: false, cookieMap: {} };

  const lines = cookiesText.split('\n');
  const cookieMap = {};
  const cookieParts = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length >= 6) {
      const name = parts[5]?.trim();
      const value = parts[6]?.trim() ?? '';
      if (name) {
        cookieMap[name] = value;
        cookieParts.push(`${name}=${value}`);
      }
    }
  }

  const cookieHeader = cookieParts.join('; ');
  const headers = {
    'origin': origin,
    'referer': origin + '/',
    'x-origin': origin,
    'cookie': cookieHeader
  };

  const sapisid = cookieMap['SAPISID'] || cookieMap['__Secure-3PAPISID'] || cookieMap['__Secure-1PAPISID'];
  if (sapisid) {
    const timestamp = Math.floor(Date.now() / 1000);
    const sha1 = crypto.createHash('sha1').update(`${timestamp} ${sapisid} ${origin}`).digest('hex');
    headers['authorization'] = `SAPISIDHASH ${timestamp}_${sha1}`;
  }

  return {
    headers,
    hasCookie: cookieParts.length > 0,
    cookieHeader,
    isAuthed: Boolean(sapisid),
    cookieMap
  };
}

/**
 * Normalize and extract genuine YouTube 11-char Video ID
 * Handles algorithmic Radio/Mix playlist IDs like RD<id>, RDMM<id>
 */
export function normalizeYouTubeId(rawId) {
  if (!rawId) return '';
  let id = String(rawId).trim();
  // Strip common playlist / mix prefixes
  if (id.startsWith('RDMM') && id.length >= 15) {
    id = id.slice(4, 15);
  } else if (id.startsWith('RD') && id.length >= 13) {
    id = id.slice(2, 13);
  }
  return id;
}

/**
 * Get JavaScript runtime arguments for yt-dlp to solve YouTube JS challenges
 */
export function getJsRuntimeArgs() {
  const denoPath = config.getDenoPath ? config.getDenoPath() : null;
  if (denoPath) {
    return ['--js-runtimes', `deno:${denoPath}`];
  }
  return [];
}

/**
 * Get client extractor arguments to support direct streaming formats (e.g. format 18 MP4)
 */
export function getClientArgs() {
  return ['--extractor-args', 'youtube:player_client=android,web'];
}

/**
 * Fetch video/playlist information using yt-dlp --dump-json / --flat-playlist
 */
export function fetchYouTubeInfo(url) {
  return new Promise((resolve, reject) => {
    const ytdlpBin = config.getYtDlpPath();
    const args = [
      ...getJsRuntimeArgs(),
      ...getClientArgs(),
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--no-check-certificates',
      ...getCookieArgs(),
      url
    ];

    const child = spawn(ytdlpBin, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`yt-dlp info error (${code}): ${stderr || 'Unknown error'}`));
      }
      try {
        const info = JSON.parse(stdout);
        const isPlaylist = Boolean(info._type === 'playlist' || Array.isArray(info.entries));
        
        if (isPlaylist) {
          const items = (info.entries || [])
            .filter(entry => entry && entry.id && entry.title !== '[Private video]' && entry.title !== '[Deleted video]')
            .map(entry => {
              let publishedTime = '';
              if (entry.upload_date && entry.upload_date.length === 8) {
                const y = entry.upload_date.substring(0, 4);
                const m = entry.upload_date.substring(4, 6);
                const d = entry.upload_date.substring(6, 8);
                publishedTime = `${d}/${m}/${y}`;
              }
              return {
                id: entry.id,
                url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                title: entry.title || 'Untitled',
                duration: entry.duration || 0,
                channel: entry.uploader || entry.channel || '',
                thumbnail: entry.thumbnails?.[0]?.url || entry.thumbnail || '',
                publishedTime,
              };
            });

          resolve({
            isPlaylist: true,
            title: info.title || 'YouTube Playlist',
            channel: info.uploader || info.channel || '',
            count: items.length,
            items,
            entries: items,
          });
        } else {
          // Single video
          const formats = info.formats || [];
          const videoHeights = [...new Set(formats
            .filter(f => f.vcodec && f.vcodec !== 'none' && f.height)
            .map(f => f.height))]
            .sort((a, b) => b - a);

          let publishedTime = '';
          if (info.upload_date && info.upload_date.length === 8) {
            const y = info.upload_date.substring(0, 4);
            const m = info.upload_date.substring(4, 6);
            const d = info.upload_date.substring(6, 8);
            publishedTime = `${d}/${m}/${y}`;
          }

          resolve({
            isPlaylist: false,
            id: info.id,
            url: info.webpage_url || url,
            title: (info.title || 'Untitled').replace(/\s*-\s*YouTube$/i, ''),
            channel: (info.uploader || info.channel || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ'),
            duration: info.duration || 0,
            thumbnail: info.thumbnail || '',
            description: info.description || '',
            availableResolutions: videoHeights,
            publishedTime,
          });
        }
      } catch (err) {
        reject(new Error(`Failed to parse yt-dlp metadata: ${err.message}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Download YouTube audio or video
 * Tracks progress via yt-dlp standard output
 */
export function downloadYouTube({
  url,
  mediaType = 'audio',
  quality = '720p',
  outputPath,
  onProgress,
  abortSignal
}) {
  return new Promise((resolve, reject) => {
    const ytdlpBin = config.getYtDlpPath();
    const args = [
      ...getJsRuntimeArgs(),
      ...getClientArgs(),
      '--newline',
      '--no-warnings',
      '--no-check-certificates',
      ...getCookieArgs(),
    ];

    if (mediaType === 'audio') {
      // Audio: bestaudio -> m4a, add metadata & thumbnail
      args.push(
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '-x',
        '--audio-format', 'm4a',
        '--audio-quality', '0',
        '--add-metadata',
        '--postprocessor-args', 'ffmpeg:-vn -movflags +faststart',
        '-o', outputPath
      );
    } else {
      // Video: max height based on requested quality, prefer H.264 (avc1) + AAC mp4 for iOS native playback
      const maxH = parseInt(quality.replace('p', ''), 10) || 720;
      const formatStr = `bv*[vcodec^=avc1][height<=${maxH}]+ba[ext=m4a]/b[ext=mp4][height<=${maxH}]/bv*[height<=${maxH}]+ba/b`;
      args.push(
        '-f', formatStr,
        '--merge-output-format', 'mp4',
        '--postprocessor-args', 'ffmpeg:-movflags +faststart',
        '-o', outputPath
      );
    }

    args.push(url);

    const child = spawn(ytdlpBin, args);
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        child.kill('SIGKILL');
        reject(new Error('Download cancelled by user'));
      });
    }

    child.stdout.on('data', chunk => {
      const line = chunk.toString();
      // yt-dlp progress format: [download]  45.2% of 12.34MiB at 1.23MiB/s ETA 00:05
      const percentMatch = line.match(/\[download\]\s+(\d+\.?\d*)%/);
      const speedMatch = line.match(/at\s+([0-9.]+\s*[KMGT]?i?B\/s)/i);
      const etaMatch = line.match(/ETA\s+([0-9:]+)/i);

      if (percentMatch && onProgress) {
        onProgress({
          progress: parseFloat(percentMatch[1]),
          speed: speedMatch ? speedMatch[1] : '',
          eta: etaMatch ? etaMatch[1] : '',
          raw: line.trim()
        });
      }
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('close', code => {
      if (code === 0) {
        resolve({ outputPath });
      } else {
        reject(new Error(`yt-dlp download failed with code ${code}: ${stderr.slice(-300)}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * In-memory stream URL cache to reduce yt-dlp queries: key -> { url, mime, expiresAt }
 */
const streamUrlCache = new Map();

/**
 * In-memory cache for available qualities: videoId -> { qualities, expiresAt }
 */
const qualitiesCache = new Map();

/**
 * Fetch available video qualities for a YouTube video
 * Returns array of quality objects: [{ height: 1080, label: '1080p' }, ...]
 */
export async function getAvailableQualities(rawVideoId) {
  const videoId = normalizeYouTubeId(rawVideoId);
  const now = Date.now();
  const cached = qualitiesCache.get(videoId);

  if (cached && cached.expiresAt > now) {
    return cached.qualities;
  }

  const ytdlpBin = config.getYtDlpPath();
  const args = [
    ...getJsRuntimeArgs(),
    // NOTE: Do NOT use getClientArgs() (android client) here — it only returns 360p.
    // Without client args, yt-dlp gets all qualities: 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2160p.
    '--dump-json',
    '--no-download',
    '--no-warnings',
    '--no-check-certificates',
    ...getCookieArgs(),
    `https://www.youtube.com/watch?v=${videoId}`
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpBin, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        console.warn('[getAvailableQualities] yt-dlp error:', stderr.slice(-200));
        // Fallback: return default quality list
        const fallback = [
          { height: 360, label: '360p' },
          { height: 480, label: '480p' },
          { height: 720, label: '720p HD' }
        ];
        qualitiesCache.set(videoId, { qualities: fallback, expiresAt: now + 10 * 60 * 1000 });
        return resolve(fallback);
      }

      try {
        const info = JSON.parse(stdout);
        const formats = info.formats || [];

        // Extract unique video heights that have both video and audio, or just video
        const heightSet = new Set();
        for (const f of formats) {
          if (f.vcodec && f.vcodec !== 'none' && f.height && f.height >= 144) {
            heightSet.add(f.height);
          }
        }

        // Standard quality tiers
        const standardTiers = [144, 240, 360, 480, 720, 1080, 1440, 2160];
        const availableHeights = [...heightSet].filter(h => standardTiers.includes(h)).sort((a, b) => a - b);

        // If no standard tiers found, use the raw heights
        const heights = availableHeights.length > 0 ? availableHeights : [...heightSet].sort((a, b) => a - b);

        const qualities = heights.map(h => {
          let label = `${h}p`;
          if (h >= 1080) label += ' HD';
          if (h >= 1440) label = `${h}p QHD`;
          if (h >= 2160) label = `${h}p 4K`;
          if (h === 720) label = '720p HD';
          return { height: h, label };
        });

        // Always ensure at least 360p is available
        if (qualities.length === 0) {
          qualities.push({ height: 360, label: '360p' }, { height: 720, label: '720p HD' });
        }

        qualitiesCache.set(videoId, { qualities, expiresAt: now + 30 * 60 * 1000 });
        resolve(qualities);
      } catch (err) {
        const fallback = [
          { height: 360, label: '360p' },
          { height: 480, label: '480p' },
          { height: 720, label: '720p HD' }
        ];
        qualitiesCache.set(videoId, { qualities: fallback, expiresAt: now + 10 * 60 * 1000 });
        resolve(fallback);
      }
    });

    child.on('error', () => {
      const fallback = [
        { height: 360, label: '360p' },
        { height: 720, label: '720p HD' }
      ];
      resolve(fallback);
    });
  });
}

/**
 * Resolve direct Google Video stream URL for audio or video
 * @param {string} rawVideoId - YouTube video ID
 * @param {string} mediaType - 'audio' or 'video'
 * @param {number|null} quality - Max height for video (e.g. 720, 1080). Null = auto
 */
export async function getStreamUrl(rawVideoId, mediaType = 'audio', quality = null) {
  const videoId = normalizeYouTubeId(rawVideoId);
  const qualitySuffix = (mediaType === 'video' && quality) ? `_${quality}p` : '';
  const cacheKey = `${videoId}_${mediaType}${qualitySuffix}`;
  const now = Date.now();
  const cached = streamUrlCache.get(cacheKey);

  if (cached && cached.expiresAt > now) {
    return cached;
  }

  const ytdlpBin = config.getYtDlpPath();
  let formatStr;
  if (mediaType === 'video') {
    const maxH = quality || 720;
    // Prefer H.264 (avc1) for maximum browser compatibility, with progressive format 18 as fallback
    formatStr = `bv*[vcodec^=avc1][height<=${maxH}]+ba[ext=m4a]/b[ext=mp4][height<=${maxH}]/18/b[height<=${maxH}]/b/best`;
  } else {
    formatStr = 'ba[ext=m4a]/ba/b';
  }

  const args = [
    ...getJsRuntimeArgs(),
    // For video: don't use android client — it only returns 360p.
    // For audio: use android client for reliable m4a stream.
    ...(mediaType === 'video' ? [] : getClientArgs()),
    '-g',
    '-f', formatStr,
    '--no-warnings',
    ...getCookieArgs(),
    `https://www.youtube.com/watch?v=${videoId}`
  ];

  return new Promise((resolve, reject) => {
    const child = spawn(ytdlpBin, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const streamUrl = lines.find(l => l.startsWith('http'));

      if (code !== 0 || !streamUrl) {
        return reject(new Error(`yt-dlp stream resolution failed: ${stderr || 'No stream URL returned'}`));
      }
      const mime = mediaType === 'video' ? 'video/mp4' : 'audio/mp4';
      const result = {
        streamUrl,
        mime,
        quality: quality || 'auto',
        expiresAt: now + 30 * 60 * 1000 // 30 min cache
      };
      streamUrlCache.set(cacheKey, result);
      resolve(result);
    });

    child.on('error', reject);
  });
}

/**
 * Search YouTube
 */
function fallbackYtDlpSearch(query, limit = 20) {
  return new Promise((resolve, reject) => {
    const ytdlpBin = config.getYtDlpPath();
    const args = [
      ...getJsRuntimeArgs(),
      '--dump-single-json',
      '--flat-playlist',
      '--no-warnings',
      '--no-check-certificates',
      ...getCookieArgs(),
      `ytsearch${limit}:${query}`
    ];

    const child = spawn(ytdlpBin, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`Search failed: ${stderr}`));
      }
      try {
        const json = JSON.parse(stdout);
        const entries = (json.entries || []).map(entry => {
          const id = normalizeYouTubeId(entry.id);
          if (!id || id.length !== 11 || id.startsWith('RD') || id.startsWith('VL')) {
            return null;
          }
          let publishedTime = '';
          if (entry.upload_date && entry.upload_date.length === 8) {
            const y = entry.upload_date.substring(0, 4);
            const m = entry.upload_date.substring(4, 6);
            const d = entry.upload_date.substring(6, 8);
            publishedTime = `${d}/${m}/${y}`;
          }
          return {
            id,
            url: `https://www.youtube.com/watch?v=${id}`,
            title: (entry.title || 'Untitled').replace(/^Mix\s*-\s*/i, '').replace(/\s*-\s*YouTube$/i, ''),
            channel: (entry.uploader || entry.channel || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ'),
            duration: entry.duration || 0,
            views: entry.view_count || null,
            viewsText: entry.view_count ? `${entry.view_count.toLocaleString()} lượt xem` : '',
            thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
            publishedTime,
          };
        }).filter(Boolean);

        resolve({ items: entries });
      } catch (err) {
        reject(new Error(`Failed to parse search results: ${err.message}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Get Search Suggestions (auto-complete) from YouTube
 */
export async function getSearchSuggestions(query) {
  if (!query || !query.trim()) return [];
  const q = query.trim();

  // 1. YouTube suggestions via suggestqueries API (official fast autocomplete for YouTube)
  try {
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&hl=vi&gl=VN&q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(3000)
    });
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json?.[1])) {
        return json[1].slice(0, 10);
      }
    }
  } catch (e) {}

  // 2. YouTube InnerTube suggestions fallback
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/get_search_suggestions?prettyPrint=false', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'origin': 'https://www.youtube.com',
        'referer': 'https://www.youtube.com/',
        'x-youtube-client-name': '1',
        'x-youtube-client-version': '2.20240901.00.00'
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240901.00.00',
            hl: 'vi',
            gl: 'VN'
          }
        },
        input: q
      }),
      signal: AbortSignal.timeout(3000)
    });

    if (res.ok) {
      const data = await res.json();
      const suggestions = [];
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.searchSuggestionRenderer) {
          const runs = node.searchSuggestionRenderer.suggestion?.runs || [];
          const text = runs.map(r => r.text).join('');
          if (text && !suggestions.includes(text)) suggestions.push(text);
          return;
        }
        for (const k of Object.keys(node)) {
          if (k === 'trackingParams') continue;
          walk(node[k]);
        }
      }
      walk(data);
      if (suggestions.length > 0) return suggestions.slice(0, 10);
    }
  } catch (err) {}

  return [];
}

/**
 * Search YouTube (Regular YouTube Search)
 */
export async function searchYouTube(query, limit = 20, page = 1) {
  const { headers: authHeaders } = getAuthAndCookieHeaders('https://www.youtube.com');

  let effectiveQuery = query;
  if (page === 2) effectiveQuery = `${query} official audio`;
  else if (page === 3) effectiveQuery = `${query} bài hát`;
  else if (page === 4) effectiveQuery = `${query} album`;
  else if (page === 5) effectiveQuery = `${query} remix`;
  else if (page > 5) effectiveQuery = `${query} tuyển chọn hay nhất`;

  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'origin': 'https://www.youtube.com',
        'referer': 'https://www.youtube.com/',
        'x-youtube-client-name': '1',
        'x-youtube-client-version': '2.20240901.00.00',
        ...authHeaders
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240901.00.00',
            hl: 'vi',
            gl: 'VN'
          }
        },
        query: effectiveQuery
      }),
      signal: AbortSignal.timeout(7000)
    });

    if (res.ok) {
      const data = await res.json();
      const items = [];
      const seen = new Set();
      function walk(node) {
        if (!node || typeof node !== 'object') return;
        if (node.videoRenderer || node.compactVideoRenderer) {
          const r = node.videoRenderer || node.compactVideoRenderer;
          const videoId = normalizeYouTubeId(r.videoId);
          if (videoId && videoId.length === 11 && !seen.has(videoId)) {
            seen.add(videoId);
            const title = (r.title?.runs?.[0]?.text || r.title?.simpleText || 'Untitled').replace(/^Mix\s*-\s*/i, '').replace(/\s*-\s*YouTube$/i, '');
            const channel = (r.ownerText?.runs?.[0]?.text || r.shortBylineText?.runs?.[0]?.text || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ');
            const durationText = r.lengthText?.simpleText || r.lengthText?.runs?.[0]?.text || '';
            let duration = 0;
            if (durationText) {
              const parts = durationText.split(':').map(Number);
              if (parts.length === 2) duration = parts[0] * 60 + parts[1];
              else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
            const thumbs = r.thumbnail?.thumbnails || [];
            const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            const publishedTime = r.publishedTimeText?.simpleText || r.publishedTimeText?.runs?.[0]?.text || '';
            const viewsText = r.viewCountText?.simpleText || r.shortViewCountText?.simpleText || '';

            items.push({
              id: videoId,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              title,
              channel,
              duration,
              thumbnail,
              publishedTime,
              viewsText
            });
          }
          return;
        }
        for (const k of Object.keys(node)) {
          if (k === 'trackingParams' || k === 'clickTrackingParams') continue;
          walk(node[k]);
        }
      }
      walk(data);
      if (items.length > 0) {
        return { items: items.slice(0, limit) };
      }
    }
  } catch (err) {
    console.warn('[searchYouTube] YouTube search notice, falling back to yt-dlp:', err.message);
  }

  return fallbackYtDlpSearch(query, limit);
}

/**
 * Parse Netscape cookies.txt format into cookie header string and a Map for lookup
 */
function parseCookieFile(cookiePath) {
  const cookieMap = new Map();
  const cookieParts = [];
  try {
    const lines = fs.readFileSync(cookiePath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('\t');
      // Netscape format: domain, flag, path, secure, expiry, name, value
      if (parts.length >= 6) {
        const name = parts[5]?.trim();
        const value = parts[6]?.trim() ?? '';
        if (name) {
          cookieMap.set(name, value);
          cookieParts.push(`${name}=${value}`);
        }
      }
    }
  } catch {}
  return { header: cookieParts.join('; '), map: cookieMap };
}

/**
 * Fetch genuine YouTube Home feed directly via InnerTube Browse API
 * Priority: YouTube Home (FEwhat_to_watch) → YouTube Music Home (FEmusic_home)
 * Uses user cookies for personalised recommendations.
 */
export async function fetchYouTubeHomeFeed() {
  const { headers: authHeaders, hasCookie, isAuthed } = getAuthAndCookieHeaders('https://www.youtube.com');
  const { headers: musicAuthHeaders } = getAuthAndCookieHeaders('https://music.youtube.com');

  const items = [];
  const seenIds = new Set();

  // ── Walk helpers ────────────────────────────────────────────────────────────

  function extractVideoFromRenderer(renderer) {
    if (!renderer) return null;
    const videoId = renderer.videoId
      || renderer.navigationEndpoint?.watchEndpoint?.videoId
      || renderer.playlistItemData?.videoId
      || renderer.doubleTapCommand?.watchEndpoint?.videoId;
    if (!videoId || videoId.length !== 11) return null;

    const title =
      renderer.title?.runs?.[0]?.text
      || renderer.title?.simpleText
      || renderer.headline?.simpleText
      || renderer.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text
      || '';
    if (!title) return null;

    const channel =
      renderer.ownerText?.runs?.[0]?.text
      || renderer.longBylineText?.runs?.[0]?.text
      || renderer.shortBylineText?.runs?.[0]?.text
      || renderer.subtitle?.runs?.[0]?.text
      || renderer.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0]?.text
      || 'YouTube Music';

    const thumbs =
      renderer.thumbnail?.thumbnails
      || renderer.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails
      || renderer.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails
      || [];
    let thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    if (thumbnail.includes('=w') && thumbnail.includes('-h')) {
      thumbnail = thumbnail.replace(/=w\d+-h\d+[^=]*$/, '=w544-h544-l90-rj');
    }

    const durationText =
      renderer.lengthText?.simpleText
      || renderer.lengthText?.runs?.[0]?.text
      || '';
    let duration = 0;
    if (durationText) {
      const parts = durationText.split(':').map(Number);
      if (parts.length === 2) duration = parts[0] * 60 + parts[1];
      else if (parts.length === 3) duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    const publishedTime =
      renderer.publishedTimeText?.simpleText
      || renderer.publishedTimeText?.runs?.[0]?.text
      || '';

    const viewsText =
      renderer.viewCountText?.simpleText
      || renderer.shortViewCountText?.simpleText
      || '';

    return { id: videoId, url: `https://www.youtube.com/watch?v=${videoId}`, title, channel, duration, thumbnail, publishedTime, viewsText };
  }

  function walkNode(node) {
    if (!node || typeof node !== 'object') return;

    // YouTube Home formats
    if (node.richItemRenderer) {
      const inner = node.richItemRenderer.content;
      if (inner) {
        const item = extractVideoFromRenderer(
          inner.videoRenderer || inner.reelItemRenderer || inner.shortsLockupViewModel
        );
        if (item && !seenIds.has(item.id)) {
          seenIds.add(item.id);
          items.push(item);
        }
        return;
      }
    }

    if (node.videoRenderer || node.compactVideoRenderer) {
      const r = node.videoRenderer || node.compactVideoRenderer;
      const item = extractVideoFromRenderer(r);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
      return;
    }

    // YouTube Music formats
    if (node.musicResponsiveListItemRenderer) {
      const item = extractVideoFromRenderer(node.musicResponsiveListItemRenderer);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
      return;
    }

    if (node.musicTwoRowItemRenderer) {
      const item = extractVideoFromRenderer(node.musicTwoRowItemRenderer);
      if (item && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        items.push(item);
      }
      return;
    }

    // Recurse into arrays and objects
    if (Array.isArray(node)) {
      for (const el of node) walkNode(el);
    } else {
      for (const k of Object.keys(node)) {
        if (k === 'trackingParams' || k === 'clickTrackingParams' || k === 'impressionUrls') continue;
        walkNode(node[k]);
      }
    }
  }

  // ── Source 1: YouTube Home & Explore (FEwhat_to_watch / FEexplore / FEmusic_home) ──
  const browseConfigs = [
    { id: 'FEwhat_to_watch', url: 'https://www.youtube.com', client: 'WEB', ver: '2.20240901.00.00', num: '1', headers: authHeaders },
    { id: 'FEexplore', url: 'https://www.youtube.com', client: 'WEB', ver: '2.20240901.00.00', num: '1', headers: authHeaders },
    { id: 'FEmusic_home', url: 'https://music.youtube.com', client: 'WEB_REMIX', ver: '1.20260320.01.00', num: '67', headers: musicAuthHeaders }
  ];

  for (const cfg of browseConfigs) {
    try {
      const res = await fetch(`${cfg.url}/youtubei/v1/browse?prettyPrint=false`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'origin': cfg.url,
          'referer': `${cfg.url}/`,
          'x-youtube-client-name': cfg.num,
          'x-youtube-client-version': cfg.ver,
          ...cfg.headers
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: cfg.client,
              clientVersion: cfg.ver,
              hl: 'vi',
              gl: 'VN'
            }
          },
          browseId: cfg.id
        }),
        signal: AbortSignal.timeout(8000)
      });

      if (res.ok) {
        const json = await res.json();
        walkNode(json);
        console.log(`[HomeFeed] YouTube ${cfg.id} yielded ${items.length} items (cookie=${hasCookie}, authed=${isAuthed})`);
      }
    } catch (e) {
      console.warn(`[HomeFeed] browse error (${cfg.id}):`, e.message);
    }
    if (items.length >= 24) break;
  }

  // ── Source 4: Search Trending fallback if still empty ────────────────────────
  // Use multiple Gen Z queries and pick randomly for variety
  if (items.length === 0) {
    const fallbackQueries = [
      'rap việt hot nhất 2025',
      'vpop trending mới nhất',
      'nhạc trẻ hay nhất 2025 tiktok',
      'top hits vietnam 2025',
      'nhạc hot gen z việt nam'
    ];
    const query = fallbackQueries[Math.floor(Math.random() * fallbackQueries.length)];
    try {
      const fallbackSearch = await searchYouTube(query, 20);
      if (fallbackSearch?.items?.length) {
        for (const item of fallbackSearch.items) {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            items.push(item);
          }
        }
      }
    } catch (e) {
      console.warn('[HomeFeed] Fallback search error:', e.message);
    }
  }

  return {
    items,
    isPersonalized: isAuthed && items.length > 0,
    hasCookie
  };
}

/**
 * Get YouTube Feed (Genuine Homepage Feed directly from YouTube - NO search!)
 */
export async function getFeed(queryTopic = '', page = 1) {
  // If user specifically requested a search/topic
  if (queryTopic) {
    return searchYouTube(queryTopic, 24, page);
  }

  if (page <= 1) {
    const homeFeed = await fetchYouTubeHomeFeed();
    if (homeFeed.items && homeFeed.items.length >= 10) {
      return homeFeed;
    }
    if (homeFeed.items && homeFeed.items.length > 0) {
      // If home feed returned few items, combine with trending Gen Z content
      const trending = await searchYouTube('rap việt vpop hot trending 2025', 15, 1);
      const combined = [...homeFeed.items, ...(trending.items || [])];
      const seen = new Set();
      const unique = combined.filter(it => {
        if (!it.id || seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
      return { items: unique, isPersonalized: homeFeed.isPersonalized, hasCookie: homeFeed.hasCookie };
    }
  }

  // Rotating Gen Z Vietnamese music topics for endless scrolling
  const feedTopics = [
    'rap việt mới nhất 2025',
    'vpop hot trending tiktok 2025',
    'nhạc trẻ gây bão tiktok',
    'top hits vietnam gen z',
    'underground việt nam hay nhất',
    'r&b việt nam chill',
    'nhạc edm remix việt sôi động 2025',
    'indie việt nam mới nhất',
    'lofi chill việt nam học bài',
    'drill rap việt underground',
    'nhạc tiktok việt nam viral',
    'hip hop việt nam playlist',
    'acoustic cover vpop hay nhất',
    'nhạc việt hot nhất tuần này'
  ];
  const topicIndex = Math.max(0, (page - 1) % feedTopics.length);
  return searchYouTube(feedTopics[topicIndex], 20, 1);
}

export function getCookieHeader() {
  const { cookieHeader } = getAuthAndCookieHeaders();
  return cookieHeader || '';
}

// Dynamic YouTube Category & Mood Mapping
const YOUTUBE_CATEGORY_LABELS = {
  'Music': 'Âm nhạc',
  'Entertainment': 'Giải trí',
  'People & Blogs': 'Đời sống & Podcast',
  'Education': 'Giáo dục & Tri thức',
  'News & Politics': 'Tin tức & Thời sự',
  'Film & Animation': 'Phim & Hoạt hình',
  'Comedy': 'Hài kịch & Giải trí',
  'Science & Technology': 'Khoa học & Công nghệ',
  'Gaming': 'Trò chơi & Gaming',
  'Sports': 'Thể thao',
  'Howto & Style': 'Đời sống & Hướng dẫn',
  'Travel & Events': 'Du lịch & Khám phá',
  'Autos & Vehicles': 'Xe & Phương tiện',
  'Nonprofits & Activism': 'Cộng đồng & Xã hội'
};

const IGNORED_CHIPS = new Set([
  'tất cả', 'all', 'khám phá', 'discover', 'đình đám', 'ít phổ biến', 'quen thuộc', 'gần đây'
]);

export function detectMusicGenreAndTopic({
  title = '',
  author = '',
  category = '',
  keywords = [],
  description = '',
  chips = [],
  hashtags = [],
  hasMusicQueue = false
}) {
  const cleanAuthor = (author || '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/\s*(official|channel|vevo|records|entertainment|production|media|tv)\b/gi, '')
    .trim();

  // 1. YouTube natively categorizes content (Official Music category or YouTube Music genre/mood chips)
  const isMusic = category === 'Music' || (chips && chips.length > 0);

  // 2. Tab labels / mood / genre chips from YouTube Music
  const descriptiveChip = (chips || []).find(c => c && !IGNORED_CHIPS.has(c.toLowerCase().trim()));

  // 3. Native hashtags or prominent keywords from YouTube metadata
  const authorWords = (cleanAuthor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 1);
  const topHashtag = (hashtags || []).find(h => h && h.length > 2 && !/shorts/i.test(h));
  const rawTopKeyword = (keywords || []).find(k => {
    if (!k || k.length < 4 || (/^[a-z0-9]+$/i.test(k) && k.length <= 4)) return false;
    const kWords = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z]/g, ' ').split(/\s+/).filter(w => w.length > 1);
    const overlap = kWords.filter(w => authorWords.includes(w));
    if (overlap.length >= 1 && overlap.length >= kWords.length * 0.5) return false;
    return true;
  });
  const topKeyword = rawTopKeyword ? rawTopKeyword.charAt(0).toUpperCase() + rawTopKeyword.slice(1) : '';

  // 4. Dynamically determine genre / label from YouTube's native data
  let genre = '';
  if (descriptiveChip) {
    genre = descriptiveChip;
  } else if (topKeyword && !isMusic) {
    // For non-music (stories, podcasts, documentaries), creator keywords provide exact content topic (e.g. "Truyện ma", "Podcast")
    genre = topKeyword;
  } else if (category && YOUTUBE_CATEGORY_LABELS[category]) {
    genre = YOUTUBE_CATEGORY_LABELS[category];
  } else if (topHashtag) {
    genre = topHashtag;
  } else if (category) {
    genre = category;
  } else {
    genre = isMusic ? 'Âm nhạc đề xuất' : 'Radio trực tuyến';
  }

  // 5. Dynamic Topic (Radio [Creator / Channel])
  let topic = '';
  if (cleanAuthor) {
    topic = `Radio ${cleanAuthor}`;
  } else if (genre) {
    topic = `${genre} Đề Xuất`;
  } else {
    topic = 'Radio Trực Tuyến';
  }

  // 6. Dynamic Search Fallback Query without arbitrary keywords
  const searchFallbackQuery = cleanAuthor || title;

  return {
    isMusic,
    genre,
    topic,
    themeDescription: `Nội dung liên quan ${cleanAuthor || genre || title}`,
    searchFallbackQuery
  };
}

// ── Content Hygiene & Sequencing Helpers ──────────────────────────
const JUNK_TITLE_REGEX = /\b(karaoke|beat chuẩn|tone nam|tone nữ|nhạc chuông|ringtone|teaser)\b/i;

function isRelevantToSeed(candidate, seed = {}) {
  if (!candidate || !candidate.title) return false;
  if (candidate.duration && candidate.duration > 0 && candidate.duration < 15) return false;
  if (JUNK_TITLE_REGEX.test(candidate.title)) return false;

  const cTitle = (candidate.title || '').toLowerCase();
  const cChannel = (candidate.channel || '').toLowerCase();
  const sAuthor = (seed.author || '').toLowerCase().replace(/official|channel|vevo|tv|records/gi, '').trim();
  const isSeedMusic = Boolean(seed.isMusic);
  const seedDuration = Number(seed.duration) || 0;

  // 1. Same creator/channel is always relevant
  if (sAuthor && sAuthor.length > 2 && (cChannel.includes(sAuthor) || sAuthor.includes(cChannel))) {
    return true;
  }

  // 2. Cross-domain noise protection:
  if (!isSeedMusic) {
    // If seed is non-music (stories, podcasts, audiobooks, talks):
    // Reject obvious music tracks
    if (/\b(nhạc|remix|vinahouse|karaoke|beat chuẩn|mv|official music|music video|ca sĩ|bài hát|dj)\b/i.test(cTitle)) {
      return false;
    }
    // Reject unrelated entertainment noise (cartoons, comedy sketches, gaming) unless seed is also cartoon/comedy
    if (/\b(doraemon|faptv|cơm nguội|hoạt hình|gameplay|liên quân|pubg)\b/i.test(cTitle) && !/\b(doraemon|faptv|hoạt hình|gameplay)\b/i.test(seed.title || '')) {
      return false;
    }
    // Duration filter: If seed is long-form (> 600s), reject short clips (< 300s) from different channels
    if (seedDuration > 600 && candidate.duration > 0 && candidate.duration < 300) {
      return false;
    }
  } else {
    // If seed is music:
    // Reject long talks, news, stories, podcasts from appearing in music queue
    if (/\b(truyện ma|chuyện ma|podcast|sách nói|audiobook|tin tức|thời sự|talkshow|phỏng vấn|tâm sự đêm khuya)\b/i.test(cTitle)) {
      return false;
    }
    // Reject massive streams (> 1800s) unless it's explicitly an album/playlist
    if (seedDuration > 0 && seedDuration < 600 && candidate.duration > 1800) {
      if (!/album|full|tuyển tập|nonstop|mixtape/i.test(cTitle)) {
        return false;
      }
    }
  }

  // 3. Match against seed tags or keywords:
  if (Array.isArray(seed.tags) && seed.tags.length > 0) {
    const hasTagMatch = seed.tags.some(tag => {
      if (!tag || tag.length < 3) return false;
      const tLow = tag.toLowerCase();
      return cTitle.includes(tLow) || cChannel.includes(tLow);
    });
    if (hasTagMatch) return true;
  }

  // 4. Match against genre or category
  if (seed.genre && seed.genre.length > 2) {
    const gLow = seed.genre.toLowerCase();
    if (cTitle.includes(gLow) || cChannel.includes(gLow)) return true;
  }

  // For music, recommendations from YouTube sidebar are usually music after passing the negative filters above
  if (isSeedMusic) {
    return true;
  }

  return false;
}

function getNormalizedTitleKey(title) {
  return (title || '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official\s*(music\s*video|mv|audio|lyric\s*video|video)/gi, '')
    .replace(/feat\.?|ft\.?/gi, '')
    .replace(/[^a-z0-9\u00C0-\u024F\u1EA0-\u1EF9]/gi, '')
    .trim();
}

function extractArtistNames(title = '', author = '') {
  const names = new Set();
  const cleanAuthor = (author || '').replace(/official|vevo|channel|music|records|production|media/gi, '').trim().toLowerCase();
  if (cleanAuthor.length > 1) {
    names.add(cleanAuthor);
  }
  const parts = title.split(/\s*[-–|]\s*/);
  if (parts.length >= 2) {
    const p0 = parts[0].trim().toLowerCase();
    if (!/tập|trailer|official|mv|video|lyric/i.test(p0) && p0.length < 35) {
      p0.split(/[,&x+×]|(?:\s+ft\.?\s+)|\s+feat\.?\s+/i).forEach(a => {
        const c = a.trim();
        if (c.length > 1 && c.length < 25) names.add(c);
      });
    }
  }
  return Array.from(names);
}

function matchesSeedArtist(track, seedArtists) {
  if (!seedArtists || seedArtists.length === 0) return false;
  const cLower = (track.channel || '').toLowerCase();
  const tLower = (track.title || '').toLowerCase();
  return seedArtists.some(a => cLower.includes(a) || tLower.includes(a));
}

/**
 * Pacing & Sequence:
 * 1. Puts a top related item by seed creator first
 * 2. Interleaves related content smoothly
 */
function sequenceSpotifyQueue(candidates, seedArtists, limit = 20) {
  const sameArtist = [];
  const otherArtists = [];

  for (const t of candidates) {
    if (matchesSeedArtist(t, seedArtists)) {
      sameArtist.push(t);
    } else {
      otherArtists.push(t);
    }
  }

  const result = [];
  // Slot 1: If available, pick 1 hit by the same creator
  if (sameArtist.length > 0) {
    result.push(sameArtist.shift());
  }

  let consecutiveSame = result.length > 0 ? 1 : 0;
  let sIdx = 0;
  let oIdx = 0;

  while ((sIdx < sameArtist.length || oIdx < otherArtists.length) && result.length < limit) {
    if (oIdx < otherArtists.length && (consecutiveSame >= 2 || sIdx >= sameArtist.length || (oIdx % 3 !== 0))) {
      result.push(otherArtists[oIdx++]);
      consecutiveSame = 0;
    } else if (sIdx < sameArtist.length && consecutiveSame < 2) {
      result.push(sameArtist[sIdx++]);
      consecutiveSame++;
    } else if (oIdx < otherArtists.length) {
      result.push(otherArtists[oIdx++]);
      consecutiveSame = 0;
    } else {
      break;
    }
  }

  return result;
}

/**
 * Get Radio / Related recommendations for ANY media (music, stories, podcasts, talks, radio)
 */
export async function getRelatedTracks(rawVideoId, limit = 20) {
  const videoId = normalizeYouTubeId(rawVideoId);
  if (!videoId || videoId.length !== 11) {
    throw new Error('Invalid YouTube video ID');
  }

  const { headers: ytHeaders } = getAuthAndCookieHeaders('https://www.youtube.com');
  const { headers: ytMusicHeaders } = getAuthAndCookieHeaders('https://music.youtube.com');

  let seedMeta = null;
  let ytNextData = null;
  let ytMusicNextData = null;

  try {
    const [playerRes, ytNextRes, ytMusicRes] = await Promise.all([
      fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': '2.20240920.01.00',
          ...ytHeaders
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240920.01.00',
              hl: 'vi',
              gl: 'VN'
            }
          },
          videoId
        }),
        signal: AbortSignal.timeout(6000)
      }).catch(() => null),

      fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
          'x-youtube-client-name': '1',
          'x-youtube-client-version': '2.20240920.01.00',
          ...ytHeaders
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240920.01.00',
              hl: 'vi',
              gl: 'VN'
            }
          },
          videoId
        }),
        signal: AbortSignal.timeout(6000)
      }).catch(() => null),

      fetch('https://music.youtube.com/youtubei/v1/next?prettyPrint=false', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
          'origin': 'https://music.youtube.com',
          'x-youtube-client-name': '67',
          'x-youtube-client-version': '1.20260320.01.00',
          ...ytMusicHeaders
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB_REMIX',
              clientVersion: '1.20260320.01.00',
              hl: 'vi',
              gl: 'VN'
            }
          },
          videoId,
          playlistId: 'RD' + videoId
        }),
        signal: AbortSignal.timeout(6000)
      }).catch(() => null)
    ]);

    if (playerRes && playerRes.ok) seedMeta = await playerRes.json().catch(() => null);
    if (ytNextRes && ytNextRes.ok) ytNextData = await ytNextRes.json().catch(() => null);
    if (ytMusicRes && ytMusicRes.ok) ytMusicNextData = await ytMusicRes.json().catch(() => null);
  } catch (err) {
    console.warn('[getRelatedTracks] InnerTube error:', err.message);
  }

  const videoDetails = seedMeta?.videoDetails || {};
  const microformat = seedMeta?.microformat?.playerMicroformatRenderer || {};
  const seedTitle = videoDetails.title || '';
  const seedAuthor = videoDetails.author || '';
  const seedCategory = microformat.category || '';
  const seedKeywords = videoDetails.keywords || [];
  const seedDescription = videoDetails.shortDescription || '';
  const seedDuration = Number(videoDetails.lengthSeconds) || 0;

  const superTitle = ytNextData?.contents?.twoColumnWatchNextResults?.results?.results?.contents?.[0]?.videoPrimaryInfoRenderer?.superTitleLink;
  const seedHashtags = superTitle?.runs?.map(r => r.text?.trim()).filter(t => t && t.startsWith('#')).map(t => t.replace(/^#/, '')) || [];

  const chipCloud = ytMusicNextData?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.subHeaderChipCloud;
  const rawChips = chipCloud?.chipCloudRenderer?.chips?.map(c => c.chipCloudChipRenderer?.text?.runs?.[0]?.text).filter(Boolean) || [];

  const detection = detectMusicGenreAndTopic({
    title: seedTitle,
    author: seedAuthor,
    category: seedCategory,
    keywords: seedKeywords,
    description: seedDescription,
    chips: rawChips,
    hashtags: seedHashtags,
    hasMusicQueue: Boolean(ytMusicNextData?.contents)
  });

  const seedContext = {
    title: seedTitle,
    author: seedAuthor,
    duration: seedDuration,
    isMusic: detection.isMusic,
    genre: detection.genre,
    tags: [...seedKeywords, ...seedHashtags]
  };

  const seedArtists = extractArtistNames(seedTitle, seedAuthor);
  const seenIds = new Set([videoId]);
  const seenTitleKeys = new Set([getNormalizedTitleKey(seedTitle)]);
  const rawCandidates = [];

  const addCandidate = (item) => {
    if (!item || !item.id || item.id.length !== 11 || seenIds.has(item.id)) return;
    const titleKey = getNormalizedTitleKey(item.title);
    if (seenTitleKeys.has(titleKey)) return;
    if (isRelevantToSeed(item, seedContext)) {
      seenIds.add(item.id);
      seenTitleKeys.add(titleKey);
      rawCandidates.push(item);
    }
  };

  // 1. Extract genuine YouTube related videos from sidebar (filtered by genre & duration relevance)
  const secResults = ytNextData?.contents?.twoColumnWatchNextResults?.secondaryResults?.secondaryResults?.results || [];
  for (const r of secResults) {
    const l = r.lockupViewModel;
    if (l && l.contentId) {
      const id = normalizeYouTubeId(l.contentId);
      const title = (l.metadata?.lockupMetadataViewModel?.title?.content || '').replace(/^Mix\s*-\s*/i, '').replace(/\s*-\s*YouTube$/i, '');
      const channel = (l.metadata?.lockupMetadataViewModel?.metadata?.contentMetadataViewModel?.metadataRows?.[0]?.metadataParts?.[0]?.text?.content || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ');
      const thumbs = l.contentImage?.thumbnailViewModel?.image?.sources 
        || l.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.image?.sources || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const durationText = l.contentImage?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text
        || l.contentImage?.collectionThumbnailViewModel?.primaryThumbnail?.thumbnailViewModel?.overlays?.[0]?.thumbnailBottomOverlayViewModel?.badges?.[0]?.thumbnailBadgeViewModel?.text || '';
      
      let durationSec = 0;
      if (durationText) {
        const parts = durationText.split(':').map(Number);
        if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }

      addCandidate({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title,
        channel,
        duration: durationSec,
        thumbnail
      });
    }

    const cvr = r.compactVideoRenderer;
    if (cvr && cvr.videoId) {
      const id = normalizeYouTubeId(cvr.videoId);
      const title = (cvr.title?.simpleText || cvr.title?.runs?.map(x => x.text).join('') || '').replace(/^Mix\s*-\s*/i, '').replace(/\s*-\s*YouTube$/i, '');
      const channel = (cvr.shortBylineText?.runs?.[0]?.text || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ');
      const thumbs = cvr.thumbnail?.thumbnails || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
      const durationText = cvr.lengthText?.simpleText || '';
      let durationSec = 0;
      if (durationText) {
        const parts = durationText.split(':').map(Number);
        if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      addCandidate({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title,
        channel,
        duration: durationSec,
        thumbnail
      });
    }
  }

  // 2. If it's music, also add items from YouTube Music playlist panel
  if (detection.isMusic) {
    const panel = ytMusicNextData?.contents?.singleColumnMusicWatchNextResultsRenderer?.tabbedRenderer?.watchNextTabbedResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.musicQueueRenderer?.content?.playlistPanelRenderer;
    const rawContents = panel?.contents || [];
    for (const item of rawContents) {
      const v = item.playlistPanelVideoRenderer;
      if (!v || !v.videoId) continue;
      const id = normalizeYouTubeId(v.videoId);
      const title = (v.title?.runs?.map(r => r.text).join('') || 'Untitled').replace(/^Mix\s*-\s*/i, '').replace(/\s*-\s*YouTube$/i, '');
      const artist = (v.shortBylineText?.runs?.map(r => r.text).join('') || v.longBylineText?.runs?.[0]?.text || 'Nghệ sĩ').replace(/^YouTube$/i, 'Nghệ sĩ');
      const durationText = v.lengthText?.runs?.[0]?.text || '';
      let durationSec = 0;
      if (durationText) {
        const parts = durationText.split(':').map(Number);
        if (parts.length === 2) durationSec = parts[0] * 60 + parts[1];
        else if (parts.length === 3) durationSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      const thumbs = v.thumbnail?.thumbnails || [];
      const thumbnail = thumbs[thumbs.length - 1]?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      addCandidate({
        id,
        url: `https://www.youtube.com/watch?v=${id}`,
        title,
        channel: artist,
        duration: durationSec,
        thumbnail
      });
    }
  }

  // 3. Targeted Tag & Channel Queries (Method 3: Ensure 100% genre & creator accuracy)
  const cleanAuthor = (seedAuthor || '').replace(/official|channel|vevo|records|entertainment|production|media|tv/gi, '').trim();
  const topTag = (seedKeywords || []).find(k => k && k.length > 2 && !cleanAuthor.toLowerCase().includes(k.toLowerCase())) || detection.genre;

  const targetedQueries = [];
  if (cleanAuthor) {
    targetedQueries.push(cleanAuthor);
  }
  if (topTag) {
    targetedQueries.push(cleanAuthor ? `${cleanAuthor} ${topTag}` : `${topTag}`);
  }
  if (detection.genre && detection.genre !== topTag && !targetedQueries.includes(detection.genre)) {
    targetedQueries.push(detection.genre);
  }

  for (const q of targetedQueries) {
    if (rawCandidates.length >= limit * 1.5) break;
    try {
      const searchRes = await searchYouTube(q, 15);
      for (const it of (searchRes.items || [])) {
        addCandidate(it);
        if (rawCandidates.length >= limit * 1.5) break;
      }
    } catch (err) {
      console.warn('[getRelatedTracks] Targeted search notice:', err.message);
    }
  }

  // Sequence candidates using pacing algorithm
  const sequencedItems = sequenceSpotifyQueue(rawCandidates, seedArtists, limit);

  return {
    seedVideoId: videoId,
    seedTitle,
    seedAuthor,
    isMusic: detection.isMusic,
    genre: detection.genre,
    topic: detection.topic,
    themeDescription: detection.themeDescription,
    chips: rawChips,
    items: sequencedItems
  };
}

/**
 * Save cookie file
 */
export function saveCookies(cookiesText) {
  const cookiePath = path.join(config.DATA_DIR, 'cookies.txt');
  fs.writeFileSync(cookiePath, cookiesText, 'utf8');
}

/**
 * Update yt-dlp binary
 */
export function updateYtDlp() {
  return new Promise((resolve, reject) => {
    const ytdlpBin = config.getYtDlpPath();
    const child = spawn(ytdlpBin, ['-U']);
    let output = '';

    child.stdout.on('data', chunk => { output += chunk.toString(); });
    child.stderr.on('data', chunk => { output += chunk.toString(); });

    child.on('close', code => {
      if (code === 0) {
        resolve({ success: true, message: output.trim() || 'yt-dlp updated successfully' });
      } else {
        // Fallback: report output
        resolve({ success: false, message: output.trim() || `Exit code ${code}` });
      }
    });

    child.on('error', err => reject(err));
  });
}

