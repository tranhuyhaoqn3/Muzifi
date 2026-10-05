import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import crypto from 'crypto';
import { config } from '../config.js';

let cachedClientId = 'dkevB9EsY4jIoSm8RfddPNUKyn6hurXF';
let lastRefreshTime = 0;
let refreshingPromise = null;

/**
 * Auto-refresh SoundCloud public Client ID from soundcloud.com web bundle scripts
 */
export async function refreshSoundCloudClientId() {
  if (refreshingPromise) return refreshingPromise;

  refreshingPromise = (async () => {
    try {
      const res = await fetch('https://soundcloud.com', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(10000)
      });
      const html = await res.text();
      const scriptUrls = [...html.matchAll(/https:\/\/a-v2\.sndcdn\.com\/assets\/[a-zA-Z0-9-]+\.js/g)].map(m => m[0]);
      
      // Check last 8 scripts
      for (const url of scriptUrls.slice(-8)) {
        try {
          const sRes = await fetch(url, { signal: AbortSignal.timeout(8000) });
          const text = await sRes.text();
          const match = text.match(/client_id[:=]["']([a-zA-Z0-9]{32})["']/);
          if (match && match[1]) {
            cachedClientId = match[1];
            lastRefreshTime = Date.now();
            console.log('[SoundCloud] Successfully refreshed client_id:', cachedClientId);
            return cachedClientId;
          }
        } catch {
          // continue
        }
      }
    } catch (err) {
      console.warn('[SoundCloud] Failed to auto-refresh client_id:', err.message);
    } finally {
      refreshingPromise = null;
    }
    return cachedClientId;
  })();

  return refreshingPromise;
}

/**
 * Get active SoundCloud Client ID
 */
export async function getSoundCloudClientId() {
  // Refresh if older than 12 hours
  if (Date.now() - lastRefreshTime > 12 * 60 * 60 * 1000) {
    refreshSoundCloudClientId().catch(() => {});
  }
  return cachedClientId;
}

/**
 * Wrapper for SoundCloud API requests with auto client_id injection & 401 retry
 */
export async function scFetch(urlStr, options = {}) {
  const clientId = await getSoundCloudClientId();
  const sep = urlStr.includes('?') ? '&' : '?';
  const targetUrl = `${urlStr}${sep}client_id=${clientId}`;

  let res = await fetch(targetUrl, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(15000)
  });

  if (res.status === 401 || res.status === 403) {
    console.warn(`[SoundCloud] Received ${res.status}, refreshing client_id...`);
    const newClientId = await refreshSoundCloudClientId();
    const retryUrl = `${urlStr}${sep}client_id=${newClientId}`;
    res = await fetch(retryUrl, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        ...(options.headers || {})
      },
      signal: AbortSignal.timeout(15000)
    });
  }

  return res;
}

/**
 * Format view/stream count
 */
export function formatViews(views) {
  if (!views) return '';
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}Tr lượt nghe`;
  if (views >= 1000) return `${Math.round(views / 1000)}k lượt nghe`;
  return `${views} lượt nghe`;
}

/**
 * Format relative time
 */
export function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} phút trước`;
    if (diff < 86400) return `${Math.round(diff / 3600)} giờ trước`;
    if (diff < 2592000) return `${Math.round(diff / 86400)} ngày trước`;
    if (diff < 31536000) return `${Math.round(diff / 2592000)} tháng trước`;
    return `${Math.round(diff / 31536000)} năm trước`;
  } catch {
    return '';
  }
}

/**
 * Get high resolution artwork (500x500)
 */
export function getHighResArtwork(track) {
  if (track?.artwork_url) {
    return track.artwork_url.replace('-large.', '-t500x500.');
  }
  if (track?.user?.avatar_url) {
    return track.user.avatar_url.replace('-large.', '-t500x500.');
  }
  return '';
}

/**
 * Normalize raw track to unified Muzifi format
 */
