import { api } from '../api.js';
import { icons } from './icons.js';

export class UserModal {
  constructor(currentUser, onUserChanged) {
    this.currentUser = currentUser;
    this.onUserChanged = onUserChanged;
  }

  async show() {
    document.getElementById('user-profile-modal')?.remove();

    const meRes = await api.auth.check().catch(() => ({}));
    const user = meRes.user || this.currentUser;
    const isGoogle = Boolean(user?.isGoogle);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'user-profile-modal';
    modal.style.zIndex = '9999';

    modal.innerHTML = `
      <div class="modal-card" style="max-width:420px;width:95%;">
        <div class="modal-header" style="border-bottom:1px solid var(--border-subtle);padding-bottom:12px;">
          <h3 class="modal-title" style="display:flex;align-items:center;gap:8px;font-size:1.05rem;">
            ${isGoogle ? 'Tài khoản Google' : 'Đăng nhập'}
          </h3>
          <button class="icon-btn" id="modal-user-close">${icons.x}</button>
        </div>

        <div class="modal-body" style="padding:18px 0;display:flex;flex-direction:column;gap:16px;">
          ${isGoogle ? `
            <!-- Logged in Google User Card -->
            <div style="background:var(--bg-elevated);border:1px solid var(--border-subtle);border-radius:var(--radius-lg);padding:16px;display:flex;align-items:center;gap:14px;">
              <div style="width:48px;height:48px;border-radius:50%;overflow:hidden;background:#4285F4;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:1.2rem;flex-shrink:0;">
                ${user?.avatar 
                  ? `<img src="${user.avatar}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;">` 
                  : (user?.name?.slice(0, 1)?.toUpperCase() || 'G')}
              </div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:600;font-size:1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${this.escapeHtml(user?.name || 'Tài khoản Google')}
                </div>
                <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  ${this.escapeHtml(user?.email || '')}
                </div>
                <div style="margin-top:4px;">
                  <span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:rgba(16,185,129,0.15);color:#10b981;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
                    ${icons.check} Đã liên kết tài khoản
                  </span>
                </div>
              </div>
            </div>
          ` : `
            <!-- Not logged in: Google Sign In Option -->
            <div style="text-align:center;padding:10px 0;">
              <div style="width:52px;height:52px;border-radius:50%;background:rgba(66,133,244,0.1);color:#4285F4;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;">
                <svg width="28" height="28" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
              </div>
              <h4 style="font-size:1.05rem;font-weight:600;margin:0 0 6px;">Đăng nhập bằng Google</h4>
              <p style="font-size:0.82rem;color:var(--text-muted);margin:0 auto 16px;max-width:320px;line-height:1.4;">
                Đồng bộ tự động Kênh đăng ký, Bài hát đã thích và Danh sách phát cá nhân của bạn.
              </p>

              <button id="btn-modal-google-login" class="pill-btn" style="width:100%;justify-content:center;background:#ffffff;color:#1f2937;font-weight:600;font-size:0.88rem;padding:10px 16px;border:none;box-shadow:0 2px 8px rgba(0,0,0,0.25);gap:8px;cursor:pointer;">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                Tiếp tục với Google
              </button>
            </div>
          `}
        </div>

        <div class="modal-footer" style="border-top:1px solid var(--border-subtle);padding-top:12px;display:flex;justify-content:${isGoogle ? 'space-between' : 'flex-end'};align-items:center;">
          ${isGoogle ? `
            <button id="btn-modal-logout" class="pill-btn" style="color:#ef4444;border-color:rgba(239,68,68,0.3);font-size:0.8rem;padding:6px 14px;">
              Đăng xuất
            </button>
          ` : ''}
          <button class="pill-btn" id="modal-user-close-btn" style="font-size:0.85rem;padding:6px 16px;">
            Đóng
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('#modal-user-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-user-close-btn').addEventListener('click', () => modal.remove());

    modal.querySelector('#btn-modal-google-login')?.addEventListener('click', async () => {
      try {
        const res = await api.auth.googleUrl();
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        alert(err.message || 'Không thể tạo đường dẫn đăng nhập Google. Vui lòng kiểm tra Client ID trong Cài đặt.');
      }
    });

    modal.querySelector('#btn-modal-logout')?.addEventListener('click', async () => {
      if (confirm('Bạn có chắc muốn đăng xuất khỏi tài khoản Google?')) {
        try {
          await api.auth.logout();
        } catch {}
        localStorage.removeItem('muzifi_token');
        localStorage.removeItem('metube_token');
        modal.remove();
        window.location.href = '/';
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
