import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import { config } from '../config.js';
import { getStreamUrl, normalizeYouTubeId } from './ytdlp.js';

// Maximum cache storage size: 1.5 GB (~350 full audio tracks)
const MAX_CACHE_SIZE_BYTES = 1.5 * 1024 * 1024 * 1024;

// Set of currently active downloads: `${videoId}_${mediaType}`
const activeDownloads = new Set();

/**
 * Get cache file path for a video ID and media type
 */
export function getCachePath(rawVideoId, mediaType = 'audio') {
  const v = normalizeYouTubeId(rawVideoId);
  const ext = mediaType === 'video' ? 'mp4' : 'm4a';
  const fileName = `${v}_${mediaType}.${ext}`;
  const filePath = path.join(config.CACHE_DIR, fileName);
  const mime = mediaType === 'video' ? 'video/mp4' : 'audio/mp4';
  return { filePath, fileName, mime, ext, videoId: v };
}

/**
 * Check if a stream is completely cached on disk
 */
export function isStreamCached(rawVideoId, mediaType = 'audio') {
  const { filePath } = getCachePath(rawVideoId, mediaType);
  if (!fs.existsSync(filePath)) return false;
  try {
    const stats = fs.statSync(filePath);
    // Audio files are typically > 1MB, video > 5MB. Require at least 200KB to ensure not an empty/corrupted file
    return stats.size > 200 * 1024;
  } catch {
    return false;
  }
}

/**
 * Update access time of cache file for LRU eviction
 */
export function touchCache(rawVideoId, mediaType = 'audio') {
  const { filePath } = getCachePath(rawVideoId, mediaType);
  if (fs.existsSync(filePath)) {
    try {
      const now = new Date();
      fs.utimesSync(filePath, now, now);
    } catch {}
  }
}

/**
 * Background cache downloader for a stream URL
 */
export async function cacheStreamInBackground(rawVideoId, mediaType = 'audio', streamUrl = null) {
  const v = normalizeYouTubeId(rawVideoId);
  if (!v) return null;

  const key = `${v}_${mediaType}`;
  if (isStreamCached(v, mediaType)) {
    touchCache(v, mediaType);
    return getCachePath(v, mediaType);
  }

  if (activeDownloads.has(key)) {
    return null; // Already being downloaded
  }

  activeDownloads.add(key);

  try {
    let urlToDownload = streamUrl;
    if (!urlToDownload) {
      const resolved = await getStreamUrl(v, mediaType);
      urlToDownload = resolved.streamUrl;
    }

    if (!urlToDownload) {
      activeDownloads.delete(key);
      return null;
    }

    const { filePath } = getCachePath(v, mediaType);
    const tmpPath = `${filePath}.downloading`;

    const client = urlToDownload.startsWith('https') ? https : http;

    await new Promise((resolve, reject) => {
      const fileStream = fs.createWriteStream(tmpPath);

      const req = client.get(urlToDownload, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': '*/*'
        }
      }, (res) => {
        if (res.statusCode !== 200 && res.statusCode !== 206) {
          fileStream.close();
          fs.unlink(tmpPath, () => {});
          return reject(new Error(`Cache download HTTP ${res.statusCode}`));
        }

        res.pipe(fileStream);

        fileStream.on('finish', () => {
          fileStream.close();
          try {
            const stats = fs.statSync(tmpPath);
            if (stats.size > 100 * 1024) {
              fs.renameSync(tmpPath, filePath);
              resolve();
            } else {
              fs.unlink(tmpPath, () => {});
              reject(new Error('Downloaded file too small'));
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', (err) => {
        fileStream.close();
        fs.unlink(tmpPath, () => {});
        reject(err);
      });

      req.setTimeout(60000, () => {
        req.destroy();
        fileStream.close();
        fs.unlink(tmpPath, () => {});
        reject(new Error('Cache download timeout'));
      });
    });

    // Cleanup oldest files if cache exceeds limit
    enforceCacheSizeLimit();
    return getCachePath(v, mediaType);
  } catch (err) {
    console.warn(`[StreamCache] Background cache failed for ${v}:`, err.message);
    return null;
  } finally {
    activeDownloads.delete(key);
  }
}

/**
 * Preload track: resolves Google Video stream and downloads in background
 */
export async function preloadTrack(rawVideoId, mediaType = 'audio') {
  const v = normalizeYouTubeId(rawVideoId);
  if (!v) return { success: false, message: 'Invalid ID' };

  if (isStreamCached(v, mediaType)) {
    touchCache(v, mediaType);
    return { success: true, cached: true, videoId: v };
  }

  // Pre-resolve stream URL so yt-dlp delay is eliminated
  const resolved = await getStreamUrl(v, mediaType);
  // Start caching audio in background
  cacheStreamInBackground(v, mediaType, resolved.streamUrl);

  return { success: true, cached: false, preloading: true, videoId: v };
}

/**
 * Enforce max cache size using LRU (deletes least recently accessed files first)
 */
function enforceCacheSizeLimit() {
  try {
    const files = fs.readdirSync(config.CACHE_DIR)
      .filter(f => !f.endsWith('.downloading'))
      .map(f => {
        const fullPath = path.join(config.CACHE_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          path: fullPath,
          size: stats.size,
          atimeMs: stats.atimeMs || stats.mtimeMs
        };
      });

    let totalSize = files.reduce((sum, f) => sum + f.size, 0);

    if (totalSize > MAX_CACHE_SIZE_BYTES) {
      // Sort oldest accessed first
      files.sort((a, b) => a.atimeMs - b.atimeMs);

      for (const file of files) {
        if (totalSize <= MAX_CACHE_SIZE_BYTES * 0.8) break; // keep at 80% threshold
        try {
          fs.unlinkSync(file.path);
          totalSize -= file.size;
        } catch {}
      }
    }
  } catch (e) {
    console.warn('[StreamCache] Error enforcing cache size limit:', e.message);
  }
}
