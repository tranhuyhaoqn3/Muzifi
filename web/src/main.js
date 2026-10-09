import { store } from './state.js';
import { api, setUnauthorizedHandler } from './api.js';
import { PlayerEngine } from './components/Player.js';
import { LibraryView } from './components/Library.js';
import { PlaylistsView } from './components/Playlists.js';
import { SettingsView } from './components/Settings.js';
import { AddMediaModal } from './components/AddMedia.js';
import { JobsModal } from './components/Jobs.js';
import { OnlineView } from './components/Online.js';
import { UserModal } from './components/UserModal.js';
import { getAllOfflineTrackIds, saveTrackOffline, hasTrackOffline } from './offlineStorage.js';

class App {
  constructor() {
    this.player = null;
    this.libraryView = null;
    this.onlineView = null;
    this.playlistsView = null;
    this.settingsView = null;
    this.activeTab = 'library';
    this.eventSource = null;
    this.currentUser = null;
  }

  async init() {
    window.app = this;
    try {
      localStorage.removeItem('muzifi_cached_library');
      localStorage.removeItem('metube_cached_library');
      localStorage.removeItem('cloudbeats_state');
    } catch (e) {}

    // Listen for unauthorized events to display Google login screen
    setUnauthorizedHandler(() => {
      const isStandalone = Boolean(
        window.Capacitor ||
        window.__muzifi_guest_mode ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:' ||
        localStorage.getItem('muzifi_standalone_mode') === 'true'
      );
      if (isStandalone) return;
      this.showGoogleLoginScreen();
    });

    // 1. Register PWA Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        this.preCacheLibraryForOffline();
      }).catch(err => {
        console.warn('SW registration notice:', err);
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.preCacheLibraryForOffline();
      });
    }

    this.player = new PlayerEngine();
    this.pendingDeviceSaveTrackIds = new Set();
    store.set({ pendingDeviceTrackIds: this.pendingDeviceSaveTrackIds });
    this.libraryView = new LibraryView(this.player);
    this.onlineView = new OnlineView(this.player);
    this.player.onlineView = this.onlineView;
    this.playlistsView = new PlaylistsView(this.player);
    this.settingsView = new SettingsView();
    window.app = this;
    window.player = this.player;

    // 3. Bind Header & Navigation
    this.bindNavigation();
    this.bindHeaderActions();

    // Auto-update download tasks button & percentage
    store.subscribe(() => {
      this.updateHeaderJobsBadge();
    });

    // 4. iOS PWA Lifecycle & Resume Management
    this.initResumeHandler();

    // 5. Prevent double-tap to zoom (keeps 2-finger pinch zoom enabled)
    this.preventDoubleTapZoom();

    // 6. Network status listeners
    window.addEventListener('offline', () => {
      this.player?.showToast('Đang ở chế độ Offline — Bạn vẫn có thể nghe/xem các bài trong Thư viện!', 3500);
    });
    window.addEventListener('online', () => {
      this.player?.showToast('Đã kết nối mạng trở lại!', 2000);
      this.preCacheLibraryForOffline();
    });

    // Extract query parameters from URL
    let sharedTrackId = null;
    let sharedYtId = null;
    try {
      const urlParams = new URLSearchParams(window.location.search);
      sharedTrackId = urlParams.get('track') || urlParams.get('play');
      sharedYtId = urlParams.get('v') || urlParams.get('yt');

      const authToken = urlParams.get('auth_token');
      if (authToken) {
        localStorage.setItem('muzifi_token', authToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }
      const authError = urlParams.get('auth_error');
      if (authError) {
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        setTimeout(() => {
          this.player?.showToast(`Lỗi đăng nhập: ${decodeURIComponent(authError)}`, 4000);
        }, 500);
      }
    } catch (e) {}

    // Fast path: If visitor has a shared link and has NO stored token, render guest player IMMEDIATELY without waiting for auth API!
    const storedToken = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
    if ((sharedTrackId || sharedYtId) && !storedToken) {
      await this.playSharedTrackGuest(sharedTrackId, sharedYtId);
      return;
    }

    // 7. Check user authentication (Automatically bypassed in iOS app or standalone/offline mode)
    const isStandalone = Boolean(
      window.Capacitor ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      window.navigator.standalone ||
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem('muzifi_standalone_mode') === 'true'
    );

    if (isStandalone) {
      this.currentUser = { name: 'Người dùng', isGoogle: true };
      window.__muzifi_guest_mode = true;
      this.renderUserHeaderButton();
      await this.onLoginSuccess();
      return;
    }

    try {
      const auth = await api.auth.check();
      if (!auth.authenticated || !auth.user || !auth.user.isGoogle) {
        // If guest opened a shared song link, let them listen directly!
        if (sharedTrackId || sharedYtId) {
          await this.playSharedTrackGuest(sharedTrackId, sharedYtId);
          return;
        }
        this.showGoogleLoginScreen(auth.googleConfigured);
        return;
      }
      this.currentUser = auth.user;
      try {
        localStorage.setItem('muzifi_user', JSON.stringify(auth.user));
      } catch (e) {}
      this.renderUserHeaderButton();
      await this.onLoginSuccess();

      // If authenticated user opened a shared song link, start playing it immediately
      if (sharedTrackId) {
        this.playSharedTrack(sharedTrackId);
      } else if (sharedYtId) {
        this.playSharedOnlineTrack(sharedYtId);
      }
    } catch (err) {
      // If guest opened a shared song link and API check failed
      if (sharedTrackId || sharedYtId) {
        await this.playSharedTrackGuest(sharedTrackId, sharedYtId);
        return;
      }

      // If server is unreachable or offline, allow instant standalone access!
      this.currentUser = { name: 'Người dùng', isGoogle: true };
      window.__muzifi_guest_mode = true;
      this.renderUserHeaderButton();
      await this.onLoginSuccess();
      return;
    }
  }

  showGoogleLoginScreen(isConfigured = true) {
    const isStandalone = Boolean(
      window.Capacitor ||
      window.__muzifi_guest_mode ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      localStorage.getItem('muzifi_standalone_mode') === 'true'
    );
    if (isStandalone) return;

    if (document.getElementById('google-login-gate')) return;

    if (this.player) this.player.pause();

    const gate = document.createElement('div');
    gate.id = 'google-login-gate';
    gate.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: radial-gradient(circle at 50% 20%, rgba(99, 102, 241, 0.18), transparent 50%),
                  radial-gradient(circle at 80% 80%, rgba(168, 85, 247, 0.14), transparent 45%),
                  rgba(9, 13, 22, 0.98);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      overflow-y: auto;
    `;

    gate.innerHTML = `
      <div style="position: relative; background: rgba(17, 24, 39, 0.88); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 44px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
        
        ${window.__muzifi_guest_mode ? `
          <button id="btn-gate-close" style="position: absolute; top: 16px; right: 16px; background: rgba(255,255,255,0.08); border: none; border-radius: 50%; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; color: #a1a1aa; cursor: pointer; font-size: 1.1rem;" title="Đóng">✕</button>
        ` : ''}

        <!-- App Logo Only -->
        <div style="margin: 0 auto 36px; display: flex; align-items: center; justify-content: center;">
          <img src="/logo.png" alt="Logo" style="max-width: 180px; max-height: 90px; object-fit: contain; filter: drop-shadow(0 8px 20px rgba(0,0,0,0.45));">
        </div>

        <!-- Google Login Button -->
        <button id="btn-gate-google-signin" class="pill-btn" style="width: 100%; min-height: 50px; background: #ffffff; color: #1e293b; font-weight: 700; font-size: 0.96rem; border: none; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer; transition: all 0.2s ease;">
          <svg width="22" height="22" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
          </svg>
          <span>Tiếp tục với Google</span>
        </button>

        <!-- Install PWA Button -->
        <a href="/install" id="btn-gate-install" style="margin-top: 14px; width: 100%; min-height: 48px; background: rgba(255, 255, 255, 0.08); color: #e2e8f0; font-weight: 600; font-size: 0.92rem; border: 1px solid rgba(255, 255, 255, 0.16); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 9px; text-decoration: none; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255,255,255,0.14)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          <span>Cài đặt</span>
        </a>

        <!-- Legal Links -->
        <div style="margin-top: 24px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); display: flex; justify-content: center; align-items: center; gap: 14px;">
          <a href="/privacy" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Chính sách bảo mật</a>
          <span style="opacity: 0.4;">&bull;</span>
          <a href="/terms" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Điều khoản dịch vụ</a>
        </div>
      </div>
    `;

    document.body.appendChild(gate);

    document.getElementById('btn-gate-close')?.addEventListener('click', () => {
      gate.remove();
    });

    document.getElementById('btn-gate-google-signin')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-gate-google-signin');
      try {
        btn.disabled = true;
        btn.innerHTML = '<span>Đang chuyển hướng sang Google...</span>';
        const res = await api.auth.googleUrl();
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span>Tiếp tục với Google</span>';
        alert(err.message || 'Lỗi kết nối Google OAuth');
      }
    });
  }

  async onLoginSuccess() {
    store.set({ isAuthenticated: true });
    this.switchTab('library');
    const isStandalone = Boolean(
      window.Capacitor ||
      window.__muzifi_guest_mode ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      localStorage.getItem('muzifi_standalone_mode') === 'true'
    );
    if (!isStandalone && navigator.onLine) {
      this.startSSE();
      this.startJobsPoller();
      api.jobs.list().then(jobs => {
        store.setJobs(jobs);
        this.updateHeaderJobsBadge();
      }).catch(() => {});
    }
    await this.restorePlayerState();

    // Background: pre-cache all library tracks for offline playback if online
    if (!isStandalone && navigator.onLine) {
      this.preCacheLibraryForOffline();
    }
  }

  /** Synchronize all library tracks, artwork, and lyrics directly into IndexedDB on this device */
  async syncLibraryWithDevice(showToastNotice = false) {
    try {
      const data = await api.tracks.list({ limit: 1000 });
      const tracks = data.tracks || [];
      if (tracks.length === 0) return;

      try {
        localStorage.setItem('muzifi_cached_library', JSON.stringify(tracks));
      } catch (e) {}

      const existingIds = await getAllOfflineTrackIds();
      const missingTracks = tracks.filter(t => !existingIds.has(t.id));
      if (missingTracks.length === 0) return;

      const CONCURRENCY = 2;
      let currentIndex = 0;
      let downloadedCount = 0;

      const downloadWorker = async () => {
        while (currentIndex < missingTracks.length) {
          const track = missingTracks[currentIndex++];
          if (!track) break;

          try {
            await saveTrackOffline(track);
            downloadedCount++;
            if (this.libraryView?.checkCachedTracks) {
              this.libraryView.checkCachedTracks();
            }
          } catch (err) {
            console.warn(`Sync error on track ${track.id}:`, err);
          }
          await new Promise(r => setTimeout(r, 150));
        }
      };

      const workers = [];
      for (let i = 0; i < Math.min(CONCURRENCY, missingTracks.length); i++) {
        workers.push(downloadWorker());
      }
      await Promise.all(workers);

      if (downloadedCount > 0 && this.libraryView?.checkCachedTracks) {
        this.libraryView.checkCachedTracks();
      }
    } catch (e) {
      console.warn('syncLibraryWithDevice notice:', e);
    }
  }

  /** Backward compatibility alias */
  async preCacheLibraryForOffline() {
    return this.syncLibraryWithDevice(false);
  }

  /** Download a specific track directly into local device IndexedDB for instant offline playback */
  async downloadTrackToDevice(trackId, title = '', onProgress = null) {
    if (!trackId) return;
    try {
      await saveTrackOffline({ id: trackId, title }, '', onProgress);
      if (this.activeTab === 'library') {
        this.libraryView?.checkCachedTracks?.();
      }
    } catch (e) {
      console.warn('downloadTrackToDevice error:', e);
    }
  }

  /** Pre-cache a newly downloaded or uploaded track directly into IndexedDB */
  cacheSingleTrackForOffline(trackId, title = '') {
    if (!trackId) return;
    this.downloadTrackToDevice(trackId, title).catch(() => {});
  }

  startSSE() {
    if (!navigator.onLine) return;

    if (this.eventSource) {
      this.eventSource.close();
    }

    const token = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
    const sseUrl = token ? `/api/jobs/stream?token=${encodeURIComponent(token)}` : '/api/jobs/stream';
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'init' && Array.isArray(data.jobs)) {
          store.setJobs(data.jobs);
        } else if (data.id) {
          if (data.status === 'done') {
            if (data.track_id) {
              // Mark that this track is still saving to device IndexedDB
              this.pendingDeviceSaveTrackIds.add(data.track_id);
              store.set({ pendingDeviceTrackIds: new Set(this.pendingDeviceSaveTrackIds) });

              // Keep job active with 'deviceSaving' state
              data.deviceSaving = true;
              data.deviceProgress = 5;
              store.updateJob(data);
              this.updateHeaderJobsBadge();

              // Download directly to device IndexedDB with real-time byte progress
              this.downloadTrackToDevice(data.track_id, data.title, (prog) => {
                data.deviceSaving = true;
                data.deviceProgress = prog.percent;
                data.deviceLoadedMb = prog.loadedMb;
                data.deviceTotalMb = prog.totalMb;
                store.updateJob(data);
                this.updateHeaderJobsBadge();
              }).finally(() => {
                this.pendingDeviceSaveTrackIds.delete(data.track_id);
                store.set({ pendingDeviceTrackIds: new Set(this.pendingDeviceSaveTrackIds) });

                data.deviceSaving = false;
                store.updateJob(data);
                this.updateHeaderJobsBadge();

                // ONLY when audio file is fully saved in IndexedDB and ready to play, render to Library
                if (this.activeTab === 'library') {
                  this.libraryView?.fetchAndRenderTracks?.();
                }
              });
            } else {
              store.updateJob(data);
              this.updateHeaderJobsBadge();
              if (this.activeTab === 'library') {
                this.libraryView?.fetchAndRenderTracks?.();
              }
            }
          } else {
            store.updateJob(data);
            this.updateHeaderJobsBadge();
          }
        }
      } catch (e) {
        console.warn('SSE parse notice:', e);
      }
    };

    this.eventSource.onerror = () => {
      // Auto reconnects by browser standard
    };
  }

  startJobsPoller() {
    if (this.jobsPollTimer) clearInterval(this.jobsPollTimer);
    this.jobsPollTimer = setInterval(async () => {
      if (!navigator.onLine) return;
      const jobs = store.get().jobs || [];
      const hasActive = jobs.some(j => j.status === 'downloading' || j.status === 'processing' || j.status === 'queued' || j.deviceSaving);
      if (!hasActive) return;

      try {
        const serverJobs = await api.jobs.list();
        if (!Array.isArray(serverJobs)) return;

        for (const sj of serverJobs) {
          const localJob = jobs.find(j => j.id === sj.id);
          if (localJob && localJob.deviceSaving) {
            sj.deviceSaving = true;
            sj.deviceProgress = localJob.deviceProgress;
            sj.deviceLoadedMb = localJob.deviceLoadedMb;
            sj.deviceTotalMb = localJob.deviceTotalMb;
          } else if (sj.status === 'done' && sj.track_id && !this.pendingDeviceSaveTrackIds.has(sj.track_id)) {
            const isLocal = await hasTrackOffline(sj.track_id);
            if (!isLocal) {
              this.pendingDeviceSaveTrackIds.add(sj.track_id);
              store.set({ pendingDeviceTrackIds: new Set(this.pendingDeviceSaveTrackIds) });
              sj.deviceSaving = true;
              sj.deviceProgress = 5;

              this.downloadTrackToDevice(sj.track_id, sj.title, (prog) => {
                sj.deviceSaving = true;
                sj.deviceProgress = prog.percent;
                sj.deviceLoadedMb = prog.loadedMb;
                sj.deviceTotalMb = prog.totalMb;
                store.updateJob(sj);
                this.updateHeaderJobsBadge();
              }).finally(() => {
                this.pendingDeviceSaveTrackIds.delete(sj.track_id);
                store.set({ pendingDeviceTrackIds: new Set(this.pendingDeviceSaveTrackIds) });
                sj.deviceSaving = false;
                store.updateJob(sj);
                this.updateHeaderJobsBadge();
                if (this.activeTab === 'library') {
                  this.libraryView?.fetchAndRenderTracks?.();
                }
              });
            }
          }
        }
        store.setJobs(serverJobs);
        this.updateHeaderJobsBadge();
      } catch (err) {}
    }, 2500);
  }

  updateHeaderJobsBadge() {
    const jobsBtn = document.getElementById('btn-header-jobs');
    const ringFill = document.getElementById('jobs-ring-fill');
    const percentBadge = document.getElementById('jobs-percent-badge');
    const iconSymbol = document.getElementById('jobs-icon-symbol');
    const settingsBadge = document.getElementById('settings-jobs-badge');

    const jobs = store.get().jobs || [];
    const activeJobs = jobs.filter(j => j.status === 'downloading' || j.status === 'processing' || j.deviceSaving);
    const queuedJobs = jobs.filter(j => j.status === 'queued');
    const activeCount = activeJobs.length + queuedJobs.length;

    if (settingsBadge) {
      if (activeCount > 0) {
        settingsBadge.textContent = activeCount;
        settingsBadge.style.display = 'flex';
      } else {
        settingsBadge.style.display = 'none';
      }
    }

    // Also update any library-corner downloading button if present
    const libDlBtn = document.getElementById('btn-lib-downloading');
    const libDlPercent = document.getElementById('lib-dl-percent');

    const savingJob = activeJobs.find(j => j.deviceSaving);

    if (activeCount > 0) {
      let percent = 0;
      if (activeJobs.length > 0) {
        const sum = activeJobs.reduce((acc, j) => acc + (j.deviceSaving ? (j.deviceProgress || 10) : (j.progress || 0)), 0);
        percent = Math.round(sum / activeJobs.length);
        percent = Math.min(99, Math.max(1, percent));
      }

      if (jobsBtn) {
        jobsBtn.classList.add('is-downloading');
        jobsBtn.classList.remove('is-idle');
        if (savingJob && savingJob.deviceLoadedMb && savingJob.deviceTotalMb) {
          jobsBtn.title = `Lưu vào máy: ${savingJob.deviceLoadedMb}/${savingJob.deviceTotalMb}MB (${percent}%)`;
        } else if (savingJob) {
          jobsBtn.title = `Đang lưu về máy: ${percent}%`;
        } else if (activeJobs.length === 0 && queuedJobs.length > 0) {
          jobsBtn.title = `Đang xếp hàng chờ tải (${queuedJobs.length} bài)`;
        } else {
          jobsBtn.title = `Đang tải: ${percent}% (${activeCount} bài)`;
        }
      }
      if (ringFill) {
        ringFill.setAttribute('stroke-dasharray', `${percent}, 100`);
      }
      if (percentBadge) {
        if (savingJob) {
          percentBadge.textContent = `${percent}%`;
        } else if (activeJobs.length === 0 && queuedJobs.length > 0) {
          percentBadge.textContent = 'Chờ';
        } else {
          percentBadge.textContent = activeCount > 1 ? `${percent}% (${activeCount})` : `${percent}%`;
        }
        percentBadge.style.display = 'inline';
      }
      if (iconSymbol) {
        iconSymbol.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
      }

      if (libDlBtn) {
        libDlBtn.style.display = 'inline-flex';
        if (libDlPercent) {
          if (savingJob && savingJob.deviceLoadedMb && savingJob.deviceTotalMb) {
            libDlPercent.textContent = `${savingJob.deviceLoadedMb}/${savingJob.deviceTotalMb}MB (${percent}%)`;
          } else if (savingJob) {
            libDlPercent.textContent = `Lưu máy: ${percent}%`;
          } else if (activeJobs.length === 0 && queuedJobs.length > 0) {
            libDlPercent.textContent = `Đang xếp hàng (${activeCount} bài)`;
          } else {
            libDlPercent.textContent = `${percent}% (${activeCount} bài)`;
          }
        }
      }
    } else {
      if (jobsBtn) {
        jobsBtn.classList.remove('is-downloading');
        jobsBtn.classList.add('is-idle');
        jobsBtn.title = 'Tiến trình tải nhạc';
      }
      if (ringFill) {
        ringFill.setAttribute('stroke-dasharray', `0, 100`);
      }
      if (percentBadge) {
        percentBadge.style.display = 'none';
      }

      if (libDlBtn) {
        libDlBtn.style.display = 'none';
      }
    }
  }

  async restorePlayerState() {
    try {
      // 1. Try local state first
      const local = localStorage.getItem('cloudbeats_state');
      let restoredTrackId = null;
      let resumePos = 0;

      if (local) {
        const parsed = JSON.parse(local);
        restoredTrackId = parsed.trackId;
        resumePos = parsed.positionSec || 0;
        if (parsed.playbackRate) store.set({ playbackRate: parsed.playbackRate });
        if (parsed.loopMode) {
          this.player.setLoopMode(parsed.loopMode);
        }
        if (parsed.isShuffle) {
          store.set({ isShuffle: true });
          if (this.player.shuffleBtn) this.player.shuffleBtn.classList.add('active');
        }
      }

      // 2. Fetch server state (only if online)
      if (navigator.onLine) {
        try {
          const serverState = await api.player.getState();
          if (!restoredTrackId && serverState && serverState.track_id) {
            restoredTrackId = serverState.track_id;
            resumePos = serverState.position_sec || 0;
          }
        } catch (e) {}
      }

      if (restoredTrackId) {
        let tracksList = store.get().tracks || [];
        if (tracksList.length === 0) {
          try {
            const tracksRes = await api.tracks.list({ limit: 100 });
            tracksList = tracksRes.tracks || [];
          } catch {
            const raw = localStorage.getItem('muzifi_cached_library') || localStorage.getItem('metube_cached_library');
            if (raw) tracksList = JSON.parse(raw);
          }
        }
        const targetTrack = (tracksList || []).find(t => t.id === restoredTrackId);
        if (targetTrack) {
          store.set({ queue: tracksList });
          // Load track without autoplay to respect iOS gesture rules
          await this.player.loadTrack(targetTrack, false, resumePos);
        }
      }
    } catch (e) {
      console.warn('Restore state notice:', e);
    }
  }

  bindNavigation() {
    const isLocalAdmin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const settingsNavBtn = document.querySelector('.nav-item[data-tab="settings"]');
    if (settingsNavBtn) {
      settingsNavBtn.style.display = isLocalAdmin ? 'flex' : 'none';
    }

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.dataset.tab;
        if (tab === 'settings' && !isLocalAdmin) {
          return;
        }
        this.switchTab(tab);
      });
    });
  }

  switchTab(tab) {
    const isLocalAdmin = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (tab === 'settings' && !isLocalAdmin) {
      tab = 'library';
    }

    this.activeTab = tab;
    store.set({ activeTab: tab });

    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tab);
    });

    if (tab === 'library') {
      this.libraryView.render();
    } else if (tab === 'online') {
      this.onlineView.render();
    } else if (tab === 'playlists') {
      this.playlistsView.render();
    } else if (tab === 'settings') {
      this.settingsView.render();
    }
  }

  bindHeaderActions() {
    const addBtn = document.getElementById('btn-header-add');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        new AddMediaModal(() => {
          if (this.activeTab === 'library') {
            this.libraryView.fetchAndRenderTracks();
          }
        }).show();
      });
    }

    const jobsBtn = document.getElementById('btn-header-jobs');
    if (jobsBtn) {
      jobsBtn.addEventListener('click', () => {
        new JobsModal(() => {
          if (this.activeTab === 'library') {
            this.libraryView.fetchAndRenderTracks();
          }
        }).show();
      });
    }
  }

  initResumeHandler() {
    let lastResumeTime = Date.now();

    const handleResume = () => {
      const now = Date.now();
      if (now - lastResumeTime < 200) return;
      lastResumeTime = now;

      // 1. Force WebKit compositor layer re-evaluation & repaint
      document.body.style.transform = 'scale(1)';
      void document.body.offsetHeight;
      document.body.style.transform = '';

      // 2. Synchronize player engine
      if (this.player) {
        this.player.onForegroundResume();
      }

      // 3. Reconnect SSE if connection was dropped while locked
      if (this.eventSource && this.eventSource.readyState === EventSource.CLOSED) {
        this.startSSE();
      }

      // 4. Force viewport resize dispatch
      window.dispatchEvent(new Event('resize'));

      // 5. If login gate is visible or token was received, check auth to auto-enter home
      const urlParams = new URLSearchParams(window.location.search);
      const authToken = urlParams.get('auth_token');
      if (authToken) {
        localStorage.setItem('muzifi_token', authToken);
        window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      }

      if (document.getElementById('google-login-gate')) {
        api.auth.check().then(auth => {
          if (auth.authenticated && auth.user && auth.user.isGoogle) {
            this.currentUser = auth.user;
            this.renderUserHeaderButton();
            this.onLoginSuccess();
          }
        }).catch(() => {});
      } else if (this.currentUser && navigator.onLine) {
        // Automatically sync any tracks added while away or from other devices
        this.syncLibraryWithDevice(false);
      }
    };

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    });

    window.addEventListener('pageshow', () => {
      handleResume();
    });

    window.addEventListener('focus', () => {
      handleResume();
    });
  }

  preventDoubleTapZoom() {
    // Only prevent double-tap to zoom on non-interactive elements; allow 2-finger pinch-to-zoom
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (e) => {
      // Don't intercept clicks on buttons, links, nav items or form controls
      const isInteractive = e.target && e.target.closest('button, a, input, textarea, select, .nav-item, .track-item, .icon-btn, .pill-btn, [role="button"]');
      if (isInteractive) return;

      const now = Date.now();
      if (now - lastTouchEnd <= 300) {
        e.preventDefault();
      }
      lastTouchEnd = now;
    }, { passive: false });
  }

  renderUserHeaderButton() {
    let container = document.getElementById('header-user-btn-container');
    const headerRight = document.querySelector('.header-right');
    if (!container && headerRight) {
      container = document.createElement('div');
      container.id = 'header-user-btn-container';
      headerRight.prepend(container);
    }
    if (!container) return;

    const u = this.currentUser;
    container.innerHTML = `
      <button id="btn-header-user" class="pill-btn" style="padding:4px 10px 4px 6px;gap:8px;font-size:0.8rem;font-weight:600;display:flex;align-items:center;border-radius:20px;background:var(--bg-surface);border:1px solid var(--border-subtle);cursor:pointer;" title="Tài khoản: ${this.escapeHtml(u?.name || 'Người dùng')}">
        <div style="width:24px;height:24px;border-radius:50%;overflow:hidden;background:var(--accent-primary, #6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.7rem;flex-shrink:0;">
          ${u?.avatar ? `<img src="${u.avatar}" style="width:100%;height:100%;object-fit:cover;">` : (u?.name?.slice(0, 1)?.toUpperCase() || 'U')}
        </div>
        <span style="max-width:85px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${this.escapeHtml(u?.name || 'Tài khoản')}
        </span>
      </button>
    `;

    document.getElementById('btn-header-user')?.addEventListener('click', () => {
      new UserModal(this.currentUser, (newUser) => this.onUserChanged(newUser)).show();
    });
  }

  async onUserChanged(newUser) {
    this.currentUser = newUser;
    this.renderUserHeaderButton();
    this.player?.showToast(`Đã chuyển sang tài khoản ${newUser.name}`, 3000);
    // Refresh active tab views with new user's isolated data
    if (this.activeTab === 'library') {
      this.libraryView.render();
    } else if (this.activeTab === 'playlists') {
      this.playlistsView.render();
    } else if (this.activeTab === 'online') {
      this.onlineView.currentUser = newUser;
      this.onlineView.render();
    }
    await this.restorePlayerState();
  }

  async playSharedTrackGuest(trackId, ytId) {
    window.__muzifi_guest_mode = true;
    document.body.classList.add('shared-guest-view');

    // Show skeleton immediately — no blank black screen
    this._renderSharedSkeleton(ytId);

    let track = null;
    if (trackId) {
      try {
        const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/shared`);
        if (res.ok) {
          const data = await res.json();
          track = data.track;
        }
      } catch (e) {
        console.warn('Failed to fetch shared track info:', e);
      }
    } else if (ytId) {
      try {
        const res = await fetch(`/api/youtube/track-info?v=${encodeURIComponent(ytId)}`);
        if (res.ok) {
          const data = await res.json();
          track = data.track;
        }
      } catch (e) {
        console.warn('Failed to fetch shared youtube info:', e);
      }
    }

    if (!track) {
      document.body.classList.remove('shared-guest-view');
      this.showGoogleLoginScreen();
      return;
    }

    // 1. Render full player card (replaces skeleton)
    this.renderSharedWebPlayer(track);

    // 2. Load track in player engine
    if (ytId || track.isOnline) {
      this.player?.loadOnlineTrack({
        ...track,
        youtubeId: ytId || track.youtube_id || track.id,
        isOnline: true
      }, false);
    } else {
      this.player?.loadTrack(track, true, 0, false);
    }
  }

  _renderSharedSkeleton(ytId) {
    const mainView = document.getElementById('main-view');
    if (!mainView) return;
    mainView.innerHTML = `
      <style>
        @keyframes _sk_pulse{0%,100%{opacity:.45}50%{opacity:.9}}
        @keyframes _sk_spin{to{transform:rotate(360deg)}}
        .sk-box{animation:_sk_pulse 1.6s ease-in-out infinite}
        .sk-spin{animation:_sk_spin 1s linear infinite;transform-origin:center}
      </style>
      <div class="shared-web-landing">
        <div class="shared-ambient-bg" style="background:linear-gradient(135deg,#1e1035 0%,#0f172a 100%);"></div>
        <div class="shared-player-card">
          <div class="shared-cover-box">
            <div class="shared-cover-img sk-box" style="background:rgba(255,255,255,.08);border-radius:16px;"></div>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">
              <svg class="sk-spin" viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2.2">
                <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,.18)" stroke-width="2.2"/>
                <path d="M12 3a9 9 0 0 1 9 9" stroke="rgba(255,255,255,.85)" stroke-linecap="round"/>
              </svg>
            </div>
          </div>
          <div class="shared-meta">
            <div class="shared-badge is-buffering"></div>
            <div class="sk-box" style="height:22px;width:70%;background:rgba(255,255,255,.1);border-radius:8px;margin:10px 0 6px;"></div>
            <div class="sk-box" style="height:14px;width:45%;background:rgba(255,255,255,.07);border-radius:6px;"></div>
          </div>
          <div class="shared-scrubber-box">
            <div class="shared-scrubber-bar">
              <div class="shared-scrubber-fill" style="width:0%"></div>
            </div>
            <div class="shared-times"><span>0:00</span><span>--:--</span></div>
          </div>
        </div>
      </div>
    `;
  }

  renderSharedWebPlayer(track) {
    const mainView = document.getElementById('main-view');
    if (!mainView) return;

    const thumbUrl = track.thumbnail_url || (track.id ? `/api/tracks/${track.id}/thumb` : '/icon-192x192.png');
    const durationStr = this.player?.formatTime(track.duration_sec || 0) || '0:00';

    const rawArtist = (track.artist || track.channel || '').trim();
    const cleanArtist = (!rawArtist || /^youtube$/i.test(rawArtist)) ? 'Nghệ sĩ' : rawArtist.replace(/\byoutube\b/gi, '').trim() || 'Nghệ sĩ';
    const cleanTitle = (track.title || 'Bản nhạc được chia sẻ').replace(/\s*-\s*YouTube$/i, '').trim();

    mainView.innerHTML = `
      <div class="shared-web-landing">
        <div class="shared-ambient-bg" style="background-image: url('${thumbUrl}');"></div>
        
        <div class="shared-player-card">
          <div class="shared-cover-box">
            <img src="${thumbUrl}" alt="Cover" class="shared-cover-img" id="shared-landing-cover" onerror="this.src='/icon-192x192.png'">
            <button class="shared-huge-play-btn" id="btn-shared-listen-now" title="Phát / Tạm dừng">
              <span id="shared-btn-icon">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </span>
            </button>
          </div>

          <div class="shared-meta">
            <div class="shared-badge" id="shared-landing-badge"></div>
            <h1 class="shared-title">${this.escapeHtml(cleanTitle)}</h1>
            <p class="shared-artist">${this.escapeHtml(cleanArtist)}</p>
          </div>

          <div class="shared-scrubber-box">
            <div class="shared-scrubber-bar" id="shared-scrubber">
              <div class="shared-scrubber-fill" id="shared-scrubber-fill"></div>
            </div>
            <div class="shared-times">
              <span id="shared-time-current">0:00</span>
              <span id="shared-time-duration">${durationStr}</span>
            </div>
          </div>

          <!-- Google Login Button -->
          <button id="btn-shared-google-signin" class="pill-btn" style="width: 100%; min-height: 48px; background: #ffffff; color: #1e293b; font-weight: 700; font-size: 0.94rem; border: none; border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); cursor: pointer; transition: all 0.2s ease; margin-bottom: 10px;">
            <svg width="22" height="22" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Đăng nhập với Google</span>
          </button>

          <!-- Install Button -->
          <a href="/install" style="width: 100%; min-height: 44px; background: rgba(255,255,255,0.07); color: #e2e8f0; font-weight: 600; font-size: 0.88rem; border: 1px solid rgba(255,255,255,0.14); border-radius: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; text-decoration: none; transition: background 0.2s;">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Cài đặt
          </a>
        </div>
      </div>
    `;

    // Bind Controls
    const playSvg = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    const pauseSvg = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    const spinnerSvg = `
      <svg class="shared-spin" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2.6">
        <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" stroke-width="2.6"/>
        <path d="M12 3a9 9 0 0 1 9 9" stroke="#ffffff" stroke-linecap="round"/>
      </svg>
    `;

    const togglePlayback = () => {
      const state = store.get();
      if (!state.isPlaying) {
        store.set({ isBuffering: true });
      }
      this.player?.togglePlay();
    };

    document.getElementById('btn-shared-listen-now')?.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePlayback();
    });

    document.getElementById('shared-landing-cover')?.addEventListener('click', () => {
      togglePlayback();
    });

    document.getElementById('btn-shared-google-signin')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-shared-google-signin');
      try {
        btn.disabled = true;
        btn.innerHTML = '<span>Đang chuyển hướng sang Google...</span>';
        const res = await api.auth.googleUrl();
        if (res.url) {
          window.location.href = res.url;
        }
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '<span>Đăng nhập với Google</span>';
        alert(err.message || 'Lỗi kết nối Google OAuth');
      }
    });

    // Scrubber click to seek
    const scrubberBar = document.getElementById('shared-scrubber');
    if (scrubberBar) {
      scrubberBar.addEventListener('click', (e) => {
        const rect = scrubberBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const dur = this.player?.getDuration() || track.duration_sec || 0;
        if (dur > 0) {
          this.player?.seek(pos * dur);
        }
      });
    }

    // Subscribe to store to update UI live
    store.subscribe((state) => {
      const isPlaying = state.isPlaying;
      const isBuffering = Boolean(state.isBuffering);
      const coverEl = document.getElementById('shared-landing-cover');
      const btnIconEl = document.getElementById('shared-btn-icon');
      const playBtn = document.getElementById('btn-shared-listen-now');
      const badgeEl = document.getElementById('shared-landing-badge');

      if (btnIconEl) {
        if (isBuffering) {
          btnIconEl.innerHTML = spinnerSvg;
        } else {
          btnIconEl.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">${isPlaying ? pauseSvg : playSvg}</svg>`;
        }
      }

      if (badgeEl) {
        if (isBuffering) {
          badgeEl.textContent = '';
          badgeEl.classList.add('is-buffering');
        } else {
          badgeEl.textContent = '';
          badgeEl.classList.remove('is-buffering');
        }
      }

      if (coverEl) coverEl.classList.toggle('is-playing', isPlaying && !isBuffering);
      if (playBtn) {
        playBtn.classList.toggle('pulsing', isPlaying && !isBuffering);
        playBtn.classList.toggle('is-loading', isBuffering);
      }

      // Scrubber progress
      const cur = state.currentTime || 0;
      const dur = state.duration || track.duration_sec || 0;
      const pct = dur > 0 ? (cur / dur) * 100 : 0;

      const fillEl = document.getElementById('shared-scrubber-fill');
      const curTimeEl = document.getElementById('shared-time-current');
      const durTimeEl = document.getElementById('shared-time-duration');

      if (fillEl) fillEl.style.width = `${pct}%`;
      if (curTimeEl) curTimeEl.textContent = this.player?.formatTime(cur);
      if (durTimeEl && dur > 0) durTimeEl.textContent = this.player?.formatTime(dur);
    });
  }

  async playSharedTrack(trackId) {
    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(trackId)}/shared`);
      if (res.ok) {
        const data = await res.json();
        if (data.track) {
          this.player?.loadTrack(data.track, true, 0, true);
          this.player?.showToast(`Đang phát: ${data.track.title}`);
        }
      }
    } catch (e) {
      console.warn('playSharedTrack error:', e);
    }
  }

  async playSharedOnlineTrack(ytId) {
    try {
      const res = await fetch(`/api/youtube/track-info?v=${encodeURIComponent(ytId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.track) {
          this.player?.loadOnlineTrack(data.track, true);
          this.player?.showToast(`Đang phát: ${data.track.title}`);
        }
      }
    } catch (e) {
      console.warn('playSharedOnlineTrack error:', e);
    }
  }

  showSharedBanner(track) {
    if (document.getElementById('muzifi-shared-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'muzifi-shared-banner';
    banner.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 99999;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.86rem;
      font-weight: 500;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    `;
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;min-width:0;">
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          Đang nghe: <strong style="color:#fef08a;">${this.escapeHtml(track.title)}</strong>
        </span>
      </div>
      <button id="btn-shared-login" style="background:#fff;color:#1e1e2e;border:none;border-radius:20px;padding:6px 14px;font-size:0.8rem;font-weight:700;cursor:pointer;flex-shrink:0;">
        Đăng nhập Google
      </button>
    `;
    document.body.appendChild(banner);
    document.getElementById('btn-shared-login')?.addEventListener('click', () => {
      this.showGoogleLoginScreen();
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  window.app = app;
  app.init();
});
