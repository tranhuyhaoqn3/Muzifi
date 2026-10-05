import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';

export class JobsModal {
  constructor(onClose) {
    this.onClose = onClose;
    this.container = document.getElementById('modal-container');
    this.unsubscribe = null;
    this.storagePollTimer = null;
  }

  show() {
    this.render();
    this.unsubscribe = store.subscribe(() => this.updateList());
    this.loadStorage();
    this.storagePollTimer = setInterval(() => this.loadStorage(), 10000);
  }

  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      const gb = mb / 1024;
      return `${gb.toFixed(2)} GB (${Math.round(mb)} MB)`;
    }
    return `${mb.toFixed(1)} MB`;
  }

  async loadStorage() {
    try {
      const stats = await api.system.storage();
      const valEl = document.getElementById('jobs-storage-val');
      if (valEl && stats) {
        valEl.textContent = this.formatBytes(stats.totalUsedBytes || stats.mediaBytes);
      }
    } catch (e) {
      // ignore
    }
  }

  shortenTitle(title, maxLen = 32) {
    if (!title) return '';
    let cleaned = String(title)
      .replace(/\[(?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio|Lyric\s*Video)\]/gi, '')
      .replace(/\((?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio|Lyric\s*Video)\)/gi, '')
      .replace(/\|\s*(?:Official\s*)?(?:Music\s*)?(?:Video|MV|Audio).*/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (cleaned.length <= maxLen) return cleaned;
    return cleaned.slice(0, maxLen).trim() + '…';
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay" id="jobs-overlay">
        <div class="modal-card" style="max-width:440px;width:92%;">
          <div class="modal-header" style="padding:12px 14px 8px;">
            <div style="display:flex;align-items:center;gap:6px;">
              <h3 class="modal-title" style="font-size:1rem;margin:0;">Tác vụ chuyển đổi</h3>
              <span id="jobs-count-badge" class="badge" style="position:static;font-size:0.7rem;padding:2px 7px;">0</span>
            </div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="pill-btn" id="btn-clear-completed" style="font-size:0.7rem;padding:2px 8px;min-height:24px;">Xóa đã xong</button>
              <button class="icon-btn" id="modal-close" style="width:28px;height:28px;padding:4px;">${icons.x}</button>
            </div>
          </div>

          <!-- Storage Used Bar -->
          <div style="padding:0 14px 8px;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:5px 10px;background:rgba(255,255,255,0.04);border-radius:6px;border:1px solid var(--border-subtle);font-size:0.74rem;">
              <div style="display:flex;align-items:center;gap:5px;color:var(--text-muted);">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                </svg>
                <span>Đã dùng:</span>
              </div>
              <span id="jobs-storage-val" style="font-weight:600;color:var(--text-primary);letter-spacing:0.2px;">Đang tải...</span>
            </div>
          </div>

          <div class="modal-body" id="jobs-list" style="display:flex;flex-direction:column;gap:6px;max-height:55vh;padding:4px 14px 14px;overflow-y:auto;">
            <div class="empty-state" style="padding:20px 10px;font-size:0.85rem;">Đang tải danh sách tác vụ...</div>
          </div>
        </div>
      </div>
    `;

    const overlay = document.getElementById('jobs-overlay');
    overlay.querySelector('#modal-close').addEventListener('click', () => {
      this.close(overlay);
    });

    overlay.querySelector('#btn-clear-completed').addEventListener('click', async () => {
      try {
        await api.jobs.clearCompleted();
        const updated = await api.jobs.list();
        store.setJobs(updated);
        this.loadStorage();
      } catch (e) {
        console.error(e);
      }
    });

    this.updateList();
  }

  close(overlay) {
    if (this.unsubscribe) this.unsubscribe();
    if (this.storagePollTimer) clearInterval(this.storagePollTimer);
    overlay.remove();
    if (this.onClose) this.onClose();
  }

  updateList() {
    const listEl = document.getElementById('jobs-list');
    const badgeEl = document.getElementById('jobs-count-badge');
    if (!listEl) return;

    const jobs = store.get().jobs || [];
    const activeJobs = jobs.filter(j => j.status === 'downloading' || j.status === 'processing' || j.deviceSaving);
    const activeCount = activeJobs.length + jobs.filter(j => j.status === 'queued').length;
    if (badgeEl) badgeEl.textContent = activeCount;

    if (jobs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:20px 10px;">
          <p class="empty-title" style="font-size:0.9rem;margin-bottom:4px;">Không có tác vụ nào</p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin:0;">Các tệp tải hoặc chuyển đổi sẽ hiển thị tại đây.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = jobs.map(job => {
      const isSavingToDevice = job.deviceSaving || false;
      const isRunning = (job.status === 'downloading' || job.status === 'processing' || isSavingToDevice);
      const isQueued = job.status === 'queued';
      const isError = job.status === 'error';
      const isDone = job.status === 'done' && !isSavingToDevice;
      const isCanceled = job.status === 'canceled';

      let statusBadge = '';
      if (isSavingToDevice) {
        const mbInfo = (job.deviceLoadedMb && job.deviceTotalMb) ? ` ${job.deviceLoadedMb}/${job.deviceTotalMb}MB` : '';
        const pct = job.deviceProgress ? ` (${job.deviceProgress}%)` : '';
        statusBadge = `<span style="color:#f59e0b;font-weight:600;display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#f59e0b;"></span>Lưu máy${mbInfo}${pct}</span>`;
      }
      else if (isRunning) statusBadge = `<span style="color:#60a5fa;font-weight:600;">${job.status === 'downloading' ? 'Tải' : 'Xử lý'} ${Math.round(job.progress || 0)}%</span>`;
      else if (isQueued) statusBadge = `<span style="color:var(--text-muted);">Xếp hàng</span>`;
      else if (isDone) statusBadge = `<span style="color:#34d399;font-weight:600;display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#34d399;"></span>Sẵn sàng</span>`;
      else if (isError) statusBadge = `<span style="color:#f87171;font-weight:600;">Lỗi</span>`;
      else if (isCanceled) statusBadge = `<span style="color:var(--text-muted);">Hủy</span>`;

      let extra = {};
      try {
        if (typeof job.extra === 'string') extra = JSON.parse(job.extra);
        else if (typeof job.extra === 'object' && job.extra) extra = job.extra;
      } catch (e) {}

      const rawTitle = extra?.title || job.title || (job.kind === 'youtube' ? 'Trực tuyến' : 'Chuyển đổi') + ' - ' + (job.url || job.track_id || 'Media');
      const shortTitle = this.shortenTitle(rawTitle, 30);
      const displayArtist = extra?.artist ? this.shortenTitle(extra.artist, 18) : '';

      return `
        <div style="background:var(--bg-surface);padding:7px 10px;border-radius:8px;border:1px solid var(--border-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <div style="min-width:0;flex:1;">
              <div style="font-size:0.83rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;" title="${this.escapeHtml(rawTitle)}">
                ${this.escapeHtml(shortTitle)}
              </div>
              <div style="font-size:0.72rem;color:var(--text-muted);display:flex;align-items:center;gap:5px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${displayArtist ? `<span>${this.escapeHtml(displayArtist)}</span><span>•</span>` : ''}
                <span>${job.media_type === 'video' ? 'Video' : 'Audio'}</span>
                <span>•</span>
                ${statusBadge}
                ${job.speed ? `<span>• ${job.speed}</span>` : ''}
              </div>
            </div>

            <div style="display:flex;gap:4px;flex-shrink:0;">
              ${isRunning || isQueued ? `
                <button class="pill-btn job-cancel-btn" data-id="${job.id}" style="min-height:24px;padding:1px 8px;font-size:0.7rem;">Hủy</button>
              ` : ''}
              ${isError ? `
                <button class="pill-btn job-retry-btn" data-id="${job.id}" style="min-height:24px;padding:1px 8px;font-size:0.7rem;">Thử lại</button>
              ` : ''}
            </div>
          </div>

          ${isRunning ? `
            <div style="height:3px;background:var(--border-subtle);border-radius:2px;overflow:hidden;margin-top:5px;">
              <div style="height:100%;width:${isSavingToDevice ? (job.deviceProgress || 10) : (job.progress || 0)}%;background:${isSavingToDevice ? 'linear-gradient(90deg, #f59e0b, #10b981)' : 'var(--accent-gradient)'};transition:width 0.15s ease;"></div>
            </div>
          ` : ''}

          ${isError && job.error ? `
            <div style="font-size:0.7rem;color:#f87171;margin-top:4px;background:rgba(244,63,94,0.08);padding:3px 6px;border-radius:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(job.error)}">
              ${this.escapeHtml(job.error)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.job-cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.jobs.cancel(btn.dataset.id);
        } catch (e) {
          console.error(e);
        }
      });
    });

    listEl.querySelectorAll('.job-retry-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.jobs.retry(btn.dataset.id);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
