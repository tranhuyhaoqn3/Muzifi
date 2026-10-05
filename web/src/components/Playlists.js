import Sortable from 'sortablejs';
import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';
import { showAddToPlaylistModal, showAddTracksToPlaylistModal } from './PlaylistModal.js';
import { animateFlyToCorner } from './flyAnim.js';

export class PlaylistsView {
  constructor(playerEngine) {
    this.player = playerEngine;
    this.container = document.getElementById('main-view');
    this.activePlaylistId = null;
    this.sortableInstance = null;
  }

  async render(playlistId = null) {
    if (playlistId) {
      this.activePlaylistId = playlistId;
      await this.renderPlaylistDetail(playlistId);
    } else {
      this.activePlaylistId = null;
      await this.renderPlaylistsOverview();
    }
  }

  async renderPlaylistsOverview() {
    this.container.innerHTML = `
      <div class="playlists-overview">
        <div class="playlists-header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div>
            <h2 style="font-size:1.35rem;font-weight:700;letter-spacing:-0.01em;margin:0;">Danh sách phát</h2>
          </div>
          <button id="btn-create-playlist" class="btn-primary" style="display:none;min-height:36px;padding:0 14px;border-radius:20px;font-size:0.84rem;font-weight:600;align-items:center;gap:6px;" title="Tạo hoặc nhập playlist">
            ${icons.plus} <span>Tạo playlist</span>
          </button>
        </div>

        <div id="playlists-list" class="playlists-grid">
          <div class="empty-state" style="grid-column:1/-1;">Đang tải danh sách phát...</div>
        </div>
      </div>
    `;

    document.getElementById('btn-create-playlist').addEventListener('click', () => {
      this.showCreatePlaylistModal();
    });

    await this.fetchAndRenderOverview();
  }

