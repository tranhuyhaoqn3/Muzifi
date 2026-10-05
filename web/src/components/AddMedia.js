import { api } from '../api.js';
import { icons } from './icons.js';
import { animateFlyToCorner } from './flyAnim.js';

export class AddMediaModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.getElementById('modal-container');
    this.activeTab = 'upload'; // 'upload' | 'youtube'
    this.currentXhr = null;
    this.ytPrefetchedInfo = null;
  }

  show() {
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay" id="add-media-overlay">
        <div class="modal-card" style="max-width:540px;">
          <div class="modal-header">
            <div style="display:flex;gap:8px;">
              <button class="pill-btn ${this.activeTab === 'upload' ? 'active' : ''}" id="tab-upload">
                Tải lên từ máy
              </button>
              <button class="pill-btn ${this.activeTab === 'youtube' ? 'active' : ''}" id="tab-youtube">
                Tải từ liên kết
              </button>
            </div>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>

          <div class="modal-body" id="add-media-body">
            ${this.activeTab === 'upload' ? this.renderUploadTab() : this.renderYouTubeTab()}
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('add-media-overlay');
    overlay.querySelector('#modal-close').addEventListener('click', () => overlay.remove());

    overlay.querySelector('#tab-upload').addEventListener('click', () => {
      this.activeTab = 'upload';
      this.render();
    });

    overlay.querySelector('#tab-youtube').addEventListener('click', () => {
      this.activeTab = 'youtube';
      this.render();
    });

    if (this.activeTab === 'upload') {
      this.bindUploadEvents();
    } else {
      this.bindYouTubeEvents();
    }
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
          <p style="font-weight:600;font-size:1rem;margin-bottom:6px;">Chạm hoặc kéo thả file vào đây</p>
          <p style="font-size:0.8rem;color:var(--text-muted);">
            Hỗ trợ Audio (.mp3, .m4a, .aac, .flac, .wav...) & Video (.mp4, .mov, .mkv, .webm...). 
            Định dạng lạ sẽ tự chuyển đổi sang chuẩn iOS.
          </p>
          <input type="file" id="file-input" multiple accept="audio/*,video/*,.mkv,.webm,.flac,.ogg,.opus,.wma" style="display:none;">
        </div>

        <div id="selected-files-list" style="margin-top:16px;max-height:180px;overflow-y:auto;display:none;flex-direction:column;gap:6px;"></div>

        <!-- Progress Bar -->
        <div id="upload-progress-box" style="margin-top:16px;display:none;">
          <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
            <span id="upload-status-text">Đang tải lên...</span>
            <span id="upload-percent-text">0%</span>
          </div>
          <div style="height:8px;background:var(--border-subtle);border-radius:4px;overflow:hidden;">
            <div id="upload-bar-fill" style="height:100%;width:0%;background:var(--accent-gradient);transition:width 0.15s ease;"></div>
          </div>
        </div>

        <div style="margin-top:20px;display:flex;justify-content:flex-end;gap:12px;">
          <button class="pill-btn" id="btn-cancel-upload" style="display:none;">Hủy tải</button>
          <button class="btn-primary" id="btn-start-upload" disabled>Tải lên</button>
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
      startBtn.textContent = `Tải lên ${files.length} file`;

      filesList.innerHTML = files.map((f, i) => `
        <div style="display:flex;justify-content:space-between;padding:6px 12px;background:var(--bg-surface);border-radius:var(--radius-sm);font-size:0.85rem;">
          <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px;">${f.name}</span>
          <span style="color:var(--text-muted);">${(f.size / (1024 * 1024)).toFixed(1)} MB</span>
        </div>
      `).join('');
    };

    startBtn.addEventListener('click', async () => {
      if (filesToUpload.length === 0) return;

      const formData = new FormData();
      for (const file of filesToUpload) {
        formData.append('files', file);
      }

      startBtn.disabled = true;
      cancelBtn.style.display = 'inline-flex';
      progressBox.style.display = 'block';

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
          document.getElementById('add-media-overlay').remove();
          if (this.onSuccess) this.onSuccess();
        }, 800);
      } catch (err) {
        statusText.textContent = 'Lỗi: ' + err.message;
        startBtn.disabled = false;
        cancelBtn.style.display = 'none';
      }
    });
  }

  renderYouTubeTab() {
    return `
      <div class="youtube-zone">
        <div class="form-group">
          <label class="form-label">Dán liên kết trực tuyến (Video, Danh sách phát, Âm nhạc)</label>
          <div style="display:flex;gap:8px;">
            <input type="url" id="yt-url-input" class="form-input" placeholder="https://..." autofocus>
            <button class="btn-primary" id="btn-yt-check" style="flex-shrink:0;">Kiểm tra</button>
          </div>
        </div>

        <div id="yt-preview-area" style="display:none;margin-top:16px;"></div>

        <div id="yt-options-area" style="display:none;margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:16px;">
          <div id="yt-playlist-extra" style="display:none;">
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="yt-create-playlist-cb" checked>
                <span>Tạo playlist tương ứng trong app</span>
              </label>
            </div>
            <div class="form-group" id="yt-playlist-name-group">
              <label class="form-label">Tên playlist</label>
              <input type="text" id="yt-playlist-name" class="form-input" value="">
            </div>
          </div>

          <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <button class="btn-primary" id="btn-yt-download">Tải audio (m4a)</button>
          </div>
        </div>
      </div>
    `;
  }

  bindYouTubeEvents() {
    const checkBtn = document.getElementById('btn-yt-check');
    const urlInput = document.getElementById('yt-url-input');
    const previewArea = document.getElementById('yt-preview-area');
    const optionsArea = document.getElementById('yt-options-area');
    const playlistExtra = document.getElementById('yt-playlist-extra');
    const plNameInput = document.getElementById('yt-playlist-name');
    const downloadBtn = document.getElementById('btn-yt-download');

    checkBtn.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return alert('Vui lòng dán đường link YouTube');

      checkBtn.disabled = true;
      checkBtn.textContent = 'Đang kiểm tra...';
      previewArea.style.display = 'block';
      previewArea.innerHTML = `<div class="empty-state">Đang lấy thông tin từ YouTube qua yt-dlp...</div>`;
      optionsArea.style.display = 'none';

      try {
        const info = await api.youtube.info(url);
        this.ytPrefetchedInfo = info;
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';

        if (info.isPlaylist) {
          playlistExtra.style.display = 'block';
          plNameInput.value = info.title || 'YouTube Playlist';

          previewArea.innerHTML = `
            <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <h4 style="font-weight:700;margin-bottom:4px;">${info.title}</h4>
              <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">Playlist gồm ${info.count} bài • Kênh: ${info.channel}</p>
              <div style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;">
                ${(info.items || []).map((it, idx) => `
                  <div style="font-size:0.8rem;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${idx + 1}. ${it.title}
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        } else {
          playlistExtra.style.display = 'none';
          previewArea.innerHTML = `
            <div style="display:flex;gap:12px;background:var(--bg-surface);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <img src="${info.thumbnail}" alt="" style="width:90px;height:60px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;">
              <div style="min-width:0;">
                <h4 style="font-size:0.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${info.title}</h4>
                <p style="font-size:0.8rem;color:var(--text-muted);">${info.channel} • ${Math.round(info.duration / 60)} phút</p>
              </div>
            </div>
          `;
        }

        optionsArea.style.display = 'block';
      } catch (err) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';
        previewArea.innerHTML = `<div class="empty-state" style="color:#fb7185;">Lỗi: ${err.message}</div>`;
      }
    });

    downloadBtn.addEventListener('click', async () => {
      if (!this.ytPrefetchedInfo) return;

      animateFlyToCorner(downloadBtn, this.ytPrefetchedInfo);

      const mediaType = 'audio';
      const quality = '720p';
      const url = urlInput.value.trim();

      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Đang xếp hàng...';

      try {
        if (this.ytPrefetchedInfo.isPlaylist) {
          const createPlaylist = document.getElementById('yt-create-playlist-cb').checked;
          const playlistName = plNameInput.value.trim();
          await api.youtube.download({
            url,
            mediaType,
            quality,
            items: this.ytPrefetchedInfo.items,
            createPlaylist,
            playlistName
          });
        } else {
          await api.youtube.download({ url, mediaType, quality });
        }

        document.getElementById('add-media-overlay').remove();
        alert('Đã thêm tác vụ tải vào hàng đợi! Bạn có thể theo dõi tiến trình ở biểu tượng Tác vụ trên thanh tiêu đề.');
        if (this.onSuccess) this.onSuccess();
      } catch (err) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Bắt đầu tải';
        alert('Lỗi tạo tác vụ: ' + err.message);
      }
    });
  }
}
