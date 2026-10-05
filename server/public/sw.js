/**
 * Muzifi Service Worker - Offline-First PWA
 * 
 * Strategies:
 * - App Shell: Install-time cache, cache-first serving
 * - Track List / Playlists / Auth: Network-first, cache fallback (offline library browse)
 * - Thumbnails: Stale-while-revalidate (fast + always fresh)
 * - Audio/Video Streams: Network-first, auto-background-cache after play, range-aware offline serving
 * - YouTube/Online: Network-only (skip caching)
 */

const SHELL_CACHE = 'muzifi-shell-v3';
const DATA_CACHE = 'muzifi-data-v3';
const MEDIA_CACHE = 'muzifi-media-v3';

let userToken = '';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-180x180.png',
  '/icon-192x192.png',
  '/fonts/plus-jakarta-sans-latin.woff2',
  '/fonts/plus-jakarta-sans-vietnamese.woff2',
  '/fonts/plus-jakarta-sans-latin-ext.woff2',
  '/fonts/plus-jakarta-sans-cyrillic.woff2',
  '/assets/main-Codf8fWC.css',
  '/assets/main-CTiC3y_A.js'
];

// ─── Install ──────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await cache.addAll(SHELL_ASSETS);
    // Discover and precache JS and CSS bundles from index.html
    try {
      const indexRes = await fetch('/index.html', { cache: 'no-cache' });
      if (indexRes.ok) {
        await cache.put('/index.html', indexRes.clone());
        await cache.put('/', indexRes.clone());
        const html = await indexRes.text();
        const assetMatches = Array.from(html.matchAll(/(?:href|src)="(\/assets\/[^"]+)"/g));
        for (const m of assetMatches) {
          const assetUrl = m[1];
          try {
            const assetRes = await fetch(assetUrl);
            if (assetRes.ok) {
              await cache.put(assetUrl, assetRes);
            }
          } catch (e) {
            console.warn('[SW] Precache asset failed:', assetUrl, e);
          }
        }
      }
    } catch (e) {
      console.warn('[SW] Discover assets failed:', e);
    }
  })());
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, DATA_CACHE, MEDIA_CACHE];
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ─── Message handler (pre-cache from client) ──────────────
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg) return;

  if (msg.token) {
    userToken = msg.token;
  }

  if (msg.type === 'SET_TOKEN') {
    userToken = msg.token || '';
  }
  if (msg.type === 'CACHE_TRACK') {
    // Client tells us to background-cache a track stream
    bgCacheStream(msg.trackId, msg.token || userToken).catch(() => { });
  }
  if (msg.type === 'CACHE_TRACKS_BATCH') {
    // Cache multiple tracks (thumbnails + streams) in background
    bgCacheBatch(msg.trackIds || [], msg.token || userToken).catch(() => { });
  }
  if (msg.type === 'GET_CACHED_TRACKS') {
    // Return list of cached track IDs to client
    getCachedTrackIds().then(ids => {
      event.source?.postMessage({ type: 'CACHED_TRACKS', ids });
    });
  }
});

/** Background-cache a single track stream */
async function bgCacheStream(trackId, token) {
  const effectiveToken = token || userToken;
  const dataCache = await caches.open(DATA_CACHE);
  const mediaCache = await caches.open(MEDIA_CACHE);

  // Cache thumb
  try {
    const thumbPath = `/api/tracks/${trackId}/thumb`;
    const thumbUrl = effectiveToken ? `${thumbPath}?token=${encodeURIComponent(effectiveToken)}` : thumbPath;
    if (!(await dataCache.match(thumbPath))) {
      const res = await fetch(thumbUrl, { credentials: 'include' });
      if (res.ok) await dataCache.put(thumbPath, res);
    }
  } catch { }

  // Stream caching is handled directly by IndexedDB (tracks_blob)
  // to avoid iOS WebKit Range stalls and duplicate bandwidth usage.

  // Cache lyrics
  try {
    const lyricsPath = `/api/lyrics?trackId=${encodeURIComponent(trackId)}`;
    const lyricsUrl = effectiveToken ? `${lyricsPath}&token=${encodeURIComponent(effectiveToken)}` : lyricsPath;
    if (!(await dataCache.match(lyricsPath))) {
      const res = await fetch(lyricsUrl, { credentials: 'include' });
      if (res.ok) {
        await dataCache.put(lyricsPath, res.clone());
        await dataCache.put(`/api/lyrics?trackId=${trackId}`, res);
      }
    }
  } catch { }
}