  async fetchAndRenderOverview() {
    const listEl = document.getElementById('playlists-list');
    const headerCreateBtn = document.getElementById('btn-create-playlist');

    if (listEl) {
      listEl.innerHTML = Array(4).fill(0).map(() => `
        <div class="skeleton-track-row" style="padding:14px;border-radius:var(--radius-lg);margin-bottom:8px;">
          <div class="skeleton-shimmer skeleton-thumb-square" style="width:52px;height:52px;border-radius:12px;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:55%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:30%;"></div>
          </div>
        </div>
      `).join('');
    }
    try {
      const playlists = await api.playlists.list();
      store.set({ playlists });

      if (playlists.length === 0) {
        if (headerCreateBtn) headerCreateBtn.style.display = 'none';
        listEl.innerHTML = `
          <div class="empty-state" style="grid-column:1/-1;padding:40px 16px;text-align:center;">
            <div class="empty-icon" style="margin:0 auto 12px;opacity:0.6;">${icons.queue}</div>
            <p class="empty-title" style="font-size:1.05rem;font-weight:600;margin-bottom:6px;">Chưa có danh sách phát nào</p>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">Tạo playlist riêng hoặc dán liên kết để nghe trực tiếp & tải offline.</p>
            <button id="btn-empty-create-pl" class="btn-primary" style="min-height:38px;padding:0 18px;border-radius:20px;font-size:0.86rem;font-weight:600;display:inline-flex;align-items:center;gap:6px;">
              ${icons.plus} <span>Tạo playlist</span>
            </button>
          </div>
        `;
        const emptyBtn = listEl.querySelector('#btn-empty-create-pl');
        if (emptyBtn) {
          emptyBtn.addEventListener('click', () => this.showCreatePlaylistModal());
        }
        return;
      }

      if (headerCreateBtn) headerCreateBtn.style.display = 'inline-flex';

      listEl.innerHTML = playlists.map(pl => `
        <div class="playlist-card" data-id="${pl.id}">
          <div class="playlist-thumb-box">
            <img class="playlist-thumb-img" src="/api/playlists/${pl.id}/thumb?t=${encodeURIComponent(pl.updated_at || '')}" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
            <div class="playlist-thumb-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
              ${icons.queue}
            </div>
          </div>
          <div class="playlist-card-meta">
            <div class="playlist-card-title">${this.escapeHtml(pl.name)}</div>
            <div class="playlist-card-sub">${pl.track_count || 0} bài hát</div>
          </div>
          <div class="playlist-card-actions">
            <button class="icon-btn pl-opt-btn" data-id="${pl.id}" title="Tùy chọn">${icons.more}</button>
          </div>
        </div>
      `).join('');

      listEl.querySelectorAll('.playlist-card').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.playlist-card-actions')) return;
          this.render(el.dataset.id);
        });
      });

      listEl.querySelectorAll('.pl-opt-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const pl = playlists.find(p => p.id === btn.dataset.id);
          if (pl) this.showPlaylistMenu(pl);
        });
      });
    } catch (err) {
      listEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Lỗi: ${err.message}</div>`;
    }
  }

  async renderPlaylistDetail(id) {
    this.container.innerHTML = `
      <div class="playlist-detail">
        <div class="playlist-detail-hero">
          <div class="playlist-detail-top-nav">
            <button id="btn-back-playlists" class="icon-btn" title="Quay lại danh sách playlist">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button id="btn-pl-detail-opt" class="icon-btn" title="Tùy chọn playlist">
              ${icons.more}
            </button>
          </div>

          <div class="playlist-detail-info-row">
            <div class="playlist-detail-cover" id="pl-detail-cover-btn" title="Bấm để đổi ảnh bìa playlist">
              <img id="pl-detail-cover-img" src="/api/playlists/${id}/thumb?t=${Date.now()}" alt="" class="playlist-detail-cover-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
              <div class="playlist-detail-cover-fallback" style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">
                ${icons.queue}
              </div>
              <div class="playlist-cover-edit-badge" title="Đổi ảnh bìa">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </div>
            </div>
            <div style="flex:1;min-width:0;">
              <span style="font-size:0.75rem;text-transform:uppercase;letter-spacing:0.06em;color:var(--accent-primary);font-weight:700;">Danh sách phát</span>
              <h2 id="pl-detail-name" style="font-size:1.45rem;font-weight:700;margin:4px 0;line-height:1.2;word-break:break-word;">Đang tải...</h2>
              <p id="pl-detail-count" style="font-size:0.85rem;color:var(--text-secondary);"></p>
            </div>
          </div>

          <div class="playlist-detail-actions-row" style="display:flex;gap:8px;align-items:center;">
            <button id="btn-play-all-pl" class="btn-primary" style="flex:1;min-height:40px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.88rem;font-weight:600;">
              ${icons.play} <span>Phát</span>
            </button>
            <button id="btn-shuffle-pl" class="btn-secondary" style="min-height:40px;padding:0 14px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.86rem;font-weight:600;">
              ${icons.shuffle} <span>Xáo trộn</span>
            </button>
            <button id="btn-add-tracks-pl" class="pill-btn" style="min-height:40px;padding:0 14px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;gap:6px;font-size:0.86rem;font-weight:500;">
              ${icons.plus} <span>Thêm bài</span>
            </button>
          </div>
        </div>

        <div id="playlist-tracks-list" class="track-list">
          ${Array(5).fill(0).map(() => `
            <div class="skeleton-track-row">
              <div class="skeleton-shimmer skeleton-thumb-square"></div>
              <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                <div class="skeleton-shimmer skeleton-text-lg" style="width:65%;"></div>
                <div class="skeleton-shimmer skeleton-text-sm" style="width:35%;"></div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    document.getElementById('btn-back-playlists').addEventListener('click', () => {
      this.render();
    });

    try {
      const pl = await api.playlists.get(id);
      document.getElementById('pl-detail-name').textContent = pl.name;
      document.getElementById('pl-detail-count').textContent = `${(pl.tracks || []).length} bài hát • Kéo để đổi thứ tự`;

      const optBtn = document.getElementById('btn-pl-detail-opt');
      if (optBtn) {
        optBtn.addEventListener('click', () => {
          this.showPlaylistMenu(pl);
        });
      }

      const coverBtn = document.getElementById('pl-detail-cover-btn');
      if (coverBtn) {
        coverBtn.addEventListener('click', () => {
          this.showAvatarModal(pl);
        });
      }

      const listEl = document.getElementById('playlist-tracks-list');
      const tracks = pl.tracks || [];

      document.getElementById('btn-add-tracks-pl').addEventListener('click', () => {
        showAddTracksToPlaylistModal({
          playlistId: id,
          playlistName: pl.name,
          currentTrackIds: tracks.map(t => t.id),
          onSuccess: () => this.renderPlaylistDetail(id)
        });
      });

      document.getElementById('btn-play-all-pl').addEventListener('click', () => {
        if (tracks.length > 0) {
          store.set({ queue: [...tracks], originalQueue: [...tracks], isPlaylistMode: true, isShuffle: false });
          if (this.player.shuffleBtn) this.player.shuffleBtn.classList.remove('active');
          this.player.loadTrack(tracks[0], true, 0, true);
        }
      });

      document.getElementById('btn-shuffle-pl').addEventListener('click', () => {
        if (tracks.length > 0) {
          const orig = [...tracks];
          const shuffled = [...tracks];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          store.set({ isShuffle: true, queue: shuffled, originalQueue: orig, isPlaylistMode: true });
          if (this.player.shuffleBtn) this.player.shuffleBtn.classList.add('active');
          this.player.loadTrack(shuffled[0], true, 0, true);
          this.player?.showToast(`Đang xáo trộn playlist "${pl.name}"`, 1500);

          // Re-render track list in shuffled order so user sees the shuffle
          this._renderPlaylistTrackList(listEl, shuffled, tracks, pl, id);
        }
      });

      this._renderPlaylistTrackList(listEl, tracks, tracks, pl, id);

    } catch (err) {
      document.getElementById('playlist-tracks-list').innerHTML = `
        <div class="empty-state">Lỗi tải playlist: ${err.message}</div>
      `;
    }
  }

  _renderPlaylistTrackList(listEl, displayTracks, allTracks, pl, playlistId) {
    if (displayTracks.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          <p class="empty-title">Playlist đang trống</p>
          <p>Bấm nút bên dưới để chọn bài hát từ thư viện vào playlist này.</p>
          <button class="btn-primary" id="btn-empty-add-tracks" style="margin-top:14px;min-height:38px;padding:0 16px;display:inline-flex;align-items:center;gap:6px;">
            ${icons.plus} Thêm bài hát từ thư viện
          </button>
        </div>
      `;
      document.getElementById('btn-empty-add-tracks')?.addEventListener('click', () => {
        showAddTracksToPlaylistModal({
          playlistId,
          playlistName: pl.name,
          currentTrackIds: [],
          onSuccess: () => this.renderPlaylistDetail(playlistId)
        });
      });
      return;
    }

    listEl.innerHTML = displayTracks.map(track => `
      <div class="track-item" data-id="${track.id}">
        <div class="drag-handle-touch" style="cursor:grab;color:var(--text-muted);padding-right:4px;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>
            <circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>
          </svg>
        </div>

        <div class="track-thumb-wrap">
          <img class="track-thumb" src="/api/tracks/${track.id}/thumb" alt="Cover" loading="lazy">
        </div>

        <div class="track-meta">
          <div class="track-title">${this.escapeHtml(track.title)}</div>
          <div class="track-sub">
            <span>${this.escapeHtml(track.artist || 'Nghệ sĩ')}</span>
            <span>•</span>
            <span>${this.player.formatTime(track.duration_sec || 0)}</span>
            ${track.created_at && this.player.formatRelativeTime ? `<span>•</span><span>${this.player.formatRelativeTime(track.created_at)}</span>` : ''}
          </div>
        </div>

        <div class="track-actions">
          <button class="icon-btn pl-track-opt-btn" data-id="${track.id}" title="Tùy chọn">
            ${icons.more}
          </button>
        </div>
      </div>
    `).join('');

    // Play track on click
    listEl.querySelectorAll('.track-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.track-actions') || e.target.closest('.drag-handle-touch')) return;
        const track = displayTracks.find(t => t.id === el.dataset.id);
        if (track) {
          store.set({ queue: [...displayTracks], originalQueue: [...allTracks] });
          this.player.loadTrack(track, true, 0, true);
        }
      });
    });

    // Track options menu
    listEl.querySelectorAll('.pl-track-opt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trId = btn.dataset.id;
        const track = displayTracks.find(t => t.id === trId);
        if (track) {
          this.showPlaylistTrackMenu(track, pl);
        }
      });
    });

    // Touch Drag and Drop using SortableJS
    if (this.sortableInstance) {
      this.sortableInstance.destroy();
    }

    this.sortableInstance = new Sortable(listEl, {
      handle: '.drag-handle-touch',
      animation: 200,
      ghostClass: 'sortable-ghost',
      onEnd: async () => {
        const items = listEl.querySelectorAll('.track-item');
        const newOrderIds = Array.from(items).map(item => item.dataset.id);
        try {
          await api.playlists.reorder(playlistId, newOrderIds);
        } catch (err) {
          console.error('Reorder error:', err);
        }
      }
    });
  }

  showCreatePlaylistModal(initialTab = 'custom') {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="create-pl-modal">
        <div class="modal-card" style="max-width:460px;width:94%;">
          <div class="modal-header">
            <h3 class="modal-title">Tạo danh sách phát</h3>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="padding:14px 16px;">
            <!-- Segmented control: Tạo mới | Từ liên kết -->
            <div style="display:flex;gap:6px;background:var(--surface-variant);padding:4px;border-radius:var(--radius-md);margin-bottom:16px;">
              <button id="pl-tab-custom" class="pill-btn active" style="flex:1;text-align:center;min-height:34px;font-size:0.86rem;font-weight:600;border-radius:var(--radius-sm);background:var(--bg-elevated);color:var(--text-primary);box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                Tạo mới
              </button>
              <button id="pl-tab-yt" class="pill-btn" style="flex:1;text-align:center;min-height:34px;font-size:0.86rem;font-weight:600;border-radius:var(--radius-sm);display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--text-secondary);background:transparent;">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                Từ liên kết
              </button>
            </div>

            <!-- Tab 1: Tạo playlist mới -->
            <div id="pl-panel-custom">
              <div class="form-group" style="margin-bottom:16px;">
                <label class="form-label">Tên danh sách</label>
                <input type="text" id="pl-name-input" class="form-input" placeholder="Ví dụ: Nhạc chill, Yêu thích..." autofocus>
              </div>
              <div style="display:flex;justify-content:flex-end;gap:8px;">
                <button class="pill-btn" id="modal-cancel">Hủy</button>
                <button class="btn-primary" id="modal-submit" style="min-height:38px;padding:0 18px;border-radius:20px;font-weight:600;">Tạo playlist</button>
              </div>
            </div>

            <!-- Tab 2: Nhập từ liên kết -->
            <div id="pl-panel-yt" style="display:none;">
              <p style="font-size:0.84rem;color:var(--text-muted);margin:0 0 10px;">
                Dán liên kết danh sách phát hoặc video để nghe trực tuyến hoặc tải về máy.
              </p>
              <div class="form-group" style="display:flex;gap:8px;margin-bottom:12px;">
                <input type="text" id="yt-playlist-url-input" class="form-input" style="flex:1;" placeholder="https://...">
                <button class="btn-primary" id="btn-fetch-yt-pl" style="white-space:nowrap;min-height:38px;padding:0 14px;border-radius:18px;">
                  Đọc link
                </button>
              </div>

              <div id="yt-playlist-loading" style="display:none;text-align:center;padding:16px 0;color:var(--text-secondary);font-size:0.86rem;">
                <div class="skeleton-shimmer" style="width:36px;height:36px;border-radius:50%;margin:0 auto 8px;"></div>
                Đang đọc danh sách phát...
              </div>

              <div id="yt-playlist-error" style="display:none;color:var(--danger, #ef4444);font-size:0.84rem;margin-bottom:10px;"></div>

              <div id="yt-playlist-preview" style="display:none;">
                <div style="padding:10px 12px;background:var(--surface-variant);border-radius:var(--radius-md);margin-bottom:10px;">
                  <div id="yt-pl-title" style="font-weight:700;font-size:0.92rem;color:var(--text-primary);margin-bottom:2px;"></div>
                  <div id="yt-pl-meta" style="font-size:0.8rem;color:var(--text-muted);"></div>
                </div>

                <div id="yt-pl-tracklist" style="max-height:160px;overflow-y:auto;display:flex;flex-direction:column;gap:4px;margin-bottom:12px;padding-right:4px;"></div>

                <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;">
                  <button class="btn-secondary" id="btn-stream-yt-pl" style="min-height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;">
                    ${icons.play} Nghe online
                  </button>
                  <button class="btn-primary" id="btn-download-yt-pl" style="min-height:36px;padding:0 14px;border-radius:18px;display:inline-flex;align-items:center;gap:6px;font-size:0.85rem;font-weight:600;">
                    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Lưu về offline
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('create-pl-modal');
    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.querySelector('#modal-cancel')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Tabs switching
    const tabCustom = modal.querySelector('#pl-tab-custom');
    const tabYt = modal.querySelector('#pl-tab-yt');
    const panelCustom = modal.querySelector('#pl-panel-custom');
    const panelYt = modal.querySelector('#pl-panel-yt');

    const selectTab = (tab) => {
      if (tab === 'custom') {
        tabCustom.style.background = 'var(--bg-elevated)';
        tabCustom.style.color = 'var(--text-primary)';
        tabCustom.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        tabYt.style.background = 'transparent';
        tabYt.style.color = 'var(--text-secondary)';
        tabYt.style.boxShadow = 'none';
        panelCustom.style.display = 'block';
        panelYt.style.display = 'none';
        modal.querySelector('#pl-name-input')?.focus();
      } else {
        tabYt.style.background = 'var(--bg-elevated)';
        tabYt.style.color = 'var(--text-primary)';
        tabYt.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
        tabCustom.style.background = 'transparent';
        tabCustom.style.color = 'var(--text-secondary)';
        tabCustom.style.boxShadow = 'none';
        panelCustom.style.display = 'none';
        panelYt.style.display = 'block';
        modal.querySelector('#yt-playlist-url-input')?.focus();
      }
    };

    tabCustom.addEventListener('click', () => selectTab('custom'));
    tabYt.addEventListener('click', () => selectTab('yt'));
    if (initialTab === 'yt') selectTab('yt');

    // Create Custom Playlist submit
    modal.querySelector('#modal-submit').addEventListener('click', async () => {
      const name = document.getElementById('pl-name-input').value.trim();
      if (!name) return alert('Vui lòng nhập tên danh sách');

      try {
        const created = await api.playlists.create(name);
        modal.remove();
        await this.render(created.id);
      } catch (err) {
        alert('Lỗi tạo playlist: ' + err.message);
      }
    });

    modal.querySelector('#pl-name-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        modal.querySelector('#modal-submit').click();
      }
    });

    // YouTube Import Logic
    const urlInput = modal.querySelector('#yt-playlist-url-input');
    const fetchBtn = modal.querySelector('#btn-fetch-yt-pl');
    const previewEl = modal.querySelector('#yt-playlist-preview');
    const loadingEl = modal.querySelector('#yt-playlist-loading');
    const errorEl = modal.querySelector('#yt-playlist-error');

    let loadedInfo = null;

    const doFetch = async () => {
      const url = urlInput.value.trim();
      if (!url) return;
      errorEl.style.display = 'none';
      previewEl.style.display = 'none';
      loadingEl.style.display = 'block';
      fetchBtn.disabled = true;

      try {
        const info = await api.youtube.info(url);
        loadingEl.style.display = 'none';
        fetchBtn.disabled = false;

        const items = info.items || (info.isPlaylist ? [] : [info]);
        if (!items || items.length === 0) {
          throw new Error('Không tìm thấy bài hát nào trong playlist này');
        }

        loadedInfo = {
          title: info.title || 'Danh sách phát',
          channel: info.channel || '',
          items
        };

        modal.querySelector('#yt-pl-title').textContent = loadedInfo.title;
        modal.querySelector('#yt-pl-meta').textContent = `${loadedInfo.channel ? loadedInfo.channel + ' • ' : ''}${items.length} bài hát`;

        const tracklistEl = modal.querySelector('#yt-pl-tracklist');
        tracklistEl.innerHTML = items.map((it, idx) => `
          <div style="display:flex;align-items:center;gap:8px;font-size:0.82rem;padding:4px 0;border-bottom:1px solid var(--border-color);">
            <span style="color:var(--text-muted);min-width:20px;">${idx + 1}</span>
            <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
              <span style="font-weight:500;color:var(--text-primary);">${this.escapeHtml(it.title)}</span>
              <span style="color:var(--text-muted);margin-left:6px;">${this.escapeHtml(it.channel || '')}</span>
            </div>
          </div>
        `).join('');

        previewEl.style.display = 'block';
      } catch (err) {
        loadingEl.style.display = 'none';
        fetchBtn.disabled = false;
        errorEl.textContent = 'Lỗi: ' + (err.message || 'Không thể đọc playlist này');
        errorEl.style.display = 'block';
      }
    };

    fetchBtn.addEventListener('click', doFetch);
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doFetch();
    });

    modal.querySelector('#btn-stream-yt-pl').addEventListener('click', () => {
      if (!loadedInfo || !loadedInfo.items.length) return;
      const onlineTracks = loadedInfo.items.map(it => ({
        id: `yt_${it.id}_audio`,
        youtubeId: it.id,
        title: it.title,
        artist: it.channel || 'Nghệ sĩ',
        album: loadedInfo.title || 'Danh sách phát',
        duration_sec: it.duration || 0,
        media_type: 'audio',
        isOnline: true,
        thumbnail_url: it.thumbnail
      }));
      store.set({ queue: onlineTracks, originalQueue: onlineTracks, isPlaylistMode: false });
      this.player.loadOnlineTrack(onlineTracks[0], true);
      modal.remove();
      this.player?.showToast(`Đang phát online playlist "${loadedInfo.title}" (${onlineTracks.length} bài)`);
    });

    modal.querySelector('#btn-download-yt-pl').addEventListener('click', async () => {
      if (!loadedInfo || !loadedInfo.items.length) return;
      const btn = modal.querySelector('#btn-download-yt-pl');
      animateFlyToCorner(btn, { thumbnail: loadedInfo.thumbnail });
      btn.disabled = true;
      btn.textContent = 'Đang bắt đầu tải...';
      try {
        await api.youtube.download({
          items: loadedInfo.items,
          createPlaylist: true,
          playlistName: loadedInfo.title || 'Danh sách phát',
          mediaType: 'audio',
          quality: '720p'
        });
        modal.remove();
        this.player?.showToast(`Đã thêm ${loadedInfo.items.length} bài hát vào hàng đợi tải offline cho playlist "${loadedInfo.title}"!`, 4000);
        await this.renderPlaylistsOverview();
      } catch (err) {
        btn.disabled = false;
        btn.textContent = 'Lưu về offline';
        alert('Lỗi tải playlist: ' + err.message);
      }
    });
  }

  showPlaylistMenu(pl) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="pl-menu-modal">
        <div class="modal-card" style="max-width:320px;">
          <div class="modal-header">
            <h3 class="modal-title">${this.escapeHtml(pl.name)}</h3>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
            <button class="btn-secondary" id="pl-opt-avatar" style="justify-content:flex-start;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
              <span>Đổi ảnh đại diện</span>
            </button>
            <button class="btn-secondary" id="pl-opt-rename" style="justify-content:flex-start;">
              ${icons.edit} Đổi tên playlist
            </button>
            <button class="btn-danger" id="pl-opt-delete" style="justify-content:flex-start;">
              ${icons.trash} Xóa playlist
            </button>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('pl-menu-modal');
    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#pl-opt-avatar')?.addEventListener('click', () => {
      modal.remove();
      this.showAvatarModal(pl);
    });

    modal.querySelector('#pl-opt-rename').addEventListener('click', () => {
      modal.remove();
      const newName = prompt('Nhập tên mới cho playlist:', pl.name);
      if (newName && newName.trim() && newName.trim() !== pl.name) {
        api.playlists.rename(pl.id, newName.trim()).then(() => this.renderPlaylistsOverview());
      }
    });

    modal.querySelector('#pl-opt-delete').addEventListener('click', async () => {
      if (!confirm(`Xóa playlist "${pl.name}"? Các bài hát trong thư viện vẫn sẽ được giữ lại.`)) return;
      try {
        await api.playlists.delete(pl.id);
        modal.remove();
        await this.renderPlaylistsOverview();
      } catch (err) {
        alert('Lỗi xóa playlist: ' + err.message);
      }
    });
  }

  async showAvatarModal(pl) {
    let fullPl = pl;
    if (!fullPl.tracks) {
      try {
        fullPl = await api.playlists.get(pl.id);
      } catch {}
    }

    const modalContainer = document.getElementById('modal-container');
    const plId = pl.id;
    const thumbUrl = `/api/playlists/${plId}/thumb?t=${Date.now()}`;

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="pl-avatar-modal">
        <div class="modal-card" style="max-width:340px;width:90%;">
          <div class="modal-header">
            <h3 class="modal-title">Ảnh bìa Playlist</h3>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:14px;align-items:center;padding:16px;">
            
            <!-- Current Avatar Preview & Click-to-upload -->
            <div class="pl-avatar-preview-wrap" style="width:140px;height:140px;border-radius:16px;overflow:hidden;position:relative;background:var(--bg-surface);box-shadow:0 4px 16px rgba(0,0,0,0.3);border:1px solid var(--border-subtle);">
              <img id="pl-avatar-img-preview" src="${thumbUrl}" alt="Preview" style="width:100%;height:100%;object-fit:cover;" onerror="this.src='/api/playlists/${plId}/thumb';">
              <label for="pl-avatar-file-input" class="pl-avatar-upload-overlay" title="Bấm để chọn ảnh từ máy">
                <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                <span style="font-size:0.75rem;margin-top:3px;font-weight:600;">Đổi ảnh</span>
              </label>
              <input type="file" id="pl-avatar-file-input" accept="image/*" style="display:none;">
            </div>

            <!-- Upload file button -->
            <button id="btn-pick-avatar-file" class="btn-primary" style="width:100%;min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:600;font-size:0.88rem;border-radius:20px;">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              <span>Chọn ảnh từ thư viện</span>
            </button>

            <!-- Reset to default button -->
            <button id="btn-reset-pl-avatar" class="btn-secondary" style="width:100%;min-height:36px;font-size:0.82rem;justify-content:center;border-radius:20px;color:var(--text-secondary);">
              <span>Dùng ảnh bìa mặc định</span>
            </button>

          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('pl-avatar-modal');
    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    const fileInput = modal.querySelector('#pl-avatar-file-input');
    const pickBtn = modal.querySelector('#btn-pick-avatar-file');
    pickBtn.addEventListener('click', () => fileInput.click());

    // File selected: upload via API
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      const fd = new FormData();
      fd.append('avatar', file);

      pickBtn.disabled = true;
      pickBtn.textContent = 'Đang tải ảnh lên...';

      try {
        await api.playlists.uploadAvatar(plId, fd);
        modal.remove();
        if (this.activePlaylistId === plId) {
          await this.renderPlaylistDetail(plId);
        } else {
          await this.renderPlaylistsOverview();
        }
      } catch (err) {
        alert('Lỗi tải ảnh lên: ' + err.message);
        pickBtn.disabled = false;
        pickBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span>Chọn ảnh từ thư viện</span>
        `;
      }
    });

    // Reset avatar button
    modal.querySelector('#btn-reset-pl-avatar').addEventListener('click', async () => {
      try {
        await api.playlists.setAvatar(plId, '');
        modal.remove();
        if (this.activePlaylistId === plId) {
          await this.renderPlaylistDetail(plId);
        } else {
          await this.renderPlaylistsOverview();
        }
      } catch (err) {
        alert('Lỗi xóa ảnh: ' + err.message);
      }
    });
  }

  showPlaylistTrackMenu(track, playlist) {
    const modalContainer = document.getElementById('modal-container');
    modalContainer.innerHTML = `
      <div class="modal-overlay" id="pl-track-menu-modal">
        <div class="modal-card" style="max-width:360px;">
          <div class="modal-header">
            <div class="modal-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escapeHtml(track.title)}</div>
            <button class="icon-btn" id="modal-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="padding:12px;display:flex;flex-direction:column;gap:6px;">
            <button class="btn-secondary" id="opt-play-next" style="justify-content:flex-start;">
              ${icons.play} Phát tiếp theo
            </button>
            <button class="btn-secondary" id="opt-add-another-playlist" style="justify-content:flex-start;">
              ${icons.plus} Thêm vào Playlist khác
            </button>
            <button class="btn-danger" id="opt-remove-pl-track" style="justify-content:flex-start;">
              ${icons.trash} Xóa khỏi playlist này
            </button>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('pl-track-menu-modal');
    modal.querySelector('#modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Play next
    modal.querySelector('#opt-play-next').addEventListener('click', () => {
      const { queue, currentTrack } = store.get();
      const curIdx = queue.findIndex(t => t.id === currentTrack?.id);
      const newQueue = [...queue.filter(t => t.id !== track.id)];
      newQueue.splice(curIdx + 1, 0, track);
      store.set({ queue: newQueue });
      modal.remove();
    });

    // Add to another playlist
    modal.querySelector('#opt-add-another-playlist').addEventListener('click', () => {
      modal.remove();
      showAddToPlaylistModal({ trackIds: [track.id], trackTitle: track.title });
    });

    // Remove from this playlist
    modal.querySelector('#opt-remove-pl-track').addEventListener('click', async () => {
      modal.remove();
      try {
        await api.playlists.removeTrack(playlist.id, track.id);
        await this.renderPlaylistDetail(playlist.id);
      } catch (err) {
        alert('Lỗi: ' + err.message);
      }
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
