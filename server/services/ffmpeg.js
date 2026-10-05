import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { config } from '../config.js';

/**
 * Run ffprobe to get comprehensive media stream & container information
 * @param {string} filePath 
 * @returns {Promise<Object>}
 */
export function probeMedia(filePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const child = spawn(config.FFPROBE_PATH, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}: ${stderr}`));
      }
      try {
        const info = JSON.parse(stdout);
        const format = info.format || {};
        const streams = info.streams || [];
        
        const videoStream = streams.find(s => s.codec_type === 'video' && s.codec_name !== 'png' && s.codec_name !== 'mjpeg');
        const audioStream = streams.find(s => s.codec_type === 'audio');

        const isVideo = Boolean(videoStream);
        const duration = parseFloat(format.duration || (videoStream?.duration) || (audioStream?.duration) || '0');

        resolve({
          isVideo,
          mediaType: isVideo ? 'video' : 'audio',
          durationSec: isNaN(duration) ? 0 : Math.round(duration * 100) / 100,
          videoCodec: videoStream?.codec_name || null,
          audioCodec: audioStream?.codec_name || null,
          width: videoStream?.width || null,
          height: videoStream?.height || null,
          formatName: format.format_name || '',
          size: parseInt(format.size || '0', 10),
          streams,
          format,
        });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err.message}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Generate thumbnail for video
 * Extracts frame at ~10% of duration (or 2 sec)
 */
export function generateVideoThumbnail(videoPath, outThumbPath, durationSec = 10) {
  return new Promise((resolve, reject) => {
    const seek = Math.max(1, Math.min(durationSec * 0.1, 30));
    const args = [
      '-y',
      '-ss', String(seek),
      '-i', videoPath,
      '-vframes', '1',
      '-q:v', '2',
      '-vf', 'scale=min(640\\,iw):-2',
      outThumbPath
    ];

    const child = spawn(config.FFMPEG_PATH, args);
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });

    child.on('close', code => {
      if (code === 0 && fs.existsSync(outThumbPath)) {
        resolve(outThumbPath);
      } else {
        // Fallback: try frame 0 if seek failed
        const fallbackArgs = [
          '-y',
          '-i', videoPath,
          '-vframes', '1',
          '-q:v', '2',
          outThumbPath
        ];
        const fbChild = spawn(config.FFMPEG_PATH, fallbackArgs);
        fbChild.on('close', fbCode => {
          if (fbCode === 0 && fs.existsSync(outThumbPath)) {
            resolve(outThumbPath);
          } else {
            reject(new Error(`Failed to generate video thumbnail: ${stderr}`));
          }
        });
        fbChild.on('error', reject);
      }
    });

    child.on('error', reject);
  });
}

/**
 * Convert audio to iOS-friendly m4a (AAC 192k)
 */
export function convertAudioToM4A(inputPath, outputPath, onProgress, abortSignal) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath
    ];

    const child = spawn(config.FFMPEG_PATH, args);
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        child.kill('SIGKILL');
        reject(new Error('Conversion aborted'));
      });
    }

    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      // parse time=00:01:23.45 if progress tracking needed
      if (onProgress) {
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const currentSec = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3]);
          onProgress({ currentSec });
        }
      }
    });

    child.on('close', code => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg audio conversion failed with code ${code}: ${stderr.slice(-300)}`));
      }
    });

    child.on('error', reject);
  });
}

/**
 * Convert video to iOS-optimized mp4 (H.264 + AAC + faststart)
 */
export function convertVideoToMP4(inputPath, outputPath, durationSec = 0, onProgress, abortSignal) {
  return new Promise((resolve, reject) => {
    const args = [
      '-y',
      '-i', inputPath,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '160k',
      '-movflags', '+faststart',
      outputPath
    ];

    const child = spawn(config.FFMPEG_PATH, args);
    let stderr = '';

    if (abortSignal) {
      abortSignal.addEventListener('abort', () => {
        child.kill('SIGKILL');
        reject(new Error('Conversion aborted'));
      });
    }

    child.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderr += text;
      if (onProgress && durationSec > 0) {
        const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (timeMatch) {
          const currentSec = parseInt(timeMatch[1], 10) * 3600 + parseInt(timeMatch[2], 10) * 60 + parseFloat(timeMatch[3]);
          const percent = Math.min(99, Math.round((currentSec / durationSec) * 100));
          onProgress({ percent, currentSec, durationSec });
        }
      }
    });

    child.on('close', code => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        reject(new Error(`ffmpeg video conversion failed with code ${code}: ${stderr.slice(-300)}`));
      }
    });

    child.on('error', reject);
  });
}
