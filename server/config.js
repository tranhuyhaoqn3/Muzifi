import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const DATA_DIR = path.resolve(ROOT_DIR, process.env.DATA_DIR || 'data');
const MEDIA_DIR = path.resolve(DATA_DIR, 'media');
const THUMBS_DIR = path.resolve(DATA_DIR, 'thumbs');
const TMP_DIR = path.resolve(DATA_DIR, 'tmp');
const CACHE_DIR = path.resolve(DATA_DIR, 'cache');
const DB_PATH = path.resolve(DATA_DIR, 'app.db');

// Ensure directories exist
for (const dir of [DATA_DIR, MEDIA_DIR, THUMBS_DIR, TMP_DIR, CACHE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Redirect process TEMP/TMP to data/tmp on E: drive
process.env.TEMP = TMP_DIR;
process.env.TMP = TMP_DIR;

export const config = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR,
  MEDIA_DIR,
  THUMBS_DIR,
  TMP_DIR,
  CACHE_DIR,
  DB_PATH,
  ROOT_DIR,
  PASSWORD: process.env.APP_PASSWORD || 'admin123',
  DISABLE_AUTH: process.env.DISABLE_AUTH !== 'false',
  SESSION_SECRET: process.env.SESSION_SECRET || 'secret-salt-for-streaming-key-90days',
  COOKIE_NAME: 'music_token',
  COOKIE_MAX_AGE_DAYS: 90,
  FFMPEG_PATH: process.env.FFMPEG_PATH || 'ffmpeg',
  FFPROBE_PATH: process.env.FFPROBE_PATH || 'ffprobe',
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || '',
  MAX_UPLOAD_SIZE: 2 * 1024 * 1024 * 1024, // 2 GB
};
