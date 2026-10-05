import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { db, getSetting } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { probeMedia, generateVideoThumbnail } from '../services/ffmpeg.js';
import { extractMetadata } from '../services/metadata.js';
import { queue } from '../services/queue.js';
import { getLyrics } from '../services/lyrics.js';

const router = express.Router();

const upload = multer({
  dest: config.TMP_DIR,
  limits: { fileSize: config.MAX_UPLOAD_SIZE }
});

const DEFAULT_AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.wav', '.flac', '.ogg', '.opus', '.wma']);
const DEFAULT_VIDEO_EXTS = new Set(['.mp4', '.m4v', '.mov', '.mkv', '.webm', '.avi']);

const IOS_NATIVE_AUDIO = new Set(['audio/mp4', 'audio/mpeg', 'audio/x-m4a', 'audio/aac']);
const IOS_NATIVE_VIDEO = new Set(['video/mp4', 'video/quicktime']);

function getMimeType(filePath, isVideo) {
  const ext = path.extname(filePath).toLowerCase();
  if (isVideo) {
    if (ext === '.mp4') return 'video/mp4';
    if (ext === '.mov') return 'video/quicktime';
    if (ext === '.m4v') return 'video/x-m4v';
    if (ext === '.webm') return 'video/webm';
    if (ext === '.mkv') return 'video/x-matroska';
    return 'video/mp4';
  } else {
    if (ext === '.mp3') return 'audio/mpeg';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.flac') return 'audio/flac';
    if (ext === '.ogg') return 'audio/ogg';
    return 'audio/mp4';
  }
}