/** Background-cache thumbnails + lyrics for a batch of tracks (throttled) */
async function bgCacheBatch(trackIds, token) {
  const effectiveToken = token || userToken;
  const dataCache = await caches.open(DATA_CACHE);

  for (const id of trackIds) {
    // Thumb
    try {
      const thumbPath = `/api/tracks/${id}/thumb`;
      const thumbUrl = effectiveToken ? `${thumbPath}?token=${encodeURIComponent(effectiveToken)}` : thumbPath;
      if (!(await dataCache.match(thumbPath))) {
        const res = await fetch(thumbUrl, { credentials: 'include' });
        if (res.ok) await dataCache.put(thumbPath, res);
      }
    } catch { }

    // Lyrics
    try {
      const lyricsPath = `/api/lyrics?trackId=${encodeURIComponent(id)}`;
      const lyricsUrl = effectiveToken ? `${lyricsPath}&token=${encodeURIComponent(effectiveToken)}` : lyricsPath;
      if (!(await dataCache.match(lyricsPath))) {
        const res = await fetch(lyricsUrl, { credentials: 'include' });
        if (res.ok) {
          await dataCache.put(lyricsPath, res.clone());
          await dataCache.put(`/api/lyrics?trackId=${id}`, res);
        }
      }
    } catch { }

    // Throttle
    await new Promise(r => setTimeout(r, 100));
  }
}

/** Return array of track IDs that have their stream cached */
async function getCachedTrackIds() {
  try {
    const cache = await caches.open(MEDIA_CACHE);
    const keys = await cache.keys();
    const ids = [];
    for (const req of keys) {
      const m = new URL(req.url).pathname.match(/^\/api\/tracks\/([^/]+)\/stream$/);
      if (m) ids.push(m[1]);
    }
    return ids;
  } catch {
    return [];
  }
}

// ─── Fetch handler ────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Ignore non-HTTP schemes (e.g. chrome-extension://, moz-extension://)
  if (!url.protocol.startsWith('http')) return;
  if (event.request.method !== 'GET') return;

  // ── Skip: YouTube / online endpoints (network only) ──
  if (url.pathname.startsWith('/api/youtube')) return;
  // ── Skip: Jobs SSE stream ──
  if (url.pathname.startsWith('/api/jobs')) return;

  // ── Auth check: network-first with cache ──
  if (url.pathname === '/api/auth/me') {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // ── Track listing: network-first with cache ──
  if (url.pathname === '/api/tracks' && !url.searchParams.has('nocache')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // ── Playlists: network-first with cache ──
  if (url.pathname.startsWith('/api/playlists')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // ── Player state: network-first with cache ──
  if (url.pathname === '/api/player-state') {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // ── Lyrics: network-first with cache ──
  if (url.pathname.startsWith('/api/lyrics')) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // ── Track thumbnails: stale-while-revalidate ──
  if (/^\/api\/tracks\/[^/]+\/thumb$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request, DATA_CACHE));
    return;
  }

  // ── Track streams: direct streaming when online (avoids WebKit/iOS Safari Range 206 bug), cache fallback when offline ──
  if (/^\/api\/tracks\/[^/]+\/stream$/.test(url.pathname)) {
    if (!navigator.onLine) {
      event.respondWith(serveStreamFromCache(url.pathname, event.request));
      return;
    }
    // When online: let browser natively fetch from server with native HTTP 206 range support.
    // Trigger background cache of full file so it will be available offline:
    event.waitUntil(bgCacheFullFile(url.pathname, url.searchParams.get('token')));
    return;
  }

  // ── Settings / system: network only ──
  if (url.pathname.startsWith('/api/system') || url.pathname.startsWith('/api/settings')) return;

  // ── App shell / static assets: cache-first ──
  if (!url.pathname.startsWith('/api/')) {
    event.respondWith(cacheFirstShell(event.request));
    return;
  }
});

// ─── Strategies ───────────────────────────────────────────

/** Network first → cache fallback. Cache successful network responses. */
async function networkFirst(request, cacheName) {
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    const cache = await caches.open(cacheName);
    let cached = await cache.match(request);
    if (cached) return cached;

    // Fallback: match ignoring query string so offline filtering/pagination works
    cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;

    return jsonError('Đang offline — dữ liệu chưa được lưu đệm');
  }
}

