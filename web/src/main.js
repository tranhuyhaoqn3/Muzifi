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

    // Extract auth_token from URL query if present (from Google OAuth callback redirect)
    try {
      const urlParams = new URLSearchParams(window.location.search);
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

    // 7. Check user authentication (Mandatory Google Login)
    try {
      const auth = await api.auth.check();
      if (!auth.authenticated || !auth.user || !auth.user.isGoogle) {
        this.showGoogleLoginScreen(auth.googleConfigured);
        return;
      }
      this.currentUser = auth.user;
      try {
        localStorage.setItem('muzifi_user', JSON.stringify(auth.user));
      } catch (e) {}
      this.renderUserHeaderButton();
      await this.onLoginSuccess();
    } catch (err) {
      // If offline and user was previously logged in, allow access to offline library!
      const token = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
      if (!navigator.onLine && token) {
        let savedUser = null;
        try {
          savedUser = JSON.parse(localStorage.getItem('muzifi_user') || localStorage.getItem('metube_user'));
        } catch (e) {}
        this.currentUser = savedUser || { name: 'Người dùng offline', isGoogle: true };
        this.renderUserHeaderButton();
        await this.onLoginSuccess();
        return;
      }
      this.showGoogleLoginScreen();
    }
  }

  showGoogleLoginScreen(isConfigured = true) {
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
      <div style="background: rgba(17, 24, 39, 0.88); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 28px; padding: 44px 32px; max-width: 380px; width: 100%; text-align: center; box-shadow: 0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(99, 102, 241, 0.12); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);">
        
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

        <!-- Legal Links -->
        <div style="margin-top: 24px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); display: flex; justify-content: center; align-items: center; gap: 14px;">
          <a href="/privacy" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Chính sách bảo mật</a>
          <span style="opacity: 0.4;">&bull;</span>
          <a href="/terms" target="_blank" style="color: #94a3b8; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#94a3b8'">Điều khoản dịch vụ</a>
        </div>
      </div>
    `;

    document.body.appendChild(gate);

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
    if (navigator.onLine) {
      this.startSSE();
      this.startJobsPoller();
      api.jobs.list().then(jobs => {
        store.setJobs(jobs);
        this.updateHeaderJobsBadge();
      }).catch(() => {});
    }
    await this.restorePlayerState();

    // Background: pre-cache all library tracks for offline playback if online
    if (navigator.onLine) {
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
