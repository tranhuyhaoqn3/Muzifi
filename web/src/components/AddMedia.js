import { api } from '../api.js';
import { icons } from './icons.js';
import { animateFlyToCorner } from './flyAnim.js';
import { saveLocalTrackDirect } from '../offlineStorage.js';

export class AddMediaModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.getElementById('modal-container');
  }

  show() {
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay" id="add-media-overlay">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <h3 class="modal-title">Thêm bài hát vào máy</h3>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>

          <div class="modal-body" id="add-media-body">
            ${this.renderUploadTab()}
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('add-media-overlay');
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());
    this.bindUploadEvents();
  }

  renderUploadTab() {
    return `
      <div class="upload-zone">
        <div id="drop-area" style="border:2px dashed var(--border-subtle);border-radius:var(--radius-lg);padding:32px 16px;text-align:center;cursor:pointer;background:var(--bg-surface);transition:all 0.2s ease;">
          <div style="color:var(--accent-primary);margin-bottom:12px;">
            <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p style="font-weight:600;font-size:1rem;margin-bottom:6px;">Chạm để chọn file từ điện thoại</p>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Hỗ trợ Audio (.mp3, .m4a, .aac, .flac, .wav...) & Video (.mp4, .mov, .mkv, .webm...). 
            Lưu trực tiếp vào bộ nhớ máy, phát offline mọi lúc không cần mạng.
          </p>
          <input type="file" id="file-input" multiple accept="audio/*,video/*,.mkv,.webm,.flac,.ogg,.opus,.wma" style="display:none;">
        </div>

        <div id="selected-files-list" style="margin-top:16px;max-height:180px;overflow-y:auto;display:none;flex-direction:column;gap:6px;"></div>

        <!-- Progress Bar -->
        <div id="upload-progress-box" style="margin-top:16px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span id="upload-status-text">Đang lưu vào máy...</span>
            <span id="upload-percent-text">0%</span>
          </div>
          <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
            <div id="upload-bar-fill" style="height:100%;width:0%;background:var(--accent-gradient);transition:width 0.15s ease;"></div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px;">
          <button class="pill-btn" id="btn-cancel-upload" style="display:none;">Hủy</button>
          <button class="btn-primary" id="btn-start-upload" disabled>Thêm vào máy</button>
        </div>
      </div>
    `;
  }

  bindUploadEvents() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const filesList = document.getElementById('selected-files-list');
    const startBtn = document.getElementById('btn-start-upload');
    const cancelBtn = document.getElementById('btn-cancel-upload');
    const progressBox = document.getElementById('upload-progress-box');
    const barFill = document.getElementById('upload-bar-fill');
    const percentText = document.getElementById('upload-percent-text');
    const statusText = document.getElementById('upload-status-text');

    let filesToUpload = [];

    dropArea.addEventListener('click', () => fileInput.click());

    dropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--accent-primary)';
    });

    dropArea.addEventListener('dragleave', () => {
      dropArea.style.borderColor = 'var(--border-subtle)';
    });

    dropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      dropArea.style.borderColor = 'var(--border-subtle)';
      if (e.dataTransfer.files) {
        handleFiles(Array.from(e.dataTransfer.files));
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files) {
        handleFiles(Array.from(fileInput.files));
      }
    });

    const handleFiles = (files) => {
      filesToUpload = files;
      if (files.length === 0) {
        filesList.style.display = 'none';
        startBtn.disabled = true;
        return;
      }

      filesList.style.display = 'flex';
      startBtn.disabled = false;
      startBtn.textContent = `Thêm ${files.length} file vào máy`;

      filesList.innerHTML = files.map((f, i) => `
        <div style="display:flex;justify-content:space-between;padding:6px 12px;background:var(--bg-surface);border-radius:var(--radius-sm);font-size:0.85rem;">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">${f.name}</span>
          <span style="color:var(--text-muted);">${(f.size / (1024 * 1024)).toFixed(1)} MB</span>
        </div>
      `).join('');
    };

    startBtn.addEventListener('click', async () => {
      if (filesToUpload.length === 0) return;

      const isStandalone = Boolean(
        window.Capacitor ||
        !navigator.onLine ||
        localStorage.getItem('muzifi_standalone_mode') === 'true'
      );

      startBtn.disabled = true;
      progressBox.style.display = 'block';

      // 1. If in Standalone/iOS app or offline: save directly to IndexedDB!
      if (isStandalone) {
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          const pct = Math.round(((i + 1) / filesToUpload.length) * 100);
          barFill.style.width = `${pct}%`;
          percentText.textContent = `${pct}%`;
          statusText.textContent = `Đang lưu (${i + 1}/${filesToUpload.length}) ${file.name}...`;

          const trackId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const mime = file.type || (file.name.endsWith('.mp4') ? 'video/mp4' : 'audio/mp4');

          let duration = 0;
          try {
            const tempMedia = document.createElement(mime.startsWith('video') ? 'video' : 'audio');
            const url = URL.createObjectURL(file);
            tempMedia.src = url;
            await new Promise((res) => {
              tempMedia.onloadedmetadata = () => {
                duration = Math.round(tempMedia.duration || 0);
                URL.revokeObjectURL(url);
                res();
              };
              tempMedia.onerror = () => {
                URL.revokeObjectURL(url);
                res();
              };
              setTimeout(() => { URL.revokeObjectURL(url); res(); }, 800);
            });
          } catch (e) {}

          const record = {
            id: trackId,
            title: cleanName,
            artist: 'Thiết bị',
            album: 'Bộ nhớ máy',
            media_type: mime.startsWith('video') ? 'video' : 'audio',
            mime: mime,
            blob: file,
            size: file.size,
            duration_sec: duration,
            savedAt: Date.now()
          };

          await saveLocalTrackDirect(record);
        }

        statusText.textContent = 'Đã lưu xong!';
        setTimeout(() => {
          document.getElementById('add-media-overlay')?.remove();
          if (this.onSuccess) this.onSuccess();
          window.player?.showToast(`Đã thêm ${filesToUpload.length} bài hát vào máy`);
        }, 500);
        return;
      }

      // 2. Otherwise try server upload, with local fallback if server is unreachable
      const formData = new FormData();
      for (const file of filesToUpload) {
        formData.append('files', file);
      }

      try {
        statusText.textContent = `Đang tải lên ${filesToUpload.length} file...`;
        await api.tracks.upload(formData, (percent) => {
          barFill.style.width = `${percent}%`;
          percentText.textContent = `${percent}%`;
          if (percent >= 100) {
            statusText.textContent = 'Đang xử lý & phân loại định dạng...';
          }
        });

        statusText.textContent = 'Hoàn tất!';
        setTimeout(() => {
          document.getElementById('add-media-overlay')?.remove();
          if (this.onSuccess) this.onSuccess();
        }, 800);
      } catch (err) {
        // Fallback: save to local IndexedDB
        statusText.textContent = 'Đang lưu ngoại tuyến vào máy...';
        for (const file of filesToUpload) {
          const trackId = `local_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          const cleanName = file.name.replace(/\.[^/.]+$/, '');
          const mime = file.type || (file.name.endsWith('.mp4') ? 'video/mp4' : 'audio/mp4');
          await saveLocalTrackDirect({
            id: trackId,
            title: cleanName,
            artist: 'Thiết bị',
            album: 'Bộ nhớ máy',
            media_type: mime.startsWith('video') ? 'video' : 'audio',
            mime: mime,
            blob: file,
            size: file.size,
            duration_sec: 0,
            savedAt: Date.now()
          });
        }
        setTimeout(() => {
          document.getElementById('add-media-overlay')?.remove();
          if (this.onSuccess) this.onSuccess();
          window.player?.showToast(`Đã lưu ${filesToUpload.length} bài hát vào máy`);
        }, 500);
      }
    });
  }
}