export function formatSoundCloudTrack(track) {
  if (!track || !track.id) return null;
  const channel = track.user?.username || track.user?.full_name || 'SoundCloud Artist';
  const durationSec = Math.round((track.duration || 0) / 1000);

  return {
    id: String(track.id),
    title: track.title || 'SoundCloud Track',
    channel: channel,
    artist: channel,
    duration: durationSec,
    duration_sec: durationSec,
    thumbnail: getHighResArtwork(track),
    thumbnail_url: getHighResArtwork(track),
    views: track.playback_count || track.likes_count || 0,
    viewsText: formatViews(track.playback_count || track.likes_count),
    publishedTime: formatRelativeTime(track.created_at || track.display_date),
    url: track.permalink_url || `https://soundcloud.com/tracks/${track.id}`,
    genre: track.genre || '',
    source: 'soundcloud',
    media_type: 'audio',
    playback_count: track.playback_count || 0,
    likes_count: track.likes_count || 0
  };
}

/**
 * Normalize input ID to pure SoundCloud numeric ID
 */
export function normalizeSoundCloudId(rawId) {
  if (!rawId) return null;
  const str = String(rawId).trim();
  // Strip common prefixes
  const clean = str.replace(/^(sc_|yt_)/, '').split('_')[0];
  // Check if numeric ID
  if (/^\d+$/.test(clean)) return clean;
  // If soundcloud URL was passed
  const urlMatch = str.match(/soundcloud\.com\/[^/]+\/([^/?]+)/);
  if (urlMatch) return str;
  return clean;
}

/**
 * Search SoundCloud Tracks
 */
export async function searchSoundCloud(query, limit = 20, page = 1) {
  const offset = Math.max(0, (page - 1) * limit);
  const res = await scFetch(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(query)}&limit=${limit}&offset=${offset}`);
  if (!res.ok) {
    throw new Error(`SoundCloud search error: ${res.statusText}`);
  }
  const data = await res.json();
  const rawList = data.collection || [];
  const items = rawList.map(formatSoundCloudTrack).filter(Boolean);

  return {
    items,
    page,
    limit,
    total: data.total_results || (items.length >= limit ? page * limit + 1 : page * limit)
  };
}

/**
 * Topic mapping for curated Vietnamese & International music feed
 */
const TOPIC_QUERIES = {
  '': 'nhac tre hot vpop remix 2026',
  'all': 'nhac tre hot vpop remix 2026',
  'vpop': 'vpop nhac tre hay nhat',
  'sontung': 'Son Tung M-TP',
  'denvau': 'Den Vau',
  'vu': 'Vu chill ballad',
  'rapviet': 'Rap Viet',
  'remix': 'nhac tre remix tiktok hot',
  'lofi': 'lofi chill viet',
  'acoustic': 'acoustic viet nam',
  'usuk': 'us uk top hits',
  'edm': 'edm festival dance'
};

/**
 * Get SoundCloud Trending / Recommended Feed
 */
export async function getSoundCloudFeed(topic = '', page = 1, limit = 20) {
  const query = TOPIC_QUERIES[topic] || (topic ? topic : TOPIC_QUERIES['all']);
  return searchSoundCloud(query, limit, page);
}

/**
 * Get SoundCloud Search Suggestions / Autocomplete
 */
export async function getSoundCloudSuggestions(query) {
  if (!query || !query.trim()) return { suggestions: [] };
  try {
    const res = await scFetch(`https://api-v2.soundcloud.com/search/queries?q=${encodeURIComponent(query.trim())}&limit=10`);
    if (!res.ok) return { suggestions: [] };
    const data = await res.json();
    const suggestions = (data.collection || []).map(item => item.query || item).filter(Boolean);
    return { suggestions };
  } catch {
    return { suggestions: [] };
  }
}

/**
 * Get Related Tracks for Autoplay & Continuous Radio Playback
 */
export async function getSoundCloudRelated(rawId, limit = 20) {
  const trackId = normalizeSoundCloudId(rawId);
  if (!trackId) return { items: [] };

  try {
    // If it's a numeric ID, call the related endpoint
    if (/^\d+$/.test(trackId)) {
      const res = await scFetch(`https://api-v2.soundcloud.com/tracks/${trackId}/related?limit=${limit}`);
      if (res.ok) {
        const data = await res.json();
        const items = (data.collection || []).map(formatSoundCloudTrack).filter(Boolean);
        if (items.length > 0) {
          return { items, genre: 'SoundCloud Radio' };
        }
      }
    }

    // Fallback: search for related music
    const searchRes = await searchSoundCloud('nhac tre remix hot', limit, 1);
    return { items: searchRes.items, genre: 'SoundCloud Radio' };
  } catch (err) {
    console.warn(`[SoundCloud] Failed to get related for ${trackId}:`, err.message);
    return { items: [] };
  }
}

