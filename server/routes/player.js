import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  let state = db.prepare('SELECT * FROM user_player_state WHERE user_id = ?').get(userId);

  if (!state) {
    state = db.prepare('SELECT * FROM player_state WHERE id = 1').get();
  }

  if (state && state.queue) {
    try {
      state.queue = JSON.parse(state.queue);
    } catch (e) {
      state.queue = [];
    }
  }
  res.json(state || {});
});

router.put('/', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const { track_id, position_sec = 0, queue = [], loop_mode = 'off', shuffle = 0, rate = 1.0 } = req.body || {};

  const queueJson = typeof queue === 'string' ? queue : JSON.stringify(queue);

  db.prepare(`
    INSERT INTO user_player_state (user_id, track_id, position_sec, queue, loop_mode, shuffle, rate, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      track_id = excluded.track_id,
      position_sec = excluded.position_sec,
      queue = excluded.queue,
      loop_mode = excluded.loop_mode,
      shuffle = excluded.shuffle,
      rate = excluded.rate,
      updated_at = excluded.updated_at
  `).run(userId, track_id || null, position_sec || 0, queueJson, loop_mode, shuffle ? 1 : 0, rate || 1.0);

  if (track_id) {
    db.prepare(`UPDATE tracks SET last_played_at = datetime('now') WHERE id = ?`).run(track_id);
  }

  res.json({ success: true });
});

export default router;