/** Cache first → network fallback. For navigation, network-first to ensure latest bundle. */
async function cacheFirstShell(request) {
  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Navigation requests: try network first so fresh index.html with new JS/CSS hashes loads
  if (request.mode === 'navigate') {
    try {
      const netRes = await fetch(request);
      if (netRes.ok) {
        const cache = await caches.open(SHELL_CACHE);
        cache.put(request, netRes.clone());
        cache.put('/index.html', netRes.clone());
        cache.put('/', netRes.clone());
        return netRes;
      }
    } catch {
      const cachedIndex = await caches.match('/index.html') || await caches.match('/');
      if (cachedIndex) return cachedIndex;
    }
  }

  // 1. Exact cache match
  const cached = await caches.match(request);
  if (cached) return cached;

  // 2. Try network
  try {
    const res = await fetch(request);
    if (res.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch {
    // 3. Network failed (offline): Robust fallbacks
    // Navigation requests fallback to cached index.html (SPA)
    if (request.mode === 'navigate') {
      const index = await caches.match('/index.html') || await caches.match('/');
      if (index) return index;
    }

    // Asset fallback: if asking for /assets/*.css or /assets/*.js with a different hash,
    // match ANY cached CSS or JS file from SHELL_CACHE so the UI never breaks offline
    if (url.pathname.includes('/assets/')) {
      const cache = await caches.open(SHELL_CACHE);
      const keys = await cache.keys();
      if (url.pathname.endsWith('.css')) {
        const fallbackCss = keys.find(k => k.url.includes('/assets/') && k.url.endsWith('.css'));
        if (fallbackCss) {
          const matched = await cache.match(fallbackCss);
          if (matched) return matched;
        }
      }
      if (url.pathname.endsWith('.js')) {
        const fallbackJs = keys.find(k => k.url.includes('/assets/') && k.url.endsWith('.js'));
        if (fallbackJs) {
          const matched = await cache.match(fallbackJs);
          if (matched) return matched;
        }
      }
    }

    return new Response('Offline', { status: 503 });
  }
}

/** Stale-while-revalidate: serve from cache immediately, update in background. */
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => null);

  if (cached) return cached;
  const networkRes = await networkPromise;
  return networkRes || new Response('', { status: 503 });
}

/** Stream handler: Network-first when online for instant native 206 streaming; cache fallback for offline */
async function handleStream(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const token = url.searchParams.get('token') || userToken;
  if (token) userToken = token;

  // 1. If online: fetch directly from network first (native 206 range support)
  if (navigator.onLine) {
    try {
      const res = await fetch(request);
      if (res.ok || res.status === 206) {
        if (res.status === 200) {
          const cache = await caches.open(MEDIA_CACHE);
          cache.put(pathname, res.clone()).catch(() => { });
        } else if (res.status === 206) {
          bgCacheFullFile(pathname, token);
        }
        return res;
      }
    } catch (e) {
      // Network failed or offline, fall through to cache
    }
  }

  // 2. Offline fallback: serve from local cache
  const cachedRes = await serveStreamFromCache(pathname, request, true);
  if (cachedRes) {
    return cachedRes;
  }

  return new Response('Nội dung này chưa được lưu đệm để phát offline.', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

/** Background-cache the full stream file (without Range header). Fire-and-forget. */
async function bgCacheFullFile(pathname, token) {
  const cache = await caches.open(MEDIA_CACHE);
  const existing = await cache.match(pathname);
  if (existing) return;

  try {
    const effectiveToken = token || userToken;
    const fetchUrl = effectiveToken
      ? `${pathname}?token=${encodeURIComponent(effectiveToken)}`
      : pathname;
    // Fetch full file without Range header → server returns 200 with complete file
    const res = await fetch(fetchUrl, { credentials: 'include' });
    if (res.ok && res.status === 200) {
      await cache.put(pathname, res);
    }
  } catch {
    // best-effort
  }
}

/** Serve a cached stream, handling Range requests by slicing the cached blob. */
async function serveStreamFromCache(pathname, request, isCheck = false) {
  const cache = await caches.open(MEDIA_CACHE);
  let cached = await cache.match(pathname);
  if (!cached) {
    cached = await cache.match(request, { ignoreSearch: true });
  }
  if (!cached) {
    cached = await cache.match(request);
  }
  if (!cached) {
    const m = pathname.match(/^\/api\/tracks\/([^/]+)\/stream$/);
    if (m) {
      const keys = await cache.keys();
      const matchedKey = keys.find(k => k.url.includes(`/api/tracks/${m[1]}/stream`));
      if (matchedKey) {
        cached = await cache.match(matchedKey);
      }
    }
  }

  if (!cached) {
    if (isCheck) return null;
    return new Response('Nội dung này chưa được lưu đệm để phát offline.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  }

  const rangeHeader = request.headers.get('Range');
  const contentType = cached.headers.get('Content-Type') || (pathname.endsWith('.mp4') ? 'video/mp4' : 'audio/mp4');

  if (!rangeHeader) {
    // No range → return full cached response with Accept-Ranges
    const clone = cached.clone();
    const headers = new Headers(clone.headers);
    headers.set('Accept-Ranges', 'bytes');
    return new Response(clone.body, {
      status: 200,
      headers
    });
  }

  // Parse "bytes=START-END"
  const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
  if (!match) return cached.clone();

  const blob = await cached.blob();
  const total = blob.size;
  const start = parseInt(match[1], 10);

  if (start >= total) {
    return new Response('', {
      status: 416,
      headers: {
        'Content-Range': `bytes */${total}`,
        'Accept-Ranges': 'bytes'
      }
    });
  }

  const end = match[2] ? Math.min(parseInt(match[2], 10), total - 1) : total - 1;
  const slice = blob.slice(start, end + 1);

  return new Response(slice, {
    status: 206,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(slice.size),
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
    }
  });
}

/** Helper: return a JSON error response */
function jsonError(message, status = 503) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
