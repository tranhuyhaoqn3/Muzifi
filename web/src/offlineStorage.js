/**
 * Muzifi Offline Storage - Native IndexedDB Engine
 * Designed specifically for iOS Safari PWA & modern browsers.
 * Bypasses iOS CacheStorage 50MB quota limits and AVPlayer HTTP 206 range stalls.
 */

const DB_NAME = 'muzifi_offline_v2';
const DB_VERSION = 1;
const STORE_NAME = 'tracks_blob';

let dbInstance = null;

function openDB() {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      return reject(new Error('IndexedDB không được hỗ trợ trên trình duyệt này'));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    req.onsuccess = (e) => {
      dbInstance = e.target.result;
      dbInstance.onclose = () => { dbInstance = null; };
      resolve(dbInstance);
    };

    req.onerror = (e) => {
      reject(req.error || new Error('Không thể mở IndexedDB'));
    };
  });
}

/** Check if a track is physically saved in IndexedDB on this device */
export async function hasTrackOffline(trackId) {
  if (!trackId) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getKey(trackId);
      req.onsuccess = () => resolve(Boolean(req.result));
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Get track record (blob, mime, lyrics, etc.) from IndexedDB */
export async function getTrackOffline(trackId) {
  if (!trackId) return null;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] getTrackOffline error:', err);
    return null;
  }
}

/** Get a Set of all track IDs currently stored on this device */
export async function getAllOfflineTrackIds() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(new Set(req.result || []));
      req.onerror = () => resolve(new Set());
    });
  } catch {
    return new Set();
  }
}

/** Get all full track records (blobs, titles, artists, etc.) stored in IndexedDB */
export async function getAllOfflineTracks() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

/** Save or update a local track record directly in IndexedDB (for serverless/offline mode) */
export async function saveLocalTrackDirect(record) {
  if (!record || !record.id) return false;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[OfflineStorage] saveLocalTrackDirect error:', err);
    return false;
  }
}

/** Delete a track record directly from IndexedDB */
export async function deleteOfflineTrack(trackId) {
  if (!trackId) return false;
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

const inFlightSaves = new Map();

/** Download full track audio, thumbnail, and lyrics and save as Blob into IndexedDB */
export async function saveTrackOffline(track, token = '', onProgress = null) {
  if (!track || !track.id) return false;
  const trackId = track.id;

  if (inFlightSaves.has(trackId)) {
    return inFlightSaves.get(trackId);
  }

  const promise = _doSaveTrackOffline(track, token, onProgress).finally(() => {
    inFlightSaves.delete(trackId);
  });

  inFlightSaves.set(trackId, promise);
  return promise;
}

async function _doSaveTrackOffline(track, token = '', onProgress = null) {
  if (!track || !track.id) return false;
  const authToken = token || localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token') || '';

  const streamPath = `/api/tracks/${track.id}/stream`;
  const streamUrl = authToken ? `${streamPath}?token=${encodeURIComponent(authToken)}` : streamPath;

  const thumbPath = `/api/tracks/${track.id}/thumb`;
  const thumbUrl = authToken ? `${thumbPath}?token=${encodeURIComponent(authToken)}` : thumbPath;

  const lyricsPath = `/api/lyrics?trackId=${encodeURIComponent(track.id)}`;
  const lyricsUrl = authToken ? `${lyricsPath}&token=${encodeURIComponent(authToken)}` : lyricsPath;

  try {
    // 1. Fetch thumbnail & lyrics in PARALLEL with the audio stream (non-blocking)
    const thumbPromise = fetch(thumbUrl, { credentials: 'include' })
      .then(res => res.ok ? res.blob() : null)
      .catch(() => null);

    const lyricsPromise = fetch(lyricsUrl, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .catch(() => null);

    // 2. Fetch audio stream with real-time transfer progress
    const audioRes = await fetch(streamUrl, { credentials: 'include' });
    if (!audioRes.ok) {
      throw new Error(`Tải audio thất bại (HTTP ${audioRes.status})`);
    }

    const contentLength = parseInt(audioRes.headers.get('content-length') || '0', 10);
    const mime = track.mime || (track.media_type === 'video' ? 'video/mp4' : 'audio/mp4');
    let audioBlob = null;

    let lastReportTime = 0;
    let lastReportPercent = -1;

    const reportProgress = (percent, received, total, force = false) => {
      if (!onProgress) return;
      const now = Date.now();
      // Throttle to at most once per 180ms or when percent increases by >= 3%, unless forced
      if (!force && now - lastReportTime < 180 && percent < lastReportPercent + 3) {
        return;
      }
      lastReportTime = now;
      lastReportPercent = percent;
      const loadedMb = (received / (1024 * 1024)).toFixed(1);
      const totalMb = total > 0 ? (total / (1024 * 1024)).toFixed(1) : loadedMb;
      try {
        onProgress({ receivedBytes: received, contentLength: total, percent, loadedMb, totalMb });
      } catch (e) {}
    };

    if (contentLength > 0 && audioRes.body && typeof audioRes.body.getReader === 'function') {
      const reader = audioRes.body.getReader();
      const chunks = [];
      let receivedBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        receivedBytes += value.length;
        const percent = Math.min(99, Math.round((receivedBytes / contentLength) * 100));
        reportProgress(percent, receivedBytes, contentLength);
      }
      reportProgress(100, receivedBytes, contentLength, true);
      audioBlob = new Blob(chunks, { type: mime });
    } else {
      const rawBlob = await audioRes.blob();
      if (!rawBlob || rawBlob.size === 0) {
        throw new Error('Dữ liệu audio nhận được rỗng');
      }
      audioBlob = rawBlob.type ? rawBlob : new Blob([rawBlob], { type: mime });
      reportProgress(100, audioBlob.size, audioBlob.size, true);
    }

    // 3. Await parallel thumb and lyrics (they typically finish long before the audio finishes)
    const [thumbBlob, lyricsData] = await Promise.all([thumbPromise, lyricsPromise]);

    // 4. Save into IndexedDB
    const record = {
      id: track.id,
      title: track.title,
      artist: track.artist,
      duration_sec: track.duration_sec,
      media_type: track.media_type,
      mime: audioBlob.type || mime,
      blob: audioBlob,
      size: audioBlob.size,
      thumbBlob: thumbBlob,
      lyrics: (lyricsData && (lyricsData.hasSynced || lyricsData.plainLyrics)) ? lyricsData : null,
      savedAt: Date.now()
    };

    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });

    return true;
  } catch (err) {
    console.warn(`[OfflineStorage] Failed to save track ${track.id}:`, err);
    throw err;
  }
}

/** Delete a track from IndexedDB */
export async function deleteTrackOffline(trackId) {
  if (!trackId) return false;
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(trackId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/** Clear all offline tracks from IndexedDB */
export async function clearAllOfflineTracks() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

