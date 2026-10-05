import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';

export class SettingsView {
  constructor() {
    this.container = document.getElementById('main-view');
    this.unsubscribeJobs = null;
  }

  async render() {
    if (this.unsubscribeJobs) {
      this.unsubscribeJobs();
      this.unsubscribeJobs = null;
    }

    this.container.innerHTML = `
      <div class="settings-view" style="max-width:600px;margin:0 auto;display:flex;flex-direction:column;gap:20px;padding-bottom:calc(var(--nav-height) + var(--mini-player-height) + var(--safe-bottom) + 16px);">
        <h2 style="font-size:1.3rem;font-weight:700;">Cài đặt cá nhân & hệ thống</h2>

        <!-- Google OAuth Credentials Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <h3 style="font-size:1rem;font-weight:600;margin:0;">Đăng nhập Google (OAuth 2.0)</h3>
          </div>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0;line-height:1.4;">
            Cấu hình Client ID và Secret từ <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:var(--accent-primary);text-decoration:underline;">Google Cloud Console</a> để cho phép người dùng đăng nhập tài khoản Google.
          </p>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Google Client ID</label>
            <input type="text" id="setting-google-client-id" class="form-input" placeholder="Ví dụ: 123456789-xxxx.apps.googleusercontent.com">
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Google Client Secret</label>
            <input type="password" id="setting-google-client-secret" class="form-input" placeholder="Ví dụ: GOCSPX-xxxx...">
          </div>

          <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.4;background:var(--bg-elevated);padding:8px 10px;border-radius:var(--radius-sm);border:1px solid var(--border-subtle);">
            <strong>Authorized redirect URI cần thêm vào Google Console:</strong><br>
            <code id="google-redirect-uri-display" style="color:var(--accent-primary);font-family:monospace;word-break:break-all;"></code>
          </div>
        </div>

        <!-- Tác vụ tải & chuyển đổi Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div style="display:flex;align-items:center;gap:8px;">
              <h3 style="font-size:1rem;font-weight:600;margin:0;display:flex;align-items:center;gap:6px;">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 4 23 10 17 10" />
                  <polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Tác vụ tải & chuyển đổi
              </h3>
              <span id="settings-jobs-count-badge" class="badge" style="position:static;font-size:0.75rem;">0</span>
            </div>
            <button class="pill-btn" id="btn-settings-clear-jobs" style="font-size:0.75rem;padding:4px 10px;">Xóa đã xong</button>
          </div>

          <div id="settings-jobs-list" style="display:flex;flex-direction:column;gap:10px;max-height:360px;overflow-y:auto;padding-right:2px;">
            <div class="empty-state" style="padding:16px;">
              <p style="color:var(--text-muted);font-size:0.85rem;">Đang tải danh sách tác vụ...</p>
            </div>
          </div>
        </div>

        <!-- Storage Card -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);">
          <h3 style="font-size:1rem;font-weight:600;margin-bottom:12px;">Dung lượng lưu trữ</h3>
          <div id="storage-stats-content">
            <p style="color:var(--text-muted);font-size:0.85rem;">Đang kiểm tra dung lượng...</p>
          </div>
        </div>

        <!-- Media & Conversion Policies -->
        <div style="background:var(--bg-surface);padding:16px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:16px;">
          <h3 style="font-size:1rem;font-weight:600;">Tùy chọn đa phương tiện</h3>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Xử lý định dạng lạ (mkv, webm, avi, flac...)</label>
            <select id="setting-policy" class="form-select">
              <option value="convert">Tự động chuyển đổi sang chuẩn iOS (Khuyên dùng)</option>
              <option value="reject">Từ chối và báo lỗi</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Bước tua nhanh / lùi (giây)</label>
            <select id="setting-seek-step" class="form-select">
              <option value="5">5 giây</option>
              <option value="10">10 giây (Mặc định)</option>
              <option value="15">15 giây</option>
              <option value="30">30 giây</option>
            </select>
          </div>

          <div class="form-group" style="margin:0;">
            <label class="form-label">Số tác vụ tải/chuyển đổi đồng thời</label>
            <select id="setting-concurrent-jobs" class="form-select">
              <option value="1">1 tác vụ (Thích hợp cho máy yếu / Pi)</option>
              <option value="2">2 tác vụ (Mặc định)</option>
              <option value="3">3 tác vụ</option>
            </select>
          </div>

          <button id="btn-save-settings" class="btn-primary" style="align-self:flex-end;">Lưu cài đặt</button>
        </div>
      </div>
    `;

    this.bindEvents();
    this.bindJobsEvents();
    this.updateJobsList();
    this.unsubscribeJobs = store.subscribe(() => {
      this.updateJobsList();
    });

    await this.loadCurrentSettings();
    await this.loadStorage();
    await this.loadJobs();
  }

