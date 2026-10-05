import { api } from '../api.js';

export class LoginModal {
  constructor(onSuccess) {
    this.onSuccess = onSuccess;
    this.container = document.getElementById('modal-container');
  }

  show() {
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="modal-overlay" id="login-overlay">
        <div class="modal-card" style="max-width:380px;">
          <div class="modal-header" style="text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;padding-bottom:8px;">
            <img src="/logo.png" alt="Muzifi logo" style="width:54px;height:54px;object-fit:contain;border-radius:12px;filter:drop-shadow(0 4px 14px rgba(168,85,247,0.45));">
            <h3 class="modal-title" style="font-size:1.3rem;font-weight:800;letter-spacing:-0.02em;">Đăng nhập Muzifi</h3>
          </div>
          <div class="modal-body">
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
              Hệ thống dành cho 1 người dùng cá nhân. Nhập mật khẩu để truy cập kho nhạc & video.
            </p>
            <div class="form-group">
              <label class="form-label">Mật khẩu</label>
              <input type="password" id="login-pass-input" class="form-input" placeholder="Nhập mật khẩu..." autofocus>
            </div>
            <div id="login-error-msg" style="display:none;color:#fb7185;font-size:0.85rem;margin-bottom:12px;"></div>
            <button class="btn-primary" id="btn-submit-login" style="width:100%;margin-top:8px;">Đăng nhập</button>
          </div>
        </div>
      </div>
    `;

    const input = document.getElementById('login-pass-input');
    const submitBtn = document.getElementById('btn-submit-login');
    const errorMsg = document.getElementById('login-error-msg');

    const handleLogin = async () => {
      const pass = input.value;
      if (!pass) return;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Đang kiểm tra...';
      errorMsg.style.display = 'none';

      try {
        await api.auth.login(pass);
        document.getElementById('login-overlay').remove();
        if (this.onSuccess) this.onSuccess();
      } catch (err) {
        errorMsg.textContent = err.message || 'Mật khẩu không chính xác';
        errorMsg.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = 'Đăng nhập';
      }
    };

    submitBtn.addEventListener('click', handleLogin);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleLogin();
    });
  }
}
