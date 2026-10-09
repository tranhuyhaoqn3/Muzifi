import fs from 'fs';
import path from 'path';
import { db } from '../db.js';
import { config } from '../config.js';
import { extractMetadata } from './metadata.js';
import { generateVideoThumbnail } from './ffmpeg.js';
import { getLyrics, cleanMetadata } from './lyrics.js';
import { normalizeYouTubeId } from './ytdlp.js';

/**
 * Fetch online album artwork from YouTube, iTunes or Deezer
 */
export async function fetchOnlineArtwork(title = '', artist = '', youtubeId = '') {
  const cleanId = normalizeYouTubeId(youtubeId);

  // 1. YouTube high-resolution thumbnail candidates
  if (cleanId) {
    const ytUrls = [
      `https://i.ytimg.com/vi/${cleanId}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${cleanId}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${cleanId}/mqdefault.jpg`
    ];

    for (const url of ytUrls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          // YouTube returns a tiny ~1097 byte placeholder when maxres is unavailable
          if (buf && buf.length > 2000) {
            return { buffer: buf, ext: '.jpg', source: 'youtube' };
          }
        }
      } catch {}
    }
  }

  // Clean metadata for querying music databases
  const cleaned = cleanMetadata(title, artist);
  const searchTerms = [
    `${cleaned.title} ${cleaned.artist}`.trim(),
    cleaned.title.trim()
  ].filter(Boolean);

  for (const term of searchTerms) {
    if (!term || term.length < 2) continue;

    // 2. iTunes Search API (returns high-res 600x600 artwork)
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=3`;
      const res = await fetch(itunesUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const item = data.results?.find(r => r.artworkUrl100);
        if (item) {
          const hiResUrl = item.artworkUrl100.replace('100x100bb', '600x600bb');
          const imgRes = await fetch(hiResUrl, { signal: AbortSignal.timeout(6000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf && buf.length > 2000) {
              return { buffer: buf, ext: '.jpg', source: 'itunes' };
            }
          }
        }
      }
    } catch {}

    // 3. Deezer Search API (cover_xl: 1000x1000)
    try {
      const deezerUrl = `https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=3`;
      const res = await fetch(deezerUrl, { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const data = await res.json();
        const item = data.data?.find(r => r.album?.cover_xl || r.album?.cover_big);
        if (item) {
          const coverUrl = item.album.cover_xl || item.album.cover_big;
          const imgRes = await fetch(coverUrl, { signal: AbortSignal.timeout(6000) });
          if (imgRes.ok) {
            const buf = Buffer.from(await imgRes.arrayBuffer());
            if (buf && buf.length > 2000) {
              return { buffer: buf, ext: '.jpg', source: 'deezer' };
            }
          }
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Check if a track already has a valid thumbnail file
 */
export function hasValidThumbnail(track) {
  if (!track || !track.thumbnail_path) return false;
  const thumbPath = path.join(config.THUMBS_DIR, track.thumbnail_path);
  return fs.existsSync(thumbPath);
}

/**
 * Check if a track already has a valid .lrc file in media folder
 */
export function hasValidLrcFile(track) {
  if (!track) return false;
  const trackExt = path.extname(track.file_path || '');
  const baseName = track.file_path ? path.basename(track.file_path, trackExt) : '';
  const candidates = [
    path.join(config.MEDIA_DIR, `${track.id}.lrc`),
    baseName ? path.join(config.MEDIA_DIR, `${baseName}.lrc`) : '',
    track.file_path ? path.join(config.MEDIA_DIR, track.file_path.replace(trackExt, '.lrc')) : '',
    path.join(config.MEDIA_DIR, `${track.title} - ${track.artist}.lrc`),
    path.join(config.MEDIA_DIR, `${track.artist} - ${track.title}.lrc`)
  ].filter(Boolean);

  return candidates.some(p => fs.existsSync(p));
}

/**
 * Automatically enrich missing thumbnail and/or lyrics for a single track
 */
export async function enrichTrack(track) {
  if (!track || !track.id) return { enrichedThumb: false, enrichedLyrics: false };

  let enrichedThumb = false;
  let enrichedLyrics = false;

  const fullMediaFilePath = track.file_path ? path.join(config.MEDIA_DIR, track.file_path) : null;
  const mediaFileExists = fullMediaFilePath && fs.existsSync(fullMediaFilePath);

  // Extract YouTube ID from source_url or track id
  let ytId = '';
  if (track.source_url) {
    const match = track.source_url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (match) ytId = match[1];
  }
  if (!ytId && track.id.startsWith('yt_')) {
    ytId = track.id.split('_')[1];
  }

  // 1. Enrich Thumbnail if missing
  if (!hasValidThumbnail(track)) {
    let savedThumbName = null;

    // A. Check embedded artwork if audio file exists
    if (mediaFileExists && track.media_type !== 'video') {
      try {
        const meta = await extractMetadata(fullMediaFilePath);
        if (meta.hasCover && meta.thumbnailFile) {
          savedThumbName = meta.thumbnailFile;
        }
      } catch {}
    }

    // B. If video, generate snapshot frame
    if (!savedThumbName && mediaFileExists && track.media_type === 'video') {
      try {
        const vThumbName = `thumb_${track.id}.jpg`;
        const vThumbPath = path.join(config.THUMBS_DIR, vThumbName);
        await generateVideoThumbnail(fullMediaFilePath, vThumbPath, track.duration_sec || 10);
        savedThumbName = vThumbName;
      } catch {}
    }

    // C. Try fetching online artwork from YouTube, iTunes or Deezer
    if (!savedThumbName) {
      try {
        const artwork = await fetchOnlineArtwork(track.title, track.artist, ytId);
        if (artwork && artwork.buffer) {
          const tName = `thumb_${track.id}${artwork.ext || '.jpg'}`;
          const tPath = path.join(config.THUMBS_DIR, tName);
          fs.writeFileSync(tPath, artwork.buffer);
          savedThumbName = tName;
        }
      } catch (err) {
        console.warn(`[Enricher] Failed to fetch online artwork for ${track.title}:`, err.message);
      }
    }

    if (savedThumbName) {
      db.prepare('UPDATE tracks SET thumbnail_path = ? WHERE id = ?').run(savedThumbName, track.id);
      enrichedThumb = true;
    }
  }

  // 2. Enrich Lyrics if missing
  if (!hasValidLrcFile(track)) {
    try {
      const lyricsRes = await getLyrics({
        trackId: track.id,
        youtubeId: ytId,
        title: track.title,
        artist: track.artist,
        duration: track.duration_sec
      });

      if (lyricsRes && lyricsRes.success && (lyricsRes.hasSynced || lyricsRes.plainLyrics)) {
        enrichedLyrics = true;
      }
    } catch (err) {
      console.warn(`[Enricher] Failed to fetch lyrics for ${track.title}:`, err.message);
    }
  }

  return { trackId: track.id, enrichedThumb, enrichedLyrics };
}

/**
 * Scan entire user library and enrich all tracks missing thumbnail or lyrics
 */
export async function enrichLibrary(userId = null) {
  let query = 'SELECT * FROM tracks';
  const params = [];
  if (userId && userId !== 'all') {
    query += ' WHERE user_id = ?';
    params.push(userId);
  }

  const tracks = db.prepare(query).all(...params);
  let thumbFixed = 0;
  let lyricsFixed = 0;
  const processed = [];

  for (const t of tracks) {
    const isMissingThumb = !hasValidThumbnail(t);
    const isMissingLyrics = !hasValidLrcFile(t);

    if (isMissingThumb || isMissingLyrics) {
      const res = await enrichTrack(t);
      if (res.enrichedThumb) thumbFixed++;
      if (res.enrichedLyrics) lyricsFixed++;
      processed.push({ id: t.id, title: t.title, ...res });
    }
  }

  return {
    totalTracks: tracks.length,
    scannedTracks: processed.length,
    thumbFixed,
    lyricsFixed,
    details: processed
  };
}
