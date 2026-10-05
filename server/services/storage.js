import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

function getDirSize(dirPath) {
  let total = 0;
  if (!fs.existsSync(dirPath)) return total;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        total += getDirSize(fullPath);
      } else if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    } catch (e) {
      // Ignore files removed during scan
    }
  }
  return total;
}

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return (mb / 1024).toFixed(2) + ' GB';
  }
  return mb.toFixed(1) + ' MB';
}

export function getStorageStats() {
  const mediaBytes = getDirSize(config.MEDIA_DIR);
  const thumbsBytes = getDirSize(config.THUMBS_DIR);
  const tmpBytes = getDirSize(config.TMP_DIR);
  const dbBytes = fs.existsSync(config.DB_PATH) ? fs.statSync(config.DB_PATH).size : 0;

  const totalUsedBytes = mediaBytes + thumbsBytes + tmpBytes + dbBytes;

  return {
    mediaBytes,
    thumbsBytes,
    tmpBytes,
    dbBytes,
    totalUsedBytes,
    mediaFormatted: formatBytes(mediaBytes),
    totalFormatted: formatBytes(totalUsedBytes),
  };
}

export function cleanTmpDir() {
  if (!fs.existsSync(config.TMP_DIR)) return;
  const files = fs.readdirSync(config.TMP_DIR);
  const oneHourAgo = Date.now() - 3600 * 1000;
  for (const file of files) {
    try {
      const p = path.join(config.TMP_DIR, file);
      const st = fs.statSync(p);
      if (st.mtimeMs < oneHourAgo) {
        fs.unlinkSync(p);
      }
    } catch (e) {
      // Ignore
    }
  }
}
