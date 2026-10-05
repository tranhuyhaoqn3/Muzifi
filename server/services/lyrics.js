import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';

// Ensure lyrics_cache table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS lyrics_cache (
    cache_key TEXT PRIMARY KEY,
    title TEXT,
    artist TEXT,
    synced_lyrics TEXT,
    plain_lyrics TEXT,
    source TEXT,
    created_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_lyrics_key ON lyrics_cache(cache_key);
`);

/**
 * Clean channel name from generic network and aggregator suffixes
 */
function cleanChannelName(channel = '') {
  if (!channel) return '';
  let cleaned = channel.trim();

  // If the channel is pure aggregator/network, clear it so it doesn't pollute metadata
  if (/^(nhacpro|pops|vie channel|zing|nhaccuatui|metub|dien quan|yeah1)/i.test(cleaned)) {
    return '';
  }

  // Remove common suffixes like "Official", "Topic", "Music", "Channel", "VEVO", "Records"
  cleaned = cleaned
    .replace(/\s+(official|topic|music|channel|vevo|records|entertainment|production)$/i, '')
    .trim();

  return cleaned;
}

/**
 * Clean noisy titles from music releases
 */
export function cleanMetadata(rawTitle = '', rawArtist = '') {
  let title = (rawTitle || '').trim();
  let artist = cleanChannelName(rawArtist || '');

  // Remove leading track numbers like "01. ", "07. ", "1 - "
  title = title.replace(/^(\d+[\.\-\s]+)+/, '');

  // Remove common media tags in brackets/parentheses
  title = title
    .replace(/\[[^\]]*(official|audio|video|mv|lyric|lyrics|prod|album|remix|hd|4k|m\/v|pnj)[^\]]*\]/gi, '')
    .replace(/\([^\)]*(official|audio|video|mv|lyric|lyrics|prod|album|remix|hd|4k|m\/v|cover|theme song)[^\)]*\)/gi, '')
    .replace(/\[[^\]]*\]/g, '') // remove remaining brackets
    .trim();

  // Handle pipe separators e.g. "Sơn Tùng M-TP | Đừng Làm Trái Tim Anh Đau | Official MV"
  if (title.includes('|')) {
    const rawPipes = title.split('|').map(s => s.trim()).filter(Boolean);
    const validParts = rawPipes.filter(p => !/(official|audio|video|mv|lyric|lyrics|prod|album|remix|hd|4k|m\/v|pnj)/i.test(p));
    if (validParts.length >= 2) {
      const [p0, p1] = validParts;
      if (artist && p0.toLowerCase().includes(artist.toLowerCase())) {
        artist = p0;
        title = p1;
      } else if (artist && p1.toLowerCase().includes(artist.toLowerCase())) {
        artist = p1;
        title = p0;
      } else {
        // If one contains ' - ', use that one as the main title
        if (p0.includes(' - ')) {
          title = p0;
        } else if (p1.includes(' - ')) {
          title = p1;
        } else {
          artist = artist || p0;
          title = p1;
        }
      }
    } else if (validParts.length === 1) {
      title = validParts[0];
    }
  }

  title = title.replace(/\s+/g, ' ').trim();

  // Handle "A - B"
  let possibleArtist = artist;
  let possibleTitle = title;

  if (title.includes(' - ')) {
    const parts = title.split(' - ').map(s => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const [part0, part1] = parts;
      const part0HasArtist = /\b(x|ft\.|feat\.|&|ft|feat)\b/i.test(part0);
      const part1HasArtist = /\b(x|ft\.|feat\.|&|ft|feat)\b/i.test(part1);

      if (part1HasArtist && !part0HasArtist) {
        // e.g. "Hoa Bất Tử - Thành Đạt x Phát Huy T4"
        possibleTitle = part0;
        possibleArtist = part1;
      } else if (part0HasArtist && !part1HasArtist) {
        // e.g. "Thành Đạt x Phát Huy T4 - Hoa Bất Tử"
        possibleArtist = part0;
        possibleTitle = part1;
      } else if (artist && part0.toLowerCase().includes(artist.toLowerCase())) {
        // e.g. "Sơn Tùng M-TP - Đừng Làm Trái Tim Anh Đau"
        possibleArtist = part0;
        possibleTitle = part1;
      } else if (artist && part1.toLowerCase().includes(artist.toLowerCase())) {
        // e.g. "Đừng Làm Trái Tim Anh Đau - Sơn Tùng M-TP"
        possibleTitle = part0;
        possibleArtist = part1;
      } else {
        // Default assumption
        possibleArtist = artist || part0;
        possibleTitle = part1;
      }
    }
  }

  // Remove trailing feat / ft
  possibleTitle = possibleTitle.replace(/\s*\(feat\..*?\)/i, '').replace(/\s*\(ft\..*?\)/i, '').trim();

  return { title: possibleTitle, artist: possibleArtist };
}

/**
 * Parse .lrc string into sorted array of { time: float (seconds), text: string }
 */
export function parseLrc(lrcText = '') {
  if (!lrcText || typeof lrcText !== 'string') return [];
  const lines = lrcText.split('\n');
  const result = [];
  const timeRegex = /\[(\d{1,2}):(\d{1,2}(?:\.\d{1,3})?)\]/g;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const matches = [...trimmed.matchAll(timeRegex)];
    if (matches.length > 0) {
      const text = trimmed.replace(timeRegex, '').trim();
      for (const m of matches) {
        const min = parseInt(m[1], 10);
        const sec = parseFloat(m[2]);
        const time = min * 60 + sec;
        result.push({ time: parseFloat(time.toFixed(2)), text });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}



/**
 * Fetch lyrics from LRCLIB API with smart fallbacks
 */
async function queryLrclib(title, artist, duration = 0) {
  const headers = { 'User-Agent': 'CloudBeats Music Streamer/1.0' };

  // 1. Try exact match if both title and artist are present
  if (title && artist) {
    try {
      const url = new URL('https://lrclib.net/api/get');
      url.searchParams.set('track_name', title);
      url.searchParams.set('artist_name', artist);
      if (duration > 0) {
        url.searchParams.set('duration', Math.round(duration).toString());
      }

      const res = await fetch(url.toString(), { headers, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = await res.json();
        if (data.syncedLyrics || data.plainLyrics) {
          return {
            title: data.trackName || title,
            artist: data.artistName || artist,
            syncedLyrics: data.syncedLyrics || '',
            plainLyrics: data.plainLyrics || '',
            source: 'lrclib_exact'
          };
        }
      }
    } catch (e) {
      // Ignore and fallback to search
    }
  }

  // 2. Fallback to search query: title + artist, then title only
  const searchQueries = [
    [title, artist].filter(Boolean).join(' '),
    title
  ];

  const normTitle = title.toLowerCase().trim();

  for (const queryStr of searchQueries) {
    if (!queryStr) continue;
    try {
      const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(queryStr)}`;
      const res = await fetch(searchUrl, { headers, signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const list = await res.json();
        if (Array.isArray(list) && list.length > 0) {
          // Filter results where trackName resembles the target title
          const matching = list.filter(item => {
            const itTitle = (item.trackName || '').toLowerCase().trim();
            return itTitle === normTitle || itTitle.includes(normTitle) || normTitle.includes(itTitle);
          });

          const candidates = matching.length > 0 ? matching : list;

          // Prioritize results that have synced lyrics
          const best = candidates.find(item => item.syncedLyrics) || candidates.find(item => item.plainLyrics) || candidates[0];
          if (best && (best.syncedLyrics || best.plainLyrics)) {
            return {
              title: best.trackName || title,
              artist: best.artistName || artist,
              syncedLyrics: best.syncedLyrics || '',
              plainLyrics: best.plainLyrics || '',
              source: 'lrclib_search'
            };
          }
        }
      }
    } catch (e) {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Main service to get lyrics for a track (local or online)
 */
export async function getLyrics({ trackId = '', title = '', artist = '', duration = 0 }) {
  let cleanT = title;
  let cleanA = artist;
  let dur = parseFloat(duration) || 0;

  // 1. If local track ID provided, check local database and filesystem first
  if (trackId && !trackId.startsWith('sc_') && !trackId.startsWith('yt_')) {
    const localTrack = db.prepare('SELECT * FROM tracks WHERE id = ?').get(trackId);
    if (localTrack) {
      cleanT = cleanT || localTrack.title;
      cleanA = cleanA || localTrack.artist;
      dur = dur || localTrack.duration_sec || 0;

      // Check for sidecar .lrc file in media folder
      const trackExt = path.extname(localTrack.file_path);
      const candidateLrcPaths = [
        path.join(config.MEDIA_DIR, `${localTrack.id}.lrc`),
        path.join(config.MEDIA_DIR, localTrack.file_path.replace(trackExt, '.lrc')),
        path.join(config.MEDIA_DIR, `${localTrack.title} - ${localTrack.artist}.lrc`)
      ];

      for (const lrcPath of candidateLrcPaths) {
        if (fs.existsSync(lrcPath)) {
          try {
            const lrcContent = fs.readFileSync(lrcPath, 'utf8');
            const parsed = parseLrc(lrcContent);
            return {
              success: true,
              title: cleanT,
              artist: cleanA,
              syncedLyrics: lrcContent,
              plainLyrics: parsed.map(p => p.text).join('\n'),
              parsedLyrics: parsed,
              hasSynced: parsed.length > 0,
              source: 'local_lrc_file'
            };
          } catch (e) {
            console.warn('Failed to read local .lrc file:', e);
          }
        }
      }
    }
  }

  const cleaned = cleanMetadata(cleanT, cleanA);
  cleanT = cleaned.title;
  cleanA = cleaned.artist;

  const cacheKey = `${cleanT.toLowerCase()}_${cleanA.toLowerCase()}`;

  // 2. Check SQLite cache
  const cached = db.prepare('SELECT * FROM lyrics_cache WHERE cache_key = ?').get(cacheKey);
  if (cached) {
    const parsed = parseLrc(cached.synced_lyrics);
    return {
      success: true,
      title: cached.title,
      artist: cached.artist,
      syncedLyrics: cached.synced_lyrics || '',
      plainLyrics: cached.plain_lyrics || '',
      parsedLyrics: parsed,
      hasSynced: parsed.length > 0,
      source: cached.source || 'cache'
    };
  }

  let fetched = null;
  // 3. Query LRCLIB
  if (cleanT) {
    fetched = await queryLrclib(cleanT, cleanA, dur);
  }

  // 5. If lyrics found, cache in SQLite and return
  if (fetched && (fetched.syncedLyrics || fetched.plainLyrics)) {
    const parsed = fetched.parsedLyrics || parseLrc(fetched.syncedLyrics);

    db.prepare(`
      INSERT INTO lyrics_cache (cache_key, title, artist, synced_lyrics, plain_lyrics, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        synced_lyrics = excluded.synced_lyrics,
        plain_lyrics = excluded.plain_lyrics,
        source = excluded.source,
        created_at = excluded.created_at
    `).run(
      cacheKey,
      fetched.title || cleanT,
      fetched.artist || cleanA,
      fetched.syncedLyrics || '',
      fetched.plainLyrics || '',
      fetched.source || 'online',
      Date.now()
    );

    // Also save as local .lrc file in media folder for instant offline reading
    try {
      if (trackId && !trackId.startsWith('yt_') && (fetched.syncedLyrics || fetched.plainLyrics)) {
        const lrcFilePath = path.join(config.MEDIA_DIR, `${trackId}.lrc`);
        fs.writeFileSync(lrcFilePath, fetched.syncedLyrics || fetched.plainLyrics, 'utf8');
      }
    } catch (e) {
      console.warn('Failed to write .lrc sidecar file:', e.message);
    }

    return {
      success: true,
      title: fetched.title || cleanT,
      artist: fetched.artist || cleanA,
      syncedLyrics: fetched.syncedLyrics || '',
      plainLyrics: fetched.plainLyrics || '',
      parsedLyrics: parsed,
      hasSynced: parsed.length > 0,
      source: fetched.source
    };
  }

  return {
    success: false,
    message: 'Chưa có lời cho bài hát này',
    title: cleanT,
    artist: cleanA
  };
}
