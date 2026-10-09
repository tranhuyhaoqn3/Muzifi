import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';
import { showAddToPlaylistModal } from './PlaylistModal.js';
import { JobsModal } from './Jobs.js';
import { getAllOfflineTrackIds, getAllOfflineTracks, deleteOfflineTrack, saveTrackOffline } from '../offlineStorage.js';

export class LibraryView {
  constructor(playerEngine) {
    this.player = playerEngine;
    this.container = document.getElementById('main-view');
    this.cachedTrackIds = new Set();
    this.syncingTrackIds = new Set();
    this.syncProgressMap = new Map();
    this._progressRafId = null;
    this._pendingJobUpdates = new Map();
  }

  async render() {
    const { libraryFilter, searchQuery, sortBy } = store.get();

    this.container.innerHTML = `
      <div class="library-header" style="margin-bottom:12px;">
        <!-- Search Bar & Compact Sync Button -->
        <div class="search-bar-row" style="display:flex;align-items:center;gap:8px;">
          <div class="search-input-box" style="flex:1;">
            ${icons.search}
            <input type="text" id="lib-search-input" placeholder="Tìm theo bài hát, ca sĩ, album..." value="${searchQuery || ''}">
            ${searchQuery ? `<button id="lib-search-clear" class="icon-btn" style="min-height:32px;min-width:32px;">${icons.x}</button>` : ''}
          </div>
          <button id="btn-sync-offline" class="pill-btn" style="font-size:0.76rem;padding:0 10px;min-height:36px;gap:5px;background:var(--bg-surface);border:1px solid var(--border-subtle);display:flex;align-items:center;cursor:pointer;border-radius:18px;color:var(--text-primary);flex-shrink:0;" title="Đồng bộ về máy">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            <span>Đồng bộ</span>
          </button>
        </div>

        <!-- Tracks List -->
        <div id="tracks-container" class="track-list" style="margin-top:10px;">
          <div class="empty-state">Đang tải thư viện...</div>
        </div>
      </div>
    `;

    this.bindEvents();
    await this.fetchAndRenderTracks();
  }

