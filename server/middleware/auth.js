import crypto from 'crypto';
import { config } from '../config.js';
import { db, getSetting } from '../db.js';

// Simple in-memory rate limiter for failed login attempts
const failedAttempts = new Map(); // ip -> { count, resetTime }

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_TIME_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip);
  if (!record) return { allowed: true };

  if (now > record.resetTime) {
    failedAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    const remainingSeconds = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, remainingSeconds };
  }

  return { allowed: true };
}

export function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = failedAttempts.get(ip) || { count: 0, resetTime: now + LOCKOUT_TIME_MS };
  record.count += 1;
  record.resetTime = now + LOCKOUT_TIME_MS;
  failedAttempts.set(ip, record);
}

export function resetFailedAttempts(ip) {
  failedAttempts.delete(ip);
}

// Generate signed multi-user session token
export function generateToken(userId = 'default') {
  const ts = Date.now().toString();
  const payload = `${userId}:${ts}`;
  const hmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${hmac}`).toString('base64url');
}

export function verifyToken(token) {
  if (!token) return null;
  try {
    let decoded = '';
    try {
      decoded = Buffer.from(token, 'base64url').toString('utf8');
    } catch {
      decoded = Buffer.from(token, 'base64').toString('utf8');
    }
    const parts = decoded.split(':');

    // Legacy format: ts:hmac
    if (parts.length === 2) {
      const [ts, hmac] = parts;
      const expectedHmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(ts).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
        return { userId: 'default' };
      }
      return null;
    }

    // Multi-user format: userId:ts:hmac
    if (parts.length === 3) {
      const [userId, ts, hmac] = parts;
      const payload = `${userId}:${ts}`;
      const expectedHmac = crypto.createHmac('sha256', config.SESSION_SECRET).update(payload).digest('hex');
      if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
        return { userId };
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Current effective password (from DB setting or config default)
export function getCurrentPassword() {
  return getSetting('app_password', config.PASSWORD);
}

// Authentication middleware with req.user population (Mandatory Google login)
export function requireAuth(req, res, next) {
  let token = req.cookies?.[config.COOKIE_NAME];

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7).trim();
  }

  if (!token && req.query?.token) {
    token = req.query.token;
  }

  const verified = verifyToken(token);
  if (verified && verified.userId) {
    const user = db.prepare('SELECT id, google_id, email, name, avatar, refresh_token, token_expiry FROM users WHERE id = ?').get(verified.userId);
    // User must be authenticated with Google
    if (user && user.google_id) {
      req.user = user;
      return next();
    }
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Yêu cầu đăng nhập bằng tài khoản Google để sử dụng ứng dụng.'
  });
}
