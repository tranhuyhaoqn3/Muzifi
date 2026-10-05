import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { config } from '../config.js';
import { db } from '../db.js';
import { 
  checkLoginRateLimit, 
  recordFailedAttempt, 
  resetFailedAttempts, 
  generateToken, 
  getCurrentPassword,
  verifyToken 
} from '../middleware/auth.js';
import { 
  generateGoogleAuthUrl, 
  exchangeCodeForTokens, 
  getGoogleCredentials,
  fetchUserYouTubeData 
} from '../services/googleAuth.js';

const router = express.Router();

// 1. Current user status & info
router.get('/me', (req, res) => {
  let token = req.cookies?.[config.COOKIE_NAME];
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }
  if (!token && req.query?.token) {
    token = req.query.token;
  }

  const verified = verifyToken(token);
  let user = null;
  if (verified && verified.userId) {
    user = db.prepare('SELECT id, google_id, email, name, avatar, refresh_token FROM users WHERE id = ?').get(verified.userId);
  }

  const { clientId } = getGoogleCredentials(req);
  const isGoogle = Boolean(user && user.google_id);

  // Re-establish session cookie if authenticated
  if (isGoogle && token) {
    res.cookie(config.COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: config.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      path: '/'
    });
  }

  return res.json({
    authenticated: isGoogle,
    user: isGoogle ? {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isGoogle: true
    } : null,
    googleConfigured: Boolean(clientId)
  });
});

// 2. Google OAuth - Generate Authorization URL
router.get('/google/url', (req, res) => {
  try {
    const url = generateGoogleAuthUrl(req);
    res.json({ url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 3. Google OAuth - Callback
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error || !code) {
    return res.redirect(`/?auth_error=${encodeURIComponent(error || 'Hủy đăng nhập')}`);
  }

  try {
    const { redirectUri } = getGoogleCredentials(req);
    const { tokens, profile } = await exchangeCodeForTokens(code, redirectUri, req);

    const userId = `google_${profile.sub}`;
    const now = new Date().toISOString();
    const tokenExpiry = Math.floor(Date.now() / 1000) + (tokens.expires_in || 3600);

    // Upsert user into database
    const existing = db.prepare('SELECT id, refresh_token FROM users WHERE id = ? OR google_id = ?').get(userId, profile.sub);
    const refreshToken = tokens.refresh_token || existing?.refresh_token || null;

    if (existing) {
      db.prepare(`
        UPDATE users 
        SET email = ?, name = ?, avatar = ?, access_token = ?, refresh_token = COALESCE(?, refresh_token), token_expiry = ?, updated_at = ?
        WHERE id = ?
      `).run(profile.email || '', profile.name || 'Người dùng Google', profile.picture || '', tokens.access_token, refreshToken, tokenExpiry, now, existing.id);
    } else {
      db.prepare(`
        INSERT INTO users (id, google_id, email, name, avatar, access_token, refresh_token, token_expiry, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(userId, profile.sub, profile.email || '', profile.name || 'Người dùng Google', profile.picture || '', tokens.access_token, refreshToken, tokenExpiry, now, now);
    }

    const effectiveUserId = existing ? existing.id : userId;
    const sessionToken = generateToken(effectiveUserId);

    res.cookie(config.COOKIE_NAME, sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
      maxAge: config.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
      path: '/'
    });

    // In background, fetch initial YouTube data for this user
    fetchUserYouTubeData({ id: effectiveUserId, access_token: tokens.access_token, refresh_token: refreshToken }, req)
      .then(ytData => {
        db.prepare(`
          INSERT INTO user_youtube_data (user_id, subscriptions, liked_videos, playlists, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
          ON CONFLICT(user_id) DO UPDATE SET
            subscriptions = excluded.subscriptions,
            liked_videos = excluded.liked_videos,
            playlists = excluded.playlists,
            updated_at = excluded.updated_at
        `).run(effectiveUserId, JSON.stringify(ytData.subscriptions), JSON.stringify(ytData.liked), JSON.stringify(ytData.playlists));
      })
      .catch(e => console.warn('[GoogleCallback] Background sync error:', e.message));

    res.redirect(`/?auth_token=${encodeURIComponent(sessionToken)}`);
  } catch (err) {
    console.error('[GoogleCallback] Error:', err);
    res.redirect(`/?auth_error=${encodeURIComponent(err.message)}`);
  }
});

// 4. List all available profiles (for multi-user switcher)
router.get('/profiles', (req, res) => {
  const users = db.prepare(`
    SELECT id, google_id, email, name, avatar, created_at
    FROM users 
    ORDER BY created_at ASC
  `).all();
  res.json(users);
});

// 5. Create new local profile
router.post('/profiles', (req, res) => {
  const { name, avatar = '' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Tên hồ sơ là bắt buộc' });
  }

  const id = `local_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO users (id, google_id, email, name, avatar, created_at, updated_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?)
  `).run(id, `${name.toLowerCase().replace(/\s+/g, '')}@local`, name.trim(), avatar.trim(), now, now);

  const token = generateToken(id);
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: config.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({ success: true, user: { id, name: name.trim(), avatar: avatar.trim(), isGoogle: false }, token });
});

// 6. Switch active user profile
router.post('/switch', (req, res) => {
  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }

  const user = db.prepare('SELECT id, name, email, avatar, google_id FROM users WHERE id = ?').get(userId);
  if (!user) {
    return res.status(404).json({ error: 'Không tìm thấy hồ sơ người dùng' });
  }

  const token = generateToken(user.id);
  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: config.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });

  res.json({
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      isGoogle: Boolean(user.google_id)
    },
    token
  });
});

// 7. Logout
router.post('/logout', (req, res) => {
  res.clearCookie(config.COOKIE_NAME, { path: '/' });
  res.json({ success: true });
});

// 8. Legacy password login
router.post('/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const { allowed, remainingSeconds } = checkLoginRateLimit(ip);
  if (!allowed) {
    return res.status(429).json({
      error: `Quá nhiều lần thử thất bại. Vui lòng đợi ${remainingSeconds} giây.`
    });
  }

  const { password, profileId = 'default' } = req.body || {};
  const currentPassword = getCurrentPassword();

  let isMatch = false;
  if (currentPassword.startsWith('$2a$') || currentPassword.startsWith('$2b$')) {
    isMatch = bcrypt.compareSync(password || '', currentPassword);
  } else {
    isMatch = (password === currentPassword);
  }

  if (!isMatch) {
    recordFailedAttempt(ip);
    return res.status(401).json({ error: 'Sai mật khẩu' });
  }

  resetFailedAttempts(ip);
  const token = generateToken(profileId);

  res.cookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: config.COOKIE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
    path: '/'
  });

  return res.json({ success: true, token });
});

export default router;