// 1. Get tracks list with filtering, search, sorting
router.get('/', requireAuth, (req, res) => {
  const { type, q, sort = 'created_desc', page = 1, limit = 500 } = req.query;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  let whereClauses = [];
  let params = [];

  const userId = req.user?.id || 'default';
  whereClauses.push('user_id = ?');
  params.push(userId);

  if (type === 'audio' || type === 'video') {
    whereClauses.push('media_type = ?');
    params.push(type);
  }

  if (q && q.trim()) {
    const searchTerm = `%${q.trim()}%`;
    whereClauses.push('(title LIKE ? OR artist LIKE ? OR album LIKE ?)');
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const whereStr = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let orderStr = 'created_at DESC';
  if (sort === 'title_asc') orderStr = 'title COLLATE NOCASE ASC';
  else if (sort === 'artist_asc') orderStr = 'artist COLLATE NOCASE ASC';
  else if (sort === 'duration_desc') orderStr = 'duration_sec DESC';
  else if (sort === 'duration_asc') orderStr = 'duration_sec ASC';

  const countRow = db.prepare(`SELECT COUNT(*) as total FROM tracks ${whereStr}`).get(...params);
  const total = countRow ? countRow.total : 0;

  const allTracks = db.prepare(`
    SELECT * FROM tracks 
    ${whereStr} 
    ORDER BY ${orderStr} 
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit, 10), offset);

  const tracks = allTracks.filter(track => {
    if (!track.file_path) return false;
    const fullPath = path.join(config.MEDIA_DIR, track.file_path);
    const exists = fs.existsSync(fullPath);
    if (!exists) {
      try {
        db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id);
      } catch {}
    }
    return exists;
  });

  res.json({ tracks, total: tracks.length, page: parseInt(page, 10), limit: parseInt(limit, 10) });
});

// 2. Upload tracks
router.post('/upload', requireAuth, upload.array('files'), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const policy = getSetting('unknown_format_policy', 'convert');
  const results = [];
  const errors = [];

  for (const file of req.files) {
    const originalExt = path.extname(file.originalname).toLowerCase();
    const originalName = file.originalname;
    const tempPath = file.path;

    try {
      // 1. Probe media file using ffprobe
      const probe = await probeMedia(tempPath);
      const isVideo = probe.isVideo;
      const mediaType = isVideo ? 'video' : 'audio';

      // 2. Extract metadata & embedded artwork
      const meta = await extractMetadata(tempPath, originalName);

      // Check if format needs transcoding for smooth iOS playback
      const mime = getMimeType(originalName, isVideo);
      let needsConversion = false;

      if (!isVideo) {
        // iOS requires mp3, aac, or m4a
        if (!['.mp3', '.m4a', '.aac'].includes(originalExt)) {
          needsConversion = true;
        }
      } else {
        // Video: check if container is not mp4/mov or codec is not h264
        if (!['.mp4', '.mov', '.m4v'].includes(originalExt) || (probe.videoCodec && probe.videoCodec !== 'h264')) {
          needsConversion = true;
        }
      }

      if (needsConversion && policy === 'reject') {
        fs.unlinkSync(tempPath);
        errors.push({ filename: originalName, error: `Format ${originalExt} is not supported on iOS and conversion is disabled.` });
        continue;
      }

      const trackId = crypto.randomUUID();
      const targetFilename = `${trackId}${originalExt}`;
      const targetFilePath = path.join(config.MEDIA_DIR, targetFilename);

      // Move from tmp to media directory
      fs.renameSync(tempPath, targetFilePath);

      let thumbFilename = meta.thumbnailFile;
      if (isVideo && !thumbFilename) {
        const vThumbName = `thumb_${trackId}.jpg`;
        const vThumbPath = path.join(config.THUMBS_DIR, vThumbName);
        try {
          await generateVideoThumbnail(targetFilePath, vThumbPath, probe.durationSec || 10);
          thumbFilename = vThumbName;
        } catch (e) {
          console.warn('Video thumbnail generation notice:', e.message);
        }
      }

      const stats = fs.statSync(targetFilePath);
      const userId = req.user?.id || 'default';

      // Insert track row
      db.prepare(`
        INSERT INTO tracks (
          id, user_id, title, artist, album, duration_sec, media_type, mime, file_path, file_size,
          thumbnail_path, width, height, source, source_url, original_ext, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'upload', NULL, ?, datetime('now'))
      `).run(
        trackId,
        userId,
        meta.title,
        meta.artist,
        meta.album,
        probe.durationSec || meta.durationSec || 0,
        mediaType,
        mime,
        targetFilename,
        stats.size,
        thumbFilename,
        probe.width || null,
        probe.height || null,
        originalExt
      );

      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);

      // Asynchronously fetch and persist lyrics for uploaded track
      getLyrics({
        trackId: track.id,
        title: track.title,
        artist: track.artist,
        duration: track.duration_sec
      }).catch(err => console.warn('Uploaded track lyrics notice:', err.message));

      // If needs conversion, trigger background conversion job
      if (needsConversion) {
        queue.createJob({
          kind: 'convert',
          trackId: track.id,
          mediaType: track.media_type,
        });
      }

      results.push(track);
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch (e) {}
      }
      errors.push({ filename: originalName, error: err.message });
    }
  }

  res.json({ tracks: results, errors });
});

// 3. Stream track with HTTP 206 Partial Content (ESSENTIAL FOR IOS SEEKING & BACKGROUND)
router.get('/:id/stream', requireAuth, (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) {
    return res.status(404).send('Track not found');
  }

  const resolvedMediaDir = path.resolve(config.MEDIA_DIR);
  const filePath = path.resolve(config.MEDIA_DIR, track.file_path);
  if (!filePath.startsWith(resolvedMediaDir)) {
    return res.status(403).send('Forbidden');
  }
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Media file missing from storage');
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    // Parse Range header e.g. "bytes=0-1048575"
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      res.status(416).set({
        'Content-Range': `bytes */${fileSize}`
      });
      return res.end();
    }

    const chunksize = (end - start) + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': track.mime,
      'Cache-Control': 'no-cache',
    });

    res.on('close', () => { stream.destroy(); });
    stream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': track.mime,
      'Accept-Ranges': 'bytes',
    });
    const stream = fs.createReadStream(filePath);
    res.on('close', () => { stream.destroy(); });
    stream.on('error', () => { if (!res.headersSent) res.status(500).end(); });
    stream.pipe(res);
  }
});

// 4. Get thumbnail image
router.get('/:id/thumb', (req, res) => {
  const track = db.prepare('SELECT thumbnail_path, media_type FROM tracks WHERE id = ?').get(req.params.id);
  if (track && track.thumbnail_path) {
    const resolvedThumbsDir = path.resolve(config.THUMBS_DIR);
    const thumbPath = path.resolve(config.THUMBS_DIR, track.thumbnail_path);
    if (!thumbPath.startsWith(resolvedThumbsDir)) {
      return res.status(403).send('Forbidden');
    }
    if (fs.existsSync(thumbPath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(thumbPath);
    }
  }

  // Return SVG placeholder if no thumbnail exists
  const isVideo = track?.media_type === 'video';
  const iconSvg = isVideo
    ? `<polygon points="35,25 75,50 35,75" fill="#f43f5e" />`
    : `<path d="M35 70 A15 15 0 0 1 50 55 V25 H75 V40 H60 V70 A15 15 0 1 1 35 70" fill="#6366f1" />`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
    <rect width="100" height="100" rx="16" fill="#1e1e24"/>
    ${iconSvg}
  </svg>`;

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

// 5. Upload custom thumbnail
router.post('/:id/thumb', requireAuth, upload.single('thumbnail'), (req, res) => {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const thumbFilename = `thumb_${track.id}_custom${ext}`;
  const targetPath = path.join(config.THUMBS_DIR, thumbFilename);

  fs.renameSync(req.file.path, targetPath);

  db.prepare('UPDATE tracks SET thumbnail_path = ? WHERE id = ?').run(thumbFilename, track.id);
  res.json({ success: true, thumbnail_path: thumbFilename });
});

// 6. Update track metadata
router.patch('/:id', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const { title, artist, album } = req.body;
  const track = db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found or unauthorized' });

  db.prepare(`
    UPDATE tracks 
    SET title = COALESCE(?, title),
        artist = COALESCE(?, artist),
        album = COALESCE(?, album)
    WHERE id = ? AND user_id = ?
  `).run(title, artist, album, track.id, userId);

  const updated = db.prepare('SELECT * FROM tracks WHERE id = ?').get(track.id);
  res.json(updated);
});

// 7. Delete track
router.delete('/:id', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const track = db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!track) return res.status(404).json({ error: 'Track not found or unauthorized' });

  // Delete media file
  const mediaPath = path.join(config.MEDIA_DIR, track.file_path);
  if (fs.existsSync(mediaPath)) {
    try { fs.unlinkSync(mediaPath); } catch (e) {}
  }

  // Delete thumbnail file
  if (track.thumbnail_path) {
    const thumbPath = path.join(config.THUMBS_DIR, track.thumbnail_path);
    if (fs.existsSync(thumbPath)) {
      try { fs.unlinkSync(thumbPath); } catch (e) {}
    }
  }

  db.prepare('DELETE FROM tracks WHERE id = ? AND user_id = ?').run(track.id, userId);
  res.json({ success: true, id: track.id });
});

// 8. Batch delete tracks
router.post('/batch-delete', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Missing track IDs array' });
  }

  let deletedCount = 0;
  for (const id of ids) {
    const track = db.prepare('SELECT * FROM tracks WHERE id = ? AND user_id = ?').get(id, userId);
    if (track) {
      const mediaPath = path.join(config.MEDIA_DIR, track.file_path);
      if (fs.existsSync(mediaPath)) {
        try { fs.unlinkSync(mediaPath); } catch (e) {}
      }
      if (track.thumbnail_path) {
        const thumbPath = path.join(config.THUMBS_DIR, track.thumbnail_path);
        if (fs.existsSync(thumbPath)) {
          try { fs.unlinkSync(thumbPath); } catch (e) {}
        }
      }
      db.prepare('DELETE FROM tracks WHERE id = ? AND user_id = ?').run(id, userId);
      deletedCount++;
    }
  }

  res.json({ success: true, count: deletedCount });
});

export default router;
