import { getSetting, db } from '../db.js';
import { config } from '../config.js';

export function getGoogleCredentials(req) {
  const clientId = (getSetting('google_client_id', '') || config.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (getSetting('google_client_secret', '') || config.GOOGLE_CLIENT_SECRET || '').trim();
  let redirectUri = (getSetting('google_redirect_uri', '') || config.GOOGLE_REDIRECT_URI || '').trim();

  if (!redirectUri) {
    if (req) {
      const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
      const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${config.PORT}`;
      redirectUri = `${proto}://${host}/api/auth/google/callback`;
    } else {
      redirectUri = `http://localhost:${config.PORT}/api/auth/google/callback`;
    }
  }

  return { clientId, clientSecret, redirectUri };
}

export function generateGoogleAuthUrl(req) {
  const { clientId, redirectUri } = getGoogleCredentials(req);
  if (!clientId) {
    throw new Error('Chưa cấu hình Google Client ID. Vui lòng cấu hình trong Cài đặt.');
  }

  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const options = {
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: [
      'openid',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '),
    access_type: 'offline',
    prompt: 'consent'
  };

  const qs = new URLSearchParams(options);
  return `${rootUrl}?${qs.toString()}`;
}

export async function exchangeCodeForTokens(code, redirectUri, req) {
  const { clientId, clientSecret } = getGoogleCredentials(req);
  if (!clientId || !clientSecret) {
    throw new Error('Thiếu Google Client ID hoặc Client Secret');
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code'
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || tokenData.error) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to exchange Google code');
  }

  // Fetch Google User Profile
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  const profile = await userinfoRes.json();

  return {
    tokens: tokenData,
    profile
  };
}

export async function refreshAccessToken(user, req) {
  if (!user || !user.refresh_token) return user?.access_token || null;

  // Check if token is still valid (with 60s buffer)
  const nowSec = Math.floor(Date.now() / 1000);
  if (user.token_expiry && user.token_expiry > nowSec + 60) {
    return user.access_token;
  }

  const { clientId, clientSecret } = getGoogleCredentials(req);
  if (!clientId || !clientSecret) return user.access_token;

  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: user.refresh_token,
        grant_type: 'refresh_token'
      })
    });

    const data = await res.json();
    if (res.ok && data.access_token) {
      const newExpiry = nowSec + (data.expires_in || 3600);
      db.prepare(`
        UPDATE users 
        SET access_token = ?, token_expiry = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(data.access_token, newExpiry, user.id);
      return data.access_token;
    }
  } catch (err) {
    console.warn('[refreshAccessToken] Failed to refresh token:', err.message);
  }

  return user.access_token;
}

export async function fetchUserYouTubeData(user, req) {
  const token = await refreshAccessToken(user, req);
  if (!token) return { subscriptions: [], liked: [], playlists: [] };

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json'
  };

  const results = {
    subscriptions: [],
    liked: [],
    playlists: []
  };

  // 1. Fetch user subscribed channels
  try {
    const subRes = await fetch('https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50', {
      headers,
      signal: AbortSignal.timeout(8000)
    });
    if (subRes.ok) {
      const data = await subRes.json();
      results.subscriptions = (data.items || []).map(item => ({
        channelId: item.snippet?.resourceId?.channelId,
        title: item.snippet?.title,
        description: item.snippet?.description,
        thumbnail: item.snippet?.thumbnails?.default?.url || item.snippet?.thumbnails?.high?.url
      }));
    }
  } catch (e) {
    console.warn('[fetchUserYouTubeData] Subscriptions error:', e.message);
  }

  // 2. Fetch user's Liked Videos (playlist LL)
  try {
    const likedRes = await fetch('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=LL&maxResults=50', {
      headers,
      signal: AbortSignal.timeout(8000)
    });
    if (likedRes.ok) {
      const data = await likedRes.json();
      results.liked = (data.items || []).map(item => {
        const id = item.snippet?.resourceId?.videoId;
        if (!id) return null;
        return {
          id,
          url: `https://www.youtube.com/watch?v=${id}`,
          title: item.snippet?.title || 'Untitled',
          channel: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || 'YouTube',
          thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          publishedAt: item.snippet?.publishedAt
        };
      }).filter(Boolean);
    }
  } catch (e) {
    console.warn('[fetchUserYouTubeData] Liked videos error:', e.message);
  }

  // 3. Fetch user's Playlists
  try {
    const plRes = await fetch('https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&mine=true&maxResults=50', {
      headers,
      signal: AbortSignal.timeout(8000)
    });
    if (plRes.ok) {
      const data = await plRes.json();
      results.playlists = (data.items || []).map(item => ({
        id: item.id,
        title: item.snippet?.title,
        description: item.snippet?.description,
        itemCount: item.contentDetails?.itemCount || 0,
        thumbnail: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.medium?.url
      }));
    }
  } catch (e) {
    console.warn('[fetchUserYouTubeData] Playlists error:', e.message);
  }

  return results;
}
