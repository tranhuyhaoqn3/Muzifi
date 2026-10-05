import { api } from '../api.js';
import { icons } from './icons.js';
import { animateFlyToCorner } from './flyAnim.js';

export class AddMediaModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.getElementById('modal-container');
    this.activeTab = 'upload'; // 'upload' | 'online'
    this.currentXhr = null;
    this.onlinePrefetchedInfo = null;
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
              <button class="pill-btn ${this.activeTab === 'online' ? 'active' : ''}" id="tab-online">
                Tải từ liên kết
              </button>
            </div>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>

          <div class="modal-body" id="add-media-body">
            ${this.activeTab === 'upload' ? this.renderUploadTab() : this.renderOnlineTab()}
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

    overlay.querySelector('#tab-online').addEventListener('click', () => {
      this.activeTab = 'online';
      this.render();
    });

    if (this.activeTab === 'upload') {
      this.bindUploadEvents();
    } else {
      this.bindOnlineEvents();
    }
  }

  renderUploadTab() {
    return `
      <div class="upload-zone" id="drop-zone" style="border:2px dashed var(--border-color);border-radius:var(--radius-lg);padding:32px 16px;text-align:center;cursor:pointer;transition:border-color 0.2s, background-color 0.2s;">
        <input type="file" id="file-input" multiple accept="audio/*,video/*" style="display:none;">
        <div style="display:flex;justify-content:center;margin-bottom:12px;color:var(--accent-primary);">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>
        <p style="font-weight:600;font-size:0.95rem;margin-bottom:4px;">Kéo thả tệp vào đây hoặc nhấn để duyệt</p>
        <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Hỗ trợ MP3, M4A, FLAC, AAC, WAV, MP4, MKV...</p>
      </div>

      <div id="upload-progress-container" style="display:none;margin-top:20px;">
        <div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:6px;">
          <span id="upload-status-text">Đang tải lên...</span>
          <span id="upload-percent-text">0%</span>
        </div>
        <div class="progress-bar-bg" style="height:6px;background:var(--bg-elevated);border-radius:3px;overflow:hidden;">
          <div id="upload-progress-fill" style="width:0%;height:100%;background:var(--accent-primary);transition:width 0.1s linear;"></div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:10px;">
          <button class="pill-btn" id="btn-cancel-upload" style="font-size:0.8rem;padding:4px 12px;">Hủy tải lên</button>
        </div>
      </div>
    `;
  }

  bindUploadEvents() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const percentText = document.getElementById('upload-percent-text');
    const statusText = document.getElementById('upload-status-text');
    const cancelBtn = document.getElementById('btn-cancel-upload');

    dropZone.addEventListener('click', () => fileInput.click());

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--accent-primary)';
      dropZone.style.backgroundColor = 'var(--bg-elevated)';
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.backgroundColor = 'transparent';
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border-color)';
      dropZone.style.backgroundColor = 'transparent';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        this.uploadFiles(e.dataTransfer.files);
      }
    });

    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files.length > 0) {
        this.uploadFiles(fileInput.files);
      }
    });

    cancelBtn.addEventListener('click', () => {
      if (this.currentXhr) {
        this.currentXhr.abort();
        this.currentXhr = null;
      }
      progressContainer.style.display = 'none';
      dropZone.style.display = 'block';
    });
  }

  async uploadFiles(fileList) {
    const dropZone = document.getElementById('drop-zone');
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const percentText = document.getElementById('upload-percent-text');
    const statusText = document.getElementById('upload-status-text');

    dropZone.style.display = 'none';
    progressContainer.style.display = 'block';

    const formData = new FormData();
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files', fileList[i]);
    }

    try {
      statusText.textContent = `Đang tải lên ${fileList.length} tệp...`;
      await api.tracks.upload(formData, (percent) => {
        progressFill.style.width = `${percent}%`;
        percentText.textContent = `${percent}%`;
        if (percent >= 100) {
          statusText.textContent = 'Đang xử lý và trích xuất thẻ metadata...';
        }
      });

      document.getElementById('add-media-overlay').remove();
      if (this.onSuccess) this.onSuccess();
    } catch (err) {
      if (err.message !== 'Upload canceled by user') {
        alert('Lỗi tải lên: ' + err.message);
        dropZone.style.display = 'block';
        progressContainer.style.display = 'none';
      }
    }
  }

  renderOnlineTab() {
    return `
      <div class="online-zone">
        <div class="form-group">
          <label class="form-label">Dán liên kết trực tuyến (Bài hát, Danh sách phát)</label>
          <div style="display:flex;gap:8px;">
            <input type="url" id="online-url-input" class="form-input" placeholder="https://..." autofocus>
            <button class="btn-primary" id="btn-online-check" style="flex-shrink:0;">Kiểm tra</button>
          </div>
        </div>

        <div id="online-preview-area" style="display:none;margin-top:16px;"></div>

        <div id="online-options-area" style="display:none;margin-top:16px;border-top:1px solid var(--border-subtle);padding-top:16px;">
          <div id="online-playlist-extra" style="display:none;">
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
                <input type="checkbox" id="online-create-playlist-cb" checked>
                <span>Tạo playlist tương ứng trong app</span>
              </label>
            </div>
            <div class="form-group" id="online-playlist-name-group">
              <label class="form-label">Tên playlist</label>
              <input type="text" id="online-playlist-name" class="form-input" value="">
            </div>
          </div>

          <div style="margin-top:20px;display:flex;justify-content:flex-end;">
            <button class="btn-primary" id="btn-online-download">Tải audio (HQ)</button>
          </div>
        </div>
      </div>
    `;
  }

  bindOnlineEvents() {
    const checkBtn = document.getElementById('btn-online-check');
    const urlInput = document.getElementById('online-url-input');
    const previewArea = document.getElementById('online-preview-area');
    const optionsArea = document.getElementById('online-options-area');
    const playlistExtra = document.getElementById('online-playlist-extra');
    const plNameInput = document.getElementById('online-playlist-name');
    const downloadBtn = document.getElementById('btn-online-download');

    checkBtn?.addEventListener('click', async () => {
      const url = urlInput.value.trim();
      if (!url) return alert('Vui lòng dán đường link trực tuyến');

      checkBtn.disabled = true;
      checkBtn.textContent = 'Đang kiểm tra...';
      previewArea.style.display = 'block';
      previewArea.innerHTML = `<div class="empty-state">Đang lấy thông tin trực tuyến...</div>`;
      optionsArea.style.display = 'none';

      try {
        const info = await api.online.info(url);
        this.onlinePrefetchedInfo = info;
        checkBtn.disabled = false;
        checkBtn.textContent = 'Kiểm tra';

        if (info.isPlaylist || info.kind === 'playlist') {
          playlistExtra.style.display = 'block';
          plNameInput.value = info.title || 'Danh sách phát';

          previewArea.innerHTML = `
            <div style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <h4 style="font-weight:700;margin-bottom:4px;">${info.title}</h4>
              <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:12px;">Playlist gồm ${(info.items || []).length} bài</p>
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
          const target = info.track || info;
          previewArea.innerHTML = `
            <div style="display:flex;gap:12px;background:var(--bg-surface);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
              <img src="${target.thumbnail || target.thumbnail_url || ''}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:var(--radius-sm);flex-shrink:0;">
              <div style="min-width:0;display:flex;flex-direction:column;justify-content:center;">
                <h4 style="font-size:0.95rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${target.title}</h4>
                <p style="font-size:0.8rem;color:var(--text-muted);margin:4px 0 0;">${target.artist || target.channel || 'Nghệ sĩ'}</p>
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

    downloadBtn?.addEventListener('click', async () => {
      if (!this.onlinePrefetchedInfo) return;

      animateFlyToCorner(downloadBtn, this.onlinePrefetchedInfo);

      const mediaType = 'audio';
      const quality = 'HQ';
      const url = urlInput.value.trim();

      downloadBtn.disabled = true;
      downloadBtn.textContent = 'Đang xếp hàng...';

      try {
        const info = this.onlinePrefetchedInfo;
        if (info.isPlaylist || info.kind === 'playlist') {
          const createPlaylist = document.getElementById('online-create-playlist-cb').checked;
          const playlistName = plNameInput.value.trim();
          await api.online.download({
            url,
            mediaType,
            quality,
            items: info.items,
            createPlaylist,
            playlistName
          });
        } else {
          const target = info.track || info;
          await api.online.download({
            url,
            mediaType,
            quality,
            id: target.id,
            title: target.title,
            artist: target.artist || target.channel,
            thumbnail: target.thumbnail || target.thumbnail_url
          });
        }

        document.getElementById('add-media-overlay').remove();
        alert('Đã thêm tác vụ tải vào hàng đợi! Bạn có thể theo dõi tiến trình ở biểu tượng Tác vụ trên thanh tiêu đề.');
        if (this.onSuccess) this.onSuccess();
      } catch (err) {
        downloadBtn.disabled = false;
        downloadBtn.textContent = 'Tải audio (HQ)';
        alert('Lỗi tạo tác vụ: ' + err.message);
      }
    });
  }
}