  bindEvents() {
    const searchInput = document.getElementById('lib-search-input');
    let debounceTimer = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        store.set({ searchQuery: e.target.value });
        this.fetchAndRenderTracks();
      }, 300);
    });

    const clearBtn = document.getElementById('lib-search-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        searchInput.value = '';
        store.set({ searchQuery: '' });
        this.render();
      });
    }

    const syncBtn = document.getElementById('btn-sync-offline');
    if (syncBtn) {
      syncBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.handleManualSync(syncBtn);
      });
    }

    window.app?.updateHeaderJobsBadge();
  }

  async fetchAndRenderTracks() {
    const { libraryFilter, searchQuery, sortBy } = store.get();
    const tracksContainer = document.getElementById('tracks-container');

    // Only show skeleton on cold empty list, do not flash when updating
    if (tracksContainer && (!tracksContainer.children || tracksContainer.children.length === 0 || tracksContainer.querySelector('.empty-state'))) {
      tracksContainer.innerHTML = Array(6).fill(0).map(() => `
        <div class="skeleton-track-row">
          <div class="skeleton-shimmer skeleton-thumb-square"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:65%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:35%;"></div>
          </div>
        </div>
      `).join('');
    }

    const isStandalone = Boolean(
      window.Capacitor ||
      window.__muzifi_guest_mode ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      localStorage.getItem('muzifi_standalone_mode') === 'true'
    );

    if (isStandalone) {
      let localTracks = [];
      try {
        localTracks = await getAllOfflineTracks();
      } catch (e) {}

      if (localTracks.length === 0) {
        localTracks = store.get().tracks || [];
        if (localTracks.length === 0) {
          try {
            const raw = localStorage.getItem('muzifi_cached_library') || localStorage.getItem('metube_cached_library');
            if (raw) localTracks = JSON.parse(raw);
          } catch (e) {}
        }
      }

      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        localTracks = localTracks.filter(t =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.artist && t.artist.toLowerCase().includes(q)) ||
          (t.album && t.album.toLowerCase().includes(q))
        );
      }

      if (sortBy === 'title_asc') {
        localTracks.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      } else if (sortBy === 'duration_desc') {
        localTracks.sort((a, b) => (b.duration_sec || 0) - (a.duration_sec || 0));
      } else {
        localTracks.sort((a, b) => (b.savedAt || b.created_at || 0) - (a.savedAt || a.created_at || 0));
      }

      this.cachedTrackIds = new Set(localTracks.map(t => t.id));
      store.set({ tracks: localTracks, totalTracks: localTracks.length });
      this.renderTrackItems(localTracks);
      return;
    }

    try {
      const data = await api.tracks.list({
        type: '',
        q: searchQuery,
        sort: sortBy
      });

      // Filter out any tracks currently in progress of saving audio Blob to device IndexedDB
      const pendingIds = store.get().pendingDeviceTrackIds || window.app?.pendingDeviceSaveTrackIds;
      const allServerTracks = data.tracks || [];
      const tracksToRender = pendingIds && pendingIds.size > 0
        ? allServerTracks.filter(t => !pendingIds.has(t.id))
        : allServerTracks;

      store.set({ tracks: tracksToRender, totalTracks: data.total || tracksToRender.length });
      try {
        localStorage.setItem('muzifi_cached_library', JSON.stringify(tracksToRender));
      } catch (e) {}

      try {
        const offlineIds = await getAllOfflineTrackIds();
        this.cachedTrackIds = new Set(offlineIds);
      } catch (e) {}

      this.renderTrackItems(tracksToRender);
      this.checkCachedTracks();
    } catch (err) {
      // Offline / Serverless fallback: load from IndexedDB records
      let fallback = [];
      try {
        fallback = await getAllOfflineTracks();
      } catch (e) {}

      if (fallback.length === 0) {
        fallback = store.get().tracks || [];
        if (fallback.length === 0) {
          try {
            const raw = localStorage.getItem('muzifi_cached_library') || localStorage.getItem('metube_cached_library');
            if (raw) fallback = JSON.parse(raw);
          } catch (e) {}
        }
      }

      if (fallback.length > 0) {
        let filtered = fallback;
        if (searchQuery && searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          filtered = filtered.filter(t =>
            (t.title && t.title.toLowerCase().includes(q)) ||
            (t.artist && t.artist.toLowerCase().includes(q)) ||
            (t.album && t.album.toLowerCase().includes(q))
          );
        }
        try {
          const offlineIds = await getAllOfflineTrackIds();
          this.cachedTrackIds = new Set(offlineIds);
        } catch (e) {}
        this.renderTrackItems(filtered);
        this.checkCachedTracks();
      } else if (tracksContainer) {
        tracksContainer.innerHTML = `
          <div class="empty-state">
            <p class="empty-title">Chưa có bài hát nào</p>
            <p>Bấm nút (+) ở góc trên để thêm file nhạc vào máy.</p>
          </div>
        `;
      }
    }
  }

  async checkCachedTracks() {
    try {
      this.cachedTrackIds = await getAllOfflineTrackIds();
      this.updateCachedBadges();
    } catch (e) {
      console.warn('checkCachedTracks error:', e);
    }
  }

  updateCachedBadges() {
    const container = document.getElementById('tracks-container');
    if (!container) return;
    const tracks = store.get().tracks || [];

    container.querySelectorAll('.track-item').forEach(el => {
      const id = el.dataset.id;
      const isCached = this.cachedTrackIds && this.cachedTrackIds.has(id);
      const isSyncing = this.syncingTrackIds && this.syncingTrackIds.has(id);

      // Update right-side actions
      const actionsWrap = el.querySelector('.track-sync-actions');
      if (!actionsWrap) return;

      if (isSyncing) {
        // Keep live syncing spinner & percent untouched
        return;
      }

      if (isCached) {
        const hasCached = actionsWrap.querySelector('.track-offline-badge.cached');
        if (!hasCached) {
          actionsWrap.innerHTML = `
            <div class="track-offline-badge cached pop-in" title="Đã lưu trên thiết bị (Offline)">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
            </div>
          `;
        }
      } else {
        const hasSyncBtn = actionsWrap.querySelector('.btn-sync-single-track');
        if (!hasSyncBtn) {
          const track = tracks.find(t => t.id === id);
          actionsWrap.innerHTML = `
            <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${id}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Tải</span>
            </button>
          `;
          const btn = actionsWrap.querySelector('.btn-sync-single-track');
          if (btn && track) {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.syncSingleTrack(track, el);
            });
          }
        }
      }
    });
  }

  updateTrackRowSyncProgress(trackId, prog) {
    const rowEl = document.querySelector(`.track-item[data-id="${trackId}"]`);
    if (!rowEl) return;
    const actionsWrap = rowEl.querySelector('.track-sync-actions');
    if (actionsWrap) {
      let pctEl = actionsWrap.querySelector('.track-sync-pct');
      if (!pctEl) {
        actionsWrap.innerHTML = `
          <div class="track-sync-progress" title="Đang tải về máy...">
            <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="track-sync-pct">${prog.percent || 0}%</span>
          </div>
        `;
      } else {
        pctEl.textContent = `${prog.percent || 0}%`;
      }
    }
  }

  _scheduleProgressFlush() {
    if (this._progressRafId) return;
    this._progressRafId = requestAnimationFrame(() => {
      this._progressRafId = null;
      this._flushPendingJobUpdates();
    });
  }

  _flushPendingJobUpdates() {
    for (const [, { syncJob, prog }] of this._pendingJobUpdates) {
      syncJob.deviceProgress = prog.percent;
      syncJob.deviceLoadedMb = prog.loadedMb;
      syncJob.deviceTotalMb = prog.totalMb;
      syncJob.progress = prog.percent;
      store.updateJob(syncJob);
    }
    this._pendingJobUpdates.clear();
    window.app?.updateHeaderJobsBadge?.();
  }

  markTrackRowCached(trackId) {
    const rowEl = document.querySelector(`.track-item[data-id="${trackId}"]`);
    if (!rowEl) return;

    // Update right action badge with pop animation
    const actionsWrap = rowEl.querySelector('.track-sync-actions');
    if (actionsWrap) {
      actionsWrap.innerHTML = `
        <div class="track-offline-badge cached pop-in" title="Đã lưu trên thiết bị (Offline)">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
      `;
    }
  }

  async syncSingleTrack(track, rowEl) {
    if (!track || !track.id) return;
    if (this.syncingTrackIds.has(track.id) || this.cachedTrackIds.has(track.id)) return;

    this.syncingTrackIds.add(track.id);
    this.syncProgressMap.set(track.id, { percent: 0, loadedMb: '0.0', totalMb: '0.0' });

    // Update row DOM to show progress pill
    if (rowEl) {
      const actionsWrap = rowEl.querySelector('.track-sync-actions');
      if (actionsWrap) {
        actionsWrap.innerHTML = `
          <div class="track-sync-progress" title="Đang tải về máy...">
            <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            <span class="track-sync-pct">0%</span>
          </div>
        `;
      }
    }

    const jobId = `sync_${track.id}`;
    const syncJob = {
      id: jobId,
      track_id: track.id,
      title: track.title,
      status: 'downloading',
      deviceSaving: true,
      deviceProgress: 1,
      deviceLoadedMb: '0.0',
      deviceTotalMb: '0.0',
      progress: 1
    };
    store.updateJob(syncJob);
    window.app?.updateHeaderJobsBadge?.();

    try {
      await saveTrackOffline(track, '', (prog) => {
        this.syncProgressMap.set(track.id, prog);
        this.updateTrackRowSyncProgress(track.id, prog);
        this._pendingJobUpdates.set(track.id, { syncJob, prog });
        this._scheduleProgressFlush();
      });

      this.cachedTrackIds.add(track.id);
      this.markTrackRowCached(track.id);
      this.player?.showToast(`Đã lưu "${track.title}" về máy (Offline)`);
    } catch (err) {
      console.warn('syncSingleTrack failed:', err);
      this.player?.showToast(`Lỗi tải "${track.title}": ${err.message}`);
      if (rowEl) {
        const actionsWrap = rowEl.querySelector('.track-sync-actions');
        if (actionsWrap) {
          actionsWrap.innerHTML = `
            <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${track.id}">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Thử lại</span>
            </button>
          `;
          const retryBtn = actionsWrap.querySelector('.btn-sync-single-track');
          if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              e.preventDefault();
              this.syncSingleTrack(track, rowEl);
            });
          }
        }
      }
    } finally {
      this.syncingTrackIds.delete(track.id);
      this.syncProgressMap.delete(track.id);
      const remainingJobs = (store.get().jobs || []).filter(j => j.id !== jobId);
      store.setJobs(remainingJobs);
      window.app?.updateHeaderJobsBadge?.();
    }
  }

  renderTrackItems(tracks) {
    const container = document.getElementById('tracks-container');
    if (!tracks || tracks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${icons.music}</div>
          <p class="empty-title">Chưa có bài hát nào</p>
          <p>Chuyển sang tab Trực tuyến để tìm kiếm và tải nhạc về máy.</p>
        </div>
      `;
      return;
    }

    const { currentTrack, isPlaying } = store.get();

    container.innerHTML = tracks.map(track => {
      const isCur = currentTrack && currentTrack.id === track.id;
      const isCached = this.cachedTrackIds && this.cachedTrackIds.has(track.id);
      const isSyncing = this.syncingTrackIds && this.syncingTrackIds.has(track.id);
      const prog = this.syncProgressMap.get(track.id);
      const durationStr = this.player.formatTime(track.duration_sec || 0);
      const timeAgo = (track.created_at && this.player.formatRelativeTime) ? this.player.formatRelativeTime(track.created_at) : '';

      return `
        <div class="track-item ${isCur ? 'playing' : ''}" data-id="${track.id}">
          <div class="track-thumb-wrap">
            <img class="track-thumb" src="${track.thumbBlob ? URL.createObjectURL(track.thumbBlob) : (track.thumbDataUrl || `/api/tracks/${track.id}/thumb`)}" onerror="this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'%236366f1\'><path d=\'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z\'/></svg>'" alt="Cover" loading="lazy">
          </div>

          <div class="track-meta" style="flex:1;min-width:0;">
            <div class="track-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              ${this.escapeHtml(track.title)}
            </div>
            <div class="track-sub">
              <span>${this.escapeHtml(track.artist || 'Nghệ sĩ')}</span>
              <span>•</span>
              <span>${durationStr}</span>
              ${timeAgo ? `<span>•</span><span>${timeAgo}</span>` : ''}
            </div>
          </div>

          <div class="track-sync-actions">
            ${isCached ? `
              <div class="track-offline-badge cached" title="Đã lưu trên thiết bị (Offline)">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#10b981" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
              </div>
            ` : isSyncing ? `
              <div class="track-sync-progress" title="Đang tải về máy...">
                <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span class="track-sync-pct">${prog ? prog.percent : 0}%</span>
              </div>
            ` : `
              <button class="btn-sync-single-track" title="Tải về máy để nghe offline" data-id="${track.id}">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <span>Tải</span>
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');

    // Attach click events: tap to play, long-press (mobile) or right-click (desktop) to open menu/delete
    container.querySelectorAll('.track-item').forEach(el => {
      let pressTimer = null;
      let isLongPress = false;

      const id = el.dataset.id;
      const track = tracks.find(t => t.id === id);
      if (!track) return;

      // Click single track sync button
      const syncBtn = el.querySelector('.btn-sync-single-track');
      if (syncBtn) {
        syncBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          this.syncSingleTrack(track, el);
        });
      }

      // Mobile touch long-press (~500ms)
      el.addEventListener('touchstart', (e) => {
        if (e.target.closest('.track-sync-actions')) return;
        isLongPress = false;
        pressTimer = setTimeout(() => {
          isLongPress = true;
          if (navigator.vibrate) navigator.vibrate(35);
          this.showTrackMenu(track);
        }, 500);
      }, { passive: true });

      el.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
      });

      el.addEventListener('touchmove', () => {
        clearTimeout(pressTimer);
      });

      // Desktop right-click
      el.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.track-sync-actions')) return;
        e.preventDefault();
        this.showTrackMenu(track);
      });

      // Click to play: queue consists of all remaining songs in library, stops at end
      // Click to play: put all tracks into queue and start playing clicked track
      el.addEventListener('click', (e) => {
        if (isLongPress) {
          isLongPress = false;
          return;
        }
        if (e.target.closest('.track-sync-actions')) {
          return;
        }
        store.set({
          queue: [...tracks],
          originalQueue: [...tracks],
          isLibraryQueue: true,
          isPlaylistMode: false
        });
        this.player.loadTrack(track, true, 0);
      });
    });
  }

  async handleManualSync(btn) {
    if (!btn || btn.disabled) return;
    const originalBtnHtml = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `
      <svg class="spin-loader" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <span>Tìm bìa & lời...</span>
    `;

    try {
      // 1. Quét & tự động tải ảnh bìa / lời bài hát còn thiếu trên máy chủ
      let enrichRes = { thumbFixed: 0, lyricsFixed: 0 };
      try {
        enrichRes = await api.tracks.enrich();
        if (enrichRes && (enrichRes.thumbFixed > 0 || enrichRes.lyricsFixed > 0)) {
          this.fetchAndRenderTracks();
        }
      } catch (enrichErr) {
        console.warn('Enrich notice:', enrichErr);
      }

      btn.innerHTML = `
        <svg class="spin-loader" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        <span>Kiểm tra offline...</span>
      `;

      // 2. Kiểm tra và đồng bộ bài hát về máy (IndexedDB)
      const data = await api.tracks.list({ limit: 1000 });
      const tracks = data.tracks || [];
      if (tracks.length === 0) {
        btn.innerHTML = '<span>Trống</span>';
        setTimeout(() => { btn.innerHTML = originalBtnHtml; btn.disabled = false; }, 2000);
        return;
      }

      const existingIds = await getAllOfflineTrackIds();
      this.cachedTrackIds = new Set(existingIds);
      const missing = tracks.filter(t => !existingIds.has(t.id));

      if (missing.length === 0) {
        btn.innerHTML = `
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <span style="color:#10b981;">Đã đủ</span>
        `;
        this.updateCachedBadges();
        const msgParts = [];
        if (enrichRes.thumbFixed > 0) msgParts.push(`+${enrichRes.thumbFixed} ảnh bìa`);
        if (enrichRes.lyricsFixed > 0) msgParts.push(`+${enrichRes.lyricsFixed} lời bài hát`);
        if (msgParts.length > 0) {
          this.player?.showToast(`Đã bổ sung ${msgParts.join(', ')}`);
        } else {
          this.player?.showToast('Thư viện đã có đầy đủ bìa, lời và bài hát');
        }
        setTimeout(() => { btn.innerHTML = originalBtnHtml; btn.disabled = false; }, 2500);
        return;
      }

      let done = 0;
      for (let i = 0; i < missing.length; i++) {
        const t = missing[i];
        this.syncingTrackIds.add(t.id);
        this.syncProgressMap.set(t.id, { percent: 0, loadedMb: '0.0', totalMb: '0.0' });

        const rowEl = document.querySelector(`.track-item[data-id="${t.id}"]`);
        if (rowEl) {
          const actionsWrap = rowEl.querySelector('.track-sync-actions');
          if (actionsWrap) {
            actionsWrap.innerHTML = `
              <div class="track-sync-progress" title="Đang tải về máy...">
                <svg class="spin-loader" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                <span class="track-sync-pct">0%</span>
              </div>
            `;
          }
        }

        const jobId = `sync_${t.id}`;
        const syncJob = {
          id: jobId,
          track_id: t.id,
          title: t.title,
          status: 'downloading',
          deviceSaving: true,
          deviceProgress: 1,
          deviceLoadedMb: '0.0',
          deviceTotalMb: '0.0',
          progress: 1
        };
        store.updateJob(syncJob);
        window.app?.updateHeaderJobsBadge?.();

        btn.innerHTML = `
          <svg class="spin-loader" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          <span>${missing.length > 1 ? `${i + 1}/${missing.length} ` : ''}0%</span>
        `;
        const btnSpan = btn.querySelector('span');

        try {
          await saveTrackOffline(t, '', (prog) => {
            this.syncProgressMap.set(t.id, prog);
            this.updateTrackRowSyncProgress(t.id, prog);
            if (btnSpan) btnSpan.textContent = `${missing.length > 1 ? `${i + 1}/${missing.length} ` : ''}${prog.percent}%`;
            this._pendingJobUpdates.set(t.id, { syncJob, prog });
            this._scheduleProgressFlush();
          });

          done++;
          this.cachedTrackIds.add(t.id);
          this.markTrackRowCached(t.id);
        } catch (err) {
          console.warn('Manual sync track error:', err);
        } finally {
          this.syncingTrackIds.delete(t.id);
          this.syncProgressMap.delete(t.id);
          const remainingJobs = (store.get().jobs || []).filter(j => j.id !== jobId);
          store.setJobs(remainingJobs);
          window.app?.updateHeaderJobsBadge?.();
        }
      }

      btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        <span style="color:#10b981;">Đã xong</span>
      `;
      this.updateCachedBadges();

      const summaryParts = [];
      if (enrichRes.thumbFixed > 0) summaryParts.push(`+${enrichRes.thumbFixed} ảnh bìa`);
      if (enrichRes.lyricsFixed > 0) summaryParts.push(`+${enrichRes.lyricsFixed} lời bài hát`);
      if (done > 0) summaryParts.push(`đã tải ${done} bài về máy`);
      this.player?.showToast(summaryParts.length > 0 ? `Đã đồng bộ: ${summaryParts.join(', ')}` : `Đã đồng bộ xong ${done} bài hát về máy`);
      setTimeout(() => { btn.innerHTML = originalBtnHtml; btn.disabled = false; }, 3000);
    } catch (err) {
      console.warn('Sync failed:', err);
      btn.innerHTML = '<span>Lỗi</span>';
      setTimeout(() => { btn.innerHTML = originalBtnHtml; btn.disabled = false; }, 2500);
    }
  }

  showTrackMenu(track) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="track-menu-modal">
        <div class="modal-card" style="max-width:340px;width:92%;">
          <div class="modal-header">
            <div class="modal-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(track.title)}</div>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="padding:14px;display:flex;flex-direction:column;gap:8px;">
            <button class="btn-secondary" id="opt-share" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              ${icons.share} Chia sẻ bài hát
            </button>
            <button class="btn-secondary" id="opt-enrich" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
              Tìm ảnh bìa & lời bài hát
            </button>
            <button class="btn-secondary" id="opt-add-playlist" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              ${icons.plus} Thêm vào Playlist
            </button>
            <button class="btn-danger" id="opt-delete" style="justify-content:flex-start;min-height:40px;font-size:0.9rem;">
              ${icons.trash} Xóa bài hát
            </button>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('track-menu-modal');
    modal.querySelector('#modal-close').addEventListener('click', () => { modal.remove(); });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // 0. Chia sẻ bài hát
    modal.querySelector('#opt-share').addEventListener('click', () => {
      modal.remove();
      this.player?.shareTrack(track);
    });

    // 1. Tìm ảnh bìa & lời bài hát cho riêng bài này
    modal.querySelector('#opt-enrich').addEventListener('click', async () => {
      modal.remove();
      this.player?.showToast(`Đang tìm ảnh bìa và lời cho "${track.title}"...`, 2000);
      try {
        const res = await api.tracks.enrichSingle(track.id);
        const added = [];
        if (res.enrichedThumb) added.push('ảnh bìa');
        if (res.enrichedLyrics) added.push('lời bài hát');
        if (added.length > 0) {
          this.player?.showToast(`Đã tìm thấy ${added.join(' và ')} cho "${track.title}"`);
          await this.fetchAndRenderTracks();
        } else {
          this.player?.showToast(`Bài hát đã có đầy đủ bìa và lời`);
        }
      } catch (err) {
        this.player?.showToast(`Không tìm thấy thêm thông tin: ${err.message}`);
      }
    });

    // 2. Thêm vào Playlist
    modal.querySelector('#opt-add-playlist').addEventListener('click', () => {
      modal.remove();
      showAddToPlaylistModal({ trackIds: [track.id], trackTitle: track.title });
    });

    // 3. Xóa bài hát
    modal.querySelector('#opt-delete').addEventListener('click', async () => {
      if (!confirm(`Xóa bài "${track.title}" khỏi máy? Thao tác này không thể hoàn tác.`)) return;
      try {
        await api.tracks.delete(track.id).catch(() => {});
        await deleteOfflineTrack(track.id);
        modal.remove();
        this.player?.showToast(`Đã xóa "${track.title}" khỏi thư viện`);
        await this.fetchAndRenderTracks();
      } catch (err) {
        alert('Lỗi xóa: ' + err.message);
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