  bindJobsEvents() {
    const clearBtn = document.getElementById('btn-settings-clear-jobs');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        try {
          await api.jobs.clearCompleted();
          const updated = await api.jobs.list();
          store.setJobs(updated);
          this.updateJobsList();
        } catch (e) {
          console.error(e);
        }
      });
    }
  }

  async loadJobs() {
    try {
      const jobs = await api.jobs.list();
      store.setJobs(jobs);
      this.updateJobsList();
    } catch (e) {
      console.warn('Load jobs notice:', e);
    }
  }

  updateJobsList() {
    const listEl = document.getElementById('settings-jobs-list');
    const badgeEl = document.getElementById('settings-jobs-count-badge');
    if (!listEl) return;

    const jobs = store.get().jobs || [];
    const activeCount = store.get().activeJobsCount || 0;
    if (badgeEl) badgeEl.textContent = activeCount;

    if (jobs.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="padding:20px;text-align:center;">
          <p class="empty-title" style="font-size:0.92rem;margin-bottom:4px;">Không có tác vụ nào</p>
          <p style="font-size:0.8rem;color:var(--text-muted);margin:0;">Các tác vụ tải trực tuyến hoặc chuyển đổi định dạng sẽ hiển thị ở đây.</p>
        </div>
      `;
      return;
    }

    listEl.innerHTML = jobs.map(job => {
      const isRunning = job.status === 'downloading' || job.status === 'processing';
      const isQueued = job.status === 'queued';
      const isError = job.status === 'error';
      const isDone = job.status === 'done';
      const isCanceled = job.status === 'canceled';

      let statusBadge = '';
      if (isRunning) statusBadge = `<span style="color:#60a5fa;font-weight:600;">Đang ${job.status === 'downloading' ? 'tải' : 'xử lý'} (${Math.round(job.progress || 0)}%)</span>`;
      else if (isQueued) statusBadge = `<span style="color:var(--text-muted);">Đang xếp hàng...</span>`;
      else if (isDone) statusBadge = `<span style="color:#34d399;font-weight:600;display:inline-flex;align-items:center;gap:4px;">${icons.check} Hoàn tất</span>`;
      else if (isError) statusBadge = `<span style="color:#f87171;font-weight:600;">Lỗi</span>`;
      else if (isCanceled) statusBadge = `<span style="color:var(--text-muted);">Đã hủy</span>`;

      return `
        <div style="background:var(--bg-elevated);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border-subtle);">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
            <div style="min-width:0;flex:1;padding-right:8px;">
              <div style="font-size:0.88rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${(job.kind === 'soundcloud' || job.kind === 'online') ? 'Trực tuyến' : 'Chuyển đổi'} - ${this.escapeHtml(job.url || job.track_id || 'Media')}
              </div>
              <div style="font-size:0.78rem;color:var(--text-muted);display:flex;gap:6px;align-items:center;margin-top:3px;flex-wrap:wrap;">
                <span>${job.media_type === 'video' ? 'Video (' + (job.quality || '720p') + ')' : 'Audio (m4a)'}</span>
                <span>•</span>
                ${statusBadge}
                ${job.speed ? `<span>• ${job.speed}</span>` : ''}
                ${job.eta ? `<span>• ETA: ${job.eta}</span>` : ''}
              </div>
            </div>

            <div style="display:flex;gap:6px;flex-shrink:0;">
              ${isRunning || isQueued ? `
                <button class="pill-btn setting-job-cancel-btn" data-id="${job.id}" style="min-height:28px;padding:2px 10px;font-size:0.75rem;">Hủy</button>
              ` : ''}
              ${isError ? `
                <button class="pill-btn setting-job-retry-btn" data-id="${job.id}" style="min-height:28px;padding:2px 10px;font-size:0.75rem;">Thử lại</button>
              ` : ''}
            </div>
          </div>

          ${isRunning ? `
            <div style="height:4px;background:var(--border-subtle);border-radius:2px;overflow:hidden;margin-top:6px;">
              <div style="height:100%;width:${job.progress || 0}%;background:var(--accent-gradient);transition:width 0.2s ease;"></div>
            </div>
          ` : ''}

          ${isError && job.error ? `
            <div style="font-size:0.75rem;color:#f87171;margin-top:6px;background:rgba(244,63,94,0.1);padding:6px 8px;border-radius:4px;word-break:break-word;">
              ${this.escapeHtml(job.error)}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.setting-job-cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.jobs.cancel(btn.dataset.id);
        } catch (e) {
          console.error(e);
        }
      });
    });

    listEl.querySelectorAll('.setting-job-retry-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.jobs.retry(btn.dataset.id);
        } catch (e) {
          console.error(e);
        }
      });
    });
  }

  async loadCurrentSettings() {
    try {
      const settings = await api.system.settings();
      if (settings.unknown_format_policy) {
        document.getElementById('setting-policy').value = settings.unknown_format_policy;
      }
      if (settings.seek_step) {
        document.getElementById('setting-seek-step').value = settings.seek_step;
        store.set({ seekStep: parseInt(settings.seek_step, 10) });
      }
      if (settings.max_concurrent_jobs) {
        document.getElementById('setting-concurrent-jobs').value = settings.max_concurrent_jobs;
      }
      if (settings.google_client_id) {
        document.getElementById('setting-google-client-id').value = settings.google_client_id;
      }
      if (settings.google_client_secret) {
        document.getElementById('setting-google-client-secret').value = settings.google_client_secret;
      }


      const redirectUriDisplay = document.getElementById('google-redirect-uri-display');
      if (redirectUriDisplay) {
        redirectUriDisplay.textContent = `${window.location.origin}/api/auth/google/callback`;
      }
    } catch (e) {
      console.error(e);
    }
  }

  async loadStorage() {
    const contentEl = document.getElementById('storage-stats-content');
    try {
      const stats = await api.system.storage();
      contentEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:0.9rem;">
          <span>Đã dùng cho Media:</span>
          <strong>${stats.mediaFormatted}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.9rem;">
          <span>Tổng dung lượng thư mục data:</span>
          <strong>${stats.totalFormatted}</strong>
        </div>
      `;
    } catch (e) {
      contentEl.innerHTML = `<span style="color:#f87171;font-size:0.85rem;">Không thể đọc dung lượng: ${e.message}</span>`;
    }
  }

  bindEvents() {
    const saveBtn = document.getElementById('btn-save-settings');
    saveBtn.addEventListener('click', async () => {
      const policy = document.getElementById('setting-policy').value;
      const step = document.getElementById('setting-seek-step').value;
      const jobs = document.getElementById('setting-concurrent-jobs').value;
      const googleClientId = document.getElementById('setting-google-client-id')?.value.trim() || '';
      const googleClientSecret = document.getElementById('setting-google-client-secret')?.value.trim() || '';

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';
        await api.system.updateSettings({
          unknown_format_policy: policy,
          seek_step: step,
          max_concurrent_jobs: jobs,
          google_client_id: googleClientId,
          google_client_secret: googleClientSecret
        });
        store.set({ seekStep: parseInt(step, 10) });
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu cài đặt';
        alert('Đã cập nhật cài đặt thành công!');
      } catch (err) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Lưu cài đặt';
        alert('Lỗi: ' + err.message);
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
