import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getLyrics } from '../services/lyrics.js';

const router = express.Router();

/**
 * GET /api/lyrics
 * Query params: trackId, title, artist, duration
 */
router.get('/', requireAuth, async (req, res) => {
  const { trackId, title, artist, duration } = req.query;

  try {
    const result = await getLyrics({
      trackId: trackId || '',
      title: title || '',
      artist: artist || '',
      duration: parseFloat(duration) || 0
    });

    res.json(result);
  } catch (err) {
    console.error('Error fetching lyrics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
