import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { queue, registerSSEClient } from '../services/queue.js';

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const jobs = queue.getUserJobs(userId, 100);
  res.json(jobs);
});

// SSE endpoint for realtime job progress
router.get('/stream', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial jobs state
  const jobs = queue.getUserJobs(userId, 30);
  res.write(`data: ${JSON.stringify({ type: 'init', jobs })}\n\n`);

  registerSSEClient(res);
});

router.post('/:id/cancel', requireAuth, (req, res) => {
  const result = queue.cancelJob(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/:id/retry', requireAuth, (req, res) => {
  const result = queue.retryJob(req.params.id);
  if (!result.success) {
    return res.status(404).json(result);
  }
  res.json(result);
});

router.post('/clear-completed', requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  db.prepare(`
    DELETE FROM jobs 
    WHERE user_id = ? AND status IN ('done', 'canceled', 'error')
  `).run(userId);
  res.json({ success: true });
});

export default router;
