import express from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth } from '../middleware/auth.js';
import { getAllSettings, setSetting, getSetting, getAllUserSettings, setUserSetting } from '../db.js';
import { getStorageStats, cleanTmpDir } from '../services/storage.js';
import { updateYtDlp } from '../services/ytdlp.js';

const router = express.Router();

// Helper to securely check if request is strictly from loopback / localhost IP (prevents Host header spoofing)
function isLocalRequest(req) {
  const ip = req.ip || req.socket?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

router.get('/storage', requireAuth, (req, res) => {
  const stats = getStorageStats();
  res.json(stats);
});

router.post('/clean-tmp', requireAuth, (req, res) => {
  cleanTmpDir();
  res.json({ success: true });
});

router.post('/update-ytdlp', requireAuth, async (req, res) => {
  try {
    const result = await updateYtDlp();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Load settings for current user (works on all devices)
router.get(['/', '/settings'], requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const settings = getAllUserSettings(userId);
  delete settings.app_password;
  res.json(settings);
});

// Update settings for current user (works on all devices)
router.put(['/', '/settings'], requireAuth, (req, res) => {
  const userId = req.user?.id || 'default';
  const { 
    unknown_format_policy, 
    default_video_quality, 
    seek_step, 
    max_concurrent_jobs, 
    theme,
    google_client_id,
    google_client_secret,
    google_redirect_uri,
    new_password
  } = req.body || {};

  // User-specific preferences
  if (unknown_format_policy) setUserSetting(userId, 'unknown_format_policy', unknown_format_policy);
  if (default_video_quality) setUserSetting(userId, 'default_video_quality', default_video_quality);
  if (seek_step) setUserSetting(userId, 'seek_step', seek_step);
  if (max_concurrent_jobs) setUserSetting(userId, 'max_concurrent_jobs', max_concurrent_jobs);
  if (theme) setUserSetting(userId, 'theme', theme);

  // Global settings (Google OAuth configuration & admin password): ONLY allowed for localhost/admin
  if (isLocalRequest(req)) {
    if (google_client_id !== undefined) setSetting('google_client_id', google_client_id.trim());
    if (google_client_secret !== undefined) setSetting('google_client_secret', google_client_secret.trim());
    if (google_redirect_uri !== undefined) setSetting('google_redirect_uri', google_redirect_uri.trim());

    // Password change handling (system admin)
    if (new_password) {
      if (new_password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters long' });
      }
      const hash = bcrypt.hashSync(new_password, 10);
      setSetting('app_password', hash);
    }
  }

  const updated = getAllUserSettings(userId);
  delete updated.app_password;
  res.json({ success: true, settings: updated });
});

export default router;
