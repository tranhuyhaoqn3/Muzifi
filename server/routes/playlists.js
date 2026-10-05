import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { db } from '../db.js';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const upload = multer({
  dest: config.TMP_DIR,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

function serveDefaultPlaylistSvg(res) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <linearGradient id="plGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#4f8fff" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.35"/>
      </linearGradient>
    </defs>
    <rect width="120" height="120" rx="16" fill="url(#plGrad)"/>
    <g fill="none" stroke="#4f8fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" transform="translate(24, 24)">
      <line x1="24" y1="18" x2="63" y2="18"/>
      <line x1="24" y1="36" x2="63" y2="36"/>
      <line x1="24" y1="54" x2="63" y2="54"/>
      <line x1="9" y1="18" x2="9.01" y2="18"/>
      <line x1="9" y1="36" x2="9.01" y2="36"/>
      <line x1="9" y1="54" x2="9.01" y2="54"/>
    </g>
  </svg>`;
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(svg);
}

// 1. Get all playlists with track count (isolated per user)
router.get('/', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const playlists = db.prepare(`
    SELECT p.*, COUNT(pt.track_id) as track_count
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
    WHERE p.user_id = ?
    GROUP BY p.id
    ORDER BY p.updated_at DESC
  `).all(userId);

  res.json(playlists);
});

// 2. Create playlist
router.post('/', requireAuth, (req, res) => {
  const { name, avatar = '', cover_path = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Playlist name is required' });
  }

  const userId = req.user?.id || 'default';
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO playlists (id, user_id, name, avatar, cover_path, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, name.trim(), avatar.trim(), cover_path.trim(), now, now);

  const created = db.prepare('SELECT * FROM playlists WHERE id = ?').get(id);
  created.track_count = 0;
  res.json(created);
});

// 3. Get single playlist with tracks
router.get('/:id', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, userId);

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const tracks = db.prepare(`
    SELECT t.*, pt.position
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
  `).all(playlist.id);

  res.json({ ...playlist, tracks });
});

// 4. Get playlist avatar / thumbnail cover
router.get('/:id/thumb', (req, res) => {
  const playlist = db.prepare('SELECT id, cover_path, avatar FROM playlists WHERE id = ?').get(req.params.id);
  if (!playlist) {
    return serveDefaultPlaylistSvg(res);
  }

  // A. Explicit local cover file
  if (playlist.cover_path) {
    if (playlist.cover_path.startsWith('http://') || playlist.cover_path.startsWith('https://')) {
      return res.redirect(playlist.cover_path);
    }
    const localPath = path.resolve(config.THUMBS_DIR, playlist.cover_path);
    if (fs.existsSync(localPath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(localPath);
    }
  }

  // B. Explicit avatar string
  if (playlist.avatar) {
    if (playlist.avatar.startsWith('http://') || playlist.avatar.startsWith('https://')) {
      return res.redirect(playlist.avatar);
    }
    const localPath = path.resolve(config.THUMBS_DIR, playlist.avatar);
    if (fs.existsSync(localPath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(localPath);
    }
  }

  // C. Fallback: check first track in playlist that has a thumbnail
  const firstTrack = db.prepare(`
    SELECT t.thumbnail_path, t.id
    FROM playlist_tracks pt
    JOIN tracks t ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position ASC
    LIMIT 1
  `).get(playlist.id);

  if (firstTrack && firstTrack.thumbnail_path) {
    const trackThumbPath = path.resolve(config.THUMBS_DIR, firstTrack.thumbnail_path);
    if (fs.existsSync(trackThumbPath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.sendFile(trackThumbPath);
    }
  }

  // D. Fallback default SVG
  return serveDefaultPlaylistSvg(res);
});

// 5. Upload custom playlist avatar image file
router.post('/:id/avatar', requireAuth, upload.single('avatar'), (req, res) => {
  const userId = req.user?.id || 'default';
  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!playlist) {
    if (req.file) try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  }
  if (!req.file) return res.status(400).json({ error: 'Chưa có file ảnh được tải lên' });

  const ext = path.extname(req.file.originalname).toLowerCase() || '.jpg';
  const filename = `playlist_cover_${playlist.id}_${Date.now()}${ext}`;
  const targetPath = path.join(config.THUMBS_DIR, filename);

  fs.renameSync(req.file.path, targetPath);

  // Clean old file if it was a custom upload
  if (playlist.cover_path && playlist.cover_path.startsWith('playlist_cover_')) {
    try {
      const oldPath = path.join(config.THUMBS_DIR, playlist.cover_path);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    } catch {}
  }

  db.prepare(`
    UPDATE playlists 
    SET cover_path = ?, avatar = ?, updated_at = datetime('now') 
    WHERE id = ?
  `).run(filename, `/api/playlists/${playlist.id}/thumb?t=${Date.now()}`, playlist.id);

  const updated = db.prepare('SELECT * FROM playlists WHERE id = ?').get(playlist.id);
  res.json({ success: true, playlist: updated, cover_path: filename, avatar: updated.avatar });
});

// 6. Update playlist name and/or avatar URL
router.patch('/:id', requireAuth, (req, res) => {
  const { name, avatar, cover_path } = req.body || {};
  const userId = req.user?.id || 'default';

  const playlist = db.prepare('SELECT * FROM playlists WHERE id = ? AND user_id = ?').get(req.params.id, userId);
  if (!playlist) return res.status(404).json({ error: 'Playlist not found or unauthorized' });

  const newName = (name !== undefined && name !== null) ? name.trim() : playlist.name;
  if (!newName) {
    return res.status(400).json({ error: 'Tên playlist không được để trống' });
  }

  let newAvatar = playlist.avatar || '';
  let newCoverPath = playlist.cover_path || '';

  if (avatar !== undefined) {
    newAvatar = String(avatar).trim();
    if (newAvatar.startsWith('http://') || newAvatar.startsWith('https://')) {
      newCoverPath = newAvatar;
    } else if (newAvatar === '') {
      newCoverPath = '';
    }
  }

  if (cover_path !== undefined) {
    newCoverPath = String(cover_path).trim();
    if (newCoverPath === '') newAvatar = '';
  }

  db.prepare(`
    UPDATE playlists 
    SET name = ?, avatar = ?, cover_path = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).run(newName, newAvatar, newCoverPath, req.params.id, userId);

  const updated = db.prepare('SELECT * FROM playlists WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// 5. Delete playlist
router.delete('/:id', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const result = db.prepare(`
    DELETE FROM playlists 
    WHERE id = ? AND user_id = ?
  `).run(req.params.id, userId);

  if (result.changes === 0) return res.status(404).json({ error: 'Playlist not found or unauthorized' });
  res.json({ success: true, id: req.params.id });
});

// 6. Add tracks to playlist
router.post('/:id/tracks', requireAuth, (req, res) => {
  const { trackIds } = req.body || {};
  if (!Array.isArray(trackIds) || trackIds.length === 0) {
    return res.status(400).json({ error: 'trackIds array required' });
  }

  const userId = req.user?.id || 'default';
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, userId);

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const maxPosRow = db.prepare(`
    SELECT MAX(position) as max_pos FROM playlist_tracks WHERE playlist_id = ?
  `).get(playlist.id);
  let nextPos = (maxPosRow && maxPosRow.max_pos !== null) ? maxPosRow.max_pos + 1 : 0;

  const insertTrack = db.prepare(`
    INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position)
    VALUES (?, ?, ?)
  `);

  for (const trackId of trackIds) {
    insertTrack.run(playlist.id, trackId, nextPos++);
  }

  db.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`).run(playlist.id);

  res.json({ success: true, added: trackIds.length });
});

// 7. Remove track from playlist
router.delete('/:id/tracks/:trackId', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, userId);

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  db.prepare(`
    DELETE FROM playlist_tracks 
    WHERE playlist_id = ? AND track_id = ?
  `).run(req.params.id, req.params.trackId);

  db.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
  res.json({ success: true });
});

// 8. Reorder playlist tracks (supports drag and drop)
router.put('/:id/reorder', requireAuth, (req, res) => {
  const { trackIds } = req.body || {};
  if (!Array.isArray(trackIds)) {
    return res.status(400).json({ error: 'trackIds array required' });
  }

  const userId = req.user?.id || 'default';
  const playlist = db.prepare(`
    SELECT * FROM playlists 
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, userId);

  if (!playlist) return res.status(404).json({ error: 'Playlist not found' });

  const playlistId = req.params.id;

  const updatePos = db.prepare(`
    UPDATE playlist_tracks 
    SET position = ? 
    WHERE playlist_id = ? AND track_id = ?
  `);

  const runReorder = db.transaction(() => {
    trackIds.forEach((trackId, index) => {
      updatePos.run(index, playlistId, trackId);
    });
  });

  runReorder();
  db.prepare(`UPDATE playlists SET updated_at = datetime('now') WHERE id = ?`).run(playlistId);

  res.json({ success: true });
});

export default router;