/**
 * Resolve Direct Stream URL for a SoundCloud Track
 */
export async function getSoundCloudStreamUrl(rawId) {
  const trackId = normalizeSoundCloudId(rawId);
  if (!trackId) throw new Error('SoundCloud Track ID required');

  let trackData = null;

  if (/^\d+$/.test(trackId)) {
    const res = await scFetch(`https://api-v2.soundcloud.com/tracks/${trackId}`);
    if (!res.ok) {
      throw new Error(`SoundCloud track not found (HTTP ${res.status})`);
    }
    trackData = await res.json();
  } else {
    // Attempt to resolve URL
    const res = await scFetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(rawId)}`);
    if (!res.ok) {
      throw new Error(`Could not resolve SoundCloud URL`);
    }
    trackData = await res.json();
  }

  const transcodings = trackData.media?.transcodings || [];
  if (transcodings.length === 0) {
    throw new Error('No audio transcodings found for this SoundCloud track');
  }

  // Find progressive MP3 stream (ideal for seeking, downloading & caching)
  const progressive = transcodings.find(t => t.format?.protocol === 'progressive') 
    || transcodings.find(t => t.format?.mime_type === 'audio/mpeg') 
    || transcodings[0];

  const streamInfoRes = await scFetch(progressive.url);
  if (!streamInfoRes.ok) {
    throw new Error(`Failed to resolve SoundCloud stream transcoding: ${streamInfoRes.status}`);
  }

  const streamInfo = await streamInfoRes.json();
  if (!streamInfo?.url) {
    throw new Error('SoundCloud stream URL could not be resolved');
  }

  return {
    streamUrl: streamInfo.url,
    mime: 'audio/mpeg',
    format: progressive.format?.protocol || 'progressive',
    track: formatSoundCloudTrack(trackData)
  };
}

/**
 * Resolve any SoundCloud URL (Track or Playlist)
 */
export async function resolveSoundCloud(url) {
  const res = await scFetch(`https://api-v2.soundcloud.com/resolve?url=${encodeURIComponent(url)}`);
  if (!res.ok) {
    throw new Error(`Could not resolve SoundCloud URL (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (data.kind === 'track') {
    return {
      kind: 'track',
      track: formatSoundCloudTrack(data)
    };
  }
  if (data.kind === 'playlist') {
    const rawTracks = data.tracks || [];
    const items = rawTracks.map(formatSoundCloudTrack).filter(Boolean);
    return {
      kind: 'playlist',
      id: data.id,
      title: data.title,
      description: data.description || '',
      itemCount: items.length,
      thumbnail: getHighResArtwork(data),
      items
    };
  }
  return data;
}

/**
 * Download SoundCloud track directly to local disk
 */
export async function downloadSoundCloudTrackDirect({ streamUrl, outputPath, onProgress, abortSignal }) {
  const client = streamUrl.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(outputPath);
    let downloadedBytes = 0;
    let totalBytes = 0;
    let startTime = Date.now();

    const req = client.get(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    }, (res) => {
      if (res.statusCode !== 200 && res.statusCode !== 206) {
        fileStream.close();
        fs.unlink(outputPath, () => {});
        return reject(new Error(`Download failed with HTTP ${res.statusCode}`));
      }

      totalBytes = parseInt(res.headers['content-length'] || '0', 10);

      res.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes > 0) {
          const percent = Math.min(99, Math.round((downloadedBytes / totalBytes) * 100));
          const elapsedSec = (Date.now() - startTime) / 1000;
          const speedBps = elapsedSec > 0 ? downloadedBytes / elapsedSec : 0;
          const speedMb = (speedBps / (1024 * 1024)).toFixed(1);
          const remainingBytes = Math.max(0, totalBytes - downloadedBytes);
          const etaSec = speedBps > 0 ? Math.round(remainingBytes / speedBps) : 0;

          onProgress({
            progress: percent,
            speed: `${speedMb} MB/s`,
            eta: `${etaSec}s`
          });
        }
      });

      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve({ size: downloadedBytes });
      });
    });

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        req.destroy();
        fileStream.close();
        fs.unlink(outputPath, () => {});
        reject(new Error('Download canceled by user'));
      });
    }

    req.on('error', (err) => {
      fileStream.close();
      fs.unlink(outputPath, () => {});
      reject(err);
    });
  });
}
