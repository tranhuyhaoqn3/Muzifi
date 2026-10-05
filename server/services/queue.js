import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { db, getSetting } from '../db.js';
import { config } from '../config.js';
import { getSoundCloudStreamUrl, downloadSoundCloudTrackDirect, normalizeSoundCloudId } from './soundcloud.js';
import { probeMedia, convertAudioToM4A, convertVideoToMP4, generateVideoThumbnail } from './ffmpeg.js';
import { extractMetadata } from './metadata.js';
import { getLyrics } from './lyrics.js';

// Active AbortControllers: jobId -> AbortController
const abortControllers = new Map();

// SSE listeners
const sseClients = new Set();

// Send keep-alive heartbeat ping every 25 seconds for mobile devices & reverse proxies (Nginx/Cloudflare)
setInterval(() => {
  if (sseClients.size === 0) return;
  for (const client of sseClients) {
    try {
      client.write(': ping\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000);

export function registerSSEClient(res) {
  sseClients.add(res);
  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastJobUpdate(job) {
  if (sseClients.size === 0) return;
  const payload = `data: ${JSON.stringify(job)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch (err) {
      // Handled on close
    }
  }
}

class JobQueue {
  constructor() {
    this.runningCount = 0;
  }

  getMaxConcurrency() {
    const setting = parseInt(getSetting('max_concurrent_jobs', '2'), 10);
    return Math.max(1, Math.min(setting || 2, 4));
  }

  getJob(id) {
    return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id);
  }

  getAllJobs(limit = 50) {
    return db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  getUserJobs(userId, limit = 50) {
    if (!userId) return this.getAllJobs(limit);
    return db.prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?').all(userId, limit);
  }

  createJob({ kind, url, mediaType = 'audio', quality = '720p', trackId = null, userId = 'default', extra = {} }) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const extraStr = typeof extra === 'object' ? JSON.stringify(extra) : (extra || '{}');

    db.prepare(`
      INSERT INTO jobs (id, user_id, kind, url, media_type, quality, status, progress, speed, eta, error, track_id, extra, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 'queued', 0, '', '', NULL, ?, ?, ?, ?)
    `).run(id, userId, kind, url || '', mediaType, quality, trackId, extraStr, now, now);

    const job = this.getJob(id);
    broadcastJobUpdate(job);
    this.processNext();
    return job;
  }

  cancelJob(id) {
    const job = this.getJob(id);
    if (!job) return { success: false, error: 'Job not found' };

    if (abortControllers.has(id)) {
      abortControllers.get(id).abort();
      abortControllers.delete(id);
    }

    db.prepare(`
      UPDATE jobs 
      SET status = 'canceled', error = 'Canceled by user', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    const updated = this.getJob(id);
    broadcastJobUpdate(updated);
    this.processNext();
    return { success: true, job: updated };
  }

  retryJob(id) {
    const job = this.getJob(id);
    if (!job) return { success: false, error: 'Job not found' };

    db.prepare(`
      UPDATE jobs 
      SET status = 'queued', progress = 0, speed = '', eta = '', error = NULL, updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    const updated = this.getJob(id);
    broadcastJobUpdate(updated);
    this.processNext();
    return { success: true, job: updated };
  }

  updateProgress(id, { progress, speed = '', eta = '', status = 'downloading' }) {
    db.prepare(`
      UPDATE jobs 
      SET status = ?, progress = ?, speed = ?, eta = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(status, progress, speed, eta, id);

    broadcastJobUpdate(this.getJob(id));
  }

  markProcessing(id) {
    db.prepare(`
      UPDATE jobs 
      SET status = 'processing', progress = 99, speed = '', eta = '', updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    broadcastJobUpdate(this.getJob(id));
  }

  markDone(id, trackId = null) {
    db.prepare(`
      UPDATE jobs 
      SET status = 'done', progress = 100, speed = '', eta = '', error = NULL, track_id = COALESCE(?, track_id), updated_at = datetime('now')
      WHERE id = ?
    `).run(trackId, id);

    broadcastJobUpdate(this.getJob(id));
    this.runningCount--;
    this.processNext();
  }

  markError(id, errorMsg) {
    db.prepare(`
      UPDATE jobs 
      SET status = 'error', error = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(errorMsg, id);

    broadcastJobUpdate(this.getJob(id));
    this.runningCount--;
    this.processNext();
  }

  async processNext() {
    if (this.runningCount >= this.getMaxConcurrency()) {
      return;
    }

    const nextJob = db.prepare(`
      SELECT * FROM jobs 
      WHERE status = 'queued' 
      ORDER BY created_at ASC 
      LIMIT 1
    `).get();

    if (!nextJob) return;

    this.runningCount++;
    const abortController = new AbortController();
    abortControllers.set(nextJob.id, abortController);

    try {
      if (nextJob.kind === 'soundcloud' || nextJob.kind === 'online') {
        await this.runSoundCloudJob(nextJob, abortController.signal);
      } else if (nextJob.kind === 'convert') {
        await this.runConvertJob(nextJob, abortController.signal);
      }
    } catch (err) {
      this.markError(nextJob.id, err.message);
    } finally {
      abortControllers.delete(nextJob.id);
    }
  }

  async runSoundCloudJob(job, abortSignal) {
    this.updateProgress(job.id, { progress: 0, status: 'downloading' });

    let extra = {};
    try {
      extra = typeof job.extra === 'string' ? JSON.parse(job.extra || '{}') : (job.extra || {});
    } catch { }

    const rawTarget = extra.onlineId || extra.soundcloudId || job.url;
    const resolved = await getSoundCloudStreamUrl(rawTarget);
    if (!resolved?.streamUrl) {
      throw new Error('Could not resolve stream URL');
    }

    const trackId = crypto.randomUUID();
    const targetFilePath = path.join(config.MEDIA_DIR, `${trackId}.mp3`);

    await downloadSoundCloudTrackDirect({
      streamUrl: resolved.streamUrl,
      outputPath: targetFilePath,
      onProgress: p => {
        this.updateProgress(job.id, {
          progress: p.progress || 0,
          speed: p.speed || '',
          eta: p.eta || '',
          status: 'downloading'
        });
      },
      abortSignal
    });

    this.markProcessing(job.id);

    const probe = await probeMedia(targetFilePath);
    const meta = await extractMetadata(targetFilePath);
    const stats = fs.statSync(targetFilePath);

    // High quality artwork download
    let thumbFilename = meta.thumbnailFile;
    const candidateThumbs = [];
    if (extra.thumbnail) candidateThumbs.push(extra.thumbnail);
    if (extra.thumbnail_url) candidateThumbs.push(extra.thumbnail_url);
    if (resolved.track?.thumbnail) candidateThumbs.push(resolved.track.thumbnail);

    if (!thumbFilename && candidateThumbs.length > 0) {
      for (const tUrl of candidateThumbs) {
        try {
          const tRes = await fetch(tUrl, { signal: AbortSignal.timeout(6000) });
          if (tRes.ok) {
            const buf = Buffer.from(await tRes.arrayBuffer());
            if (buf && buf.length > 500) {
              const tName = `thumb_${trackId}.jpg`;
              fs.writeFileSync(path.join(config.THUMBS_DIR, tName), buf);
              thumbFilename = tName;
              break;
            }
          }
        } catch { }
      }
    }

    const finalTitle = extra.title || resolved.track?.title || meta.title || 'Bài hát';
    const finalArtist = extra.artist || resolved.track?.artist || meta.artist || 'Nghệ sĩ';

    // Insert into tracks table
    db.prepare(`
      INSERT INTO tracks (
        id, user_id, title, artist, album, duration_sec, media_type, mime, file_path, file_size, 
        thumbnail_path, width, height, source, source_url, original_ext, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'online', ?, ?, datetime('now'))
    `).run(
      trackId,
      job.user_id || 'default',
      finalTitle,
      finalArtist,
      resolved.track?.genre || meta.album || 'Nhạc Trực Tuyến',
      probe.durationSec || resolved.track?.duration_sec || meta.durationSec || 0,
      'audio',
      'audio/mpeg',
      path.basename(targetFilePath),
      stats.size,
      thumbFilename,
      null,
      null,
      job.url || (resolved.track?.url || ''),
      '.mp3'
    );

    if (extra && extra.playlistId) {
      try {
        const maxPosRow = db.prepare('SELECT MAX(position) as maxPos FROM playlist_tracks WHERE playlist_id = ?').get(extra.playlistId);
        const nextPos = (maxPosRow && maxPosRow.maxPos != null) ? maxPosRow.maxPos + 1 : 0;
        db.prepare(`
          INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
          VALUES (?, ?, ?)
        `).run(extra.playlistId, trackId, nextPos);
        db.prepare("UPDATE playlists SET updated_at = datetime('now') WHERE id = ?").run(extra.playlistId);
      } catch (plErr) {
        console.warn('[Queue] Failed to add track to playlist:', plErr.message);
      }
    }

    // Auto-fetch and cache lyrics for offline play
    try {
      const lyricsResult = await getLyrics({
        trackId: trackId,
        title: finalTitle,
        artist: finalArtist,
        duration: probe.durationSec || resolved.track?.duration_sec || 0
      });
      if (lyricsResult && (lyricsResult.syncedLyrics || lyricsResult.plainLyrics)) {
        const lrcFile = path.join(config.MEDIA_DIR, `${trackId}.lrc`);
        fs.writeFileSync(lrcFile, lyricsResult.syncedLyrics || lyricsResult.plainLyrics, 'utf8');
      }
    } catch (lErr) {
      console.warn(`[Queue] Auto-lyrics notice for ${trackId}:`, lErr.message);
    }

    this.markDone(job.id, trackId);
  }

  async runConvertJob(job, abortSignal) {
    this.updateProgress(job.id, { progress: 0, status: 'processing' });

    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(job.track_id);
    if (!track) {
      throw new Error(`Track ${job.track_id} not found for conversion`);
    }

    const currentFilePath = path.join(config.MEDIA_DIR, track.file_path);
    if (!fs.existsSync(currentFilePath)) {
      throw new Error(`Original file not found: ${track.file_path}`);
    }

    const isAudio = track.media_type === 'audio';
    const newExt = isAudio ? '.m4a' : '.mp4';
    const newFilename = `${track.id}${newExt}`;
    const newFilePath = path.join(config.MEDIA_DIR, newFilename);

    if (isAudio) {
      await convertAudioToM4A(currentFilePath, newFilePath, p => {
        if (track.duration_sec > 0 && p.currentSec) {
          const pct = Math.min(99, Math.round((p.currentSec / track.duration_sec) * 100));
          this.updateProgress(job.id, { progress: pct, status: 'processing' });
        }
      }, abortSignal);
    } else {
      await convertVideoToMP4(currentFilePath, newFilePath, track.duration_sec || 0, p => {
        this.updateProgress(job.id, { progress: p.percent || 50, status: 'processing' });
      }, abortSignal);
    }

    // Probe converted media
    const probe = await probeMedia(newFilePath);
    const newStats = fs.statSync(newFilePath);
    const newMime = isAudio ? 'audio/mp4' : 'video/mp4';

    // Remove old incompatible file if name changed
    if (newFilename !== track.file_path && fs.existsSync(currentFilePath)) {
      try {
        fs.unlinkSync(currentFilePath);
      } catch (e) {
        console.warn('Could not delete old file', e);
      }
    }

    // Video thumbnail if missing
    let thumbFilename = track.thumbnail_path;
    if (!isAudio && (!thumbFilename || !fs.existsSync(path.join(config.THUMBS_DIR, thumbFilename)))) {
      const vThumbName = `thumb_${track.id}.jpg`;
      const vThumbPath = path.join(config.THUMBS_DIR, vThumbName);
      try {
        await generateVideoThumbnail(newFilePath, vThumbPath, probe.durationSec || 10);
        thumbFilename = vThumbName;
      } catch (err) {
        console.warn('Thumbnail generation failed after transcode', err);
      }
    }

    // Update track
    db.prepare(`
      UPDATE tracks 
      SET file_path = ?, mime = ?, file_size = ?, duration_sec = ?, 
          thumbnail_path = ?, width = ?, height = ?
      WHERE id = ?
    `).run(
      newFilename,
      newMime,
      newStats.size,
      probe.durationSec || track.duration_sec,
      thumbFilename,
      probe.width || null,
      probe.height || null,
      track.id
    );

    this.markDone(job.id, track.id);
  }
}

export const queue = new JobQueue();
