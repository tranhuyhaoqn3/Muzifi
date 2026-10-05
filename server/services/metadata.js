import * as mm from 'music-metadata';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config.js';

export async function extractMetadata(filePath, originalFilename = '') {
  const fallbackTitle = path.basename(originalFilename || filePath, path.extname(originalFilename || filePath));
  
  let metadata = {
    title: fallbackTitle,
    artist: 'Unknown Artist',
    album: '',
    durationSec: 0,
    hasCover: false,
    thumbnailFile: null,
  };

  try {
    const parsed = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const common = parsed.common || {};
    const format = parsed.format || {};

    if (common.title && common.title.trim()) {
      metadata.title = common.title.trim();
    }
    if (common.artist && common.artist.trim()) {
      metadata.artist = common.artist.trim();
    }
    if (common.album && common.album.trim()) {
      metadata.album = common.album.trim();
    }
    if (format.duration) {
      metadata.durationSec = Math.round(format.duration * 100) / 100;
    }

    // Check for cover image
    const picture = common.picture?.[0] || mm.selectCover(common.picture);
    if (picture && picture.data && picture.data.length > 0) {
      const ext = picture.format === 'image/png' ? '.png' : '.jpg';
      const thumbFilename = `thumb_${crypto.randomUUID()}${ext}`;
      const thumbPath = path.join(config.THUMBS_DIR, thumbFilename);
      fs.writeFileSync(thumbPath, picture.data);
      metadata.hasCover = true;
      metadata.thumbnailFile = thumbFilename;
    }
  } catch (err) {
    // If music-metadata fails (e.g. for some video or unusual files), fallback gracefully
    console.warn(`music-metadata parsing notice for ${filePath}: ${err.message}`);
  }

  return metadata;
}
