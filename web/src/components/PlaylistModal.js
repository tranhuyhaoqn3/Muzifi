import { api } from '../api.js';
import { store } from '../state.js';
import { icons } from './icons.js';
import { getAllOfflineTracks } from '../offlineStorage.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function showToast(message, durationMs = 2000) {
  // Top toast removed per user request
}

/**
 * Modal to add one or multiple tracks into a playlist.
 * Works seamlessly from both Library and Playlist detail views.
 */
export async function showAddToPlaylistModal({ trackIds = [], trackTitle = '', onSuccess = null }) {
  if (!trackIds || trackIds.length === 0) return;

  const modalContainer = document.getElementById('modal-container');
  const titleDisplay = trackTitle || `${trackIds.length} bài hát`;

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="add-to-pl-modal">
      <div class="modal-card" style="max-width:440px;">
        <div class="modal-header">
          <div style="min-width:0;flex:1;">
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              ${icons.queue} Thêm vào Playlist
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px;">
              ${escapeHtml(titleDisplay)}
            </div>
          </div>
          <button class="icon-btn" id="modal-close" style="margin-left:8px;">${icons.x}</button>
        </div>

        <div class="modal-body" style="padding:16px;">
          <!-- Quick create playlist row -->
          <div style="margin-bottom:16px;">
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:6px;display:block;">
              Tạo playlist mới
            </label>
            <div style="display:flex;gap:8px;">
              <input type="text" id="quick-create-pl-input" class="form-input" placeholder="Nhập tên playlist mới..." style="padding:8px 12px;font-size:0.9rem;">
              <button id="btn-quick-create-pl" class="btn-primary" style="white-space:nowrap;min-height:38px;padding:0 14px;font-size:0.85rem;">
                ${icons.plus} Tạo & Thêm
              </button>
            </div>
          </div>

          <!-- Existing playlists list -->
          <div>
            <label style="font-size:0.75rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:8px;display:block;">
              Chọn playlist có sẵn
            </label>
            <div id="add-pl-list" style="display:flex;flex-direction:column;gap:8px;max-height:260px;overflow-y:auto;padding-right:2px;">
              <div style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.85rem;">
                Đang tải danh sách playlist...
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = document.getElementById('add-to-pl-modal');
  const closeBtn = modal.querySelector('#modal-close');
  const closeModal = () => modal.remove();

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const listEl = modal.querySelector('#add-pl-list');
  const inputEl = modal.querySelector('#quick-create-pl-input');
  const createBtn = modal.querySelector('#btn-quick-create-pl');

  // Helper to add tracks to a specific playlist ID
  const addTracksToPlaylist = async (playlistId, playlistName) => {
    try {
      await api.playlists.addTracks(playlistId, trackIds);
      showToast(`Đã thêm vào "${playlistName}"!`);
      closeModal();
      if (onSuccess) onSuccess({ id: playlistId, name: playlistName });
    } catch (err) {
      const list = JSON.parse(localStorage.getItem('muzifi_local_playlists') || '[]');
      const targetPl = list.find(p => p.id === playlistId);
      if (targetPl) {
        if (!targetPl.track_ids) targetPl.track_ids = [];
        trackIds.forEach(id => {
          if (!targetPl.track_ids.includes(id)) targetPl.track_ids.push(id);
        });
        targetPl.track_count = targetPl.track_ids.length;
        localStorage.setItem('muzifi_local_playlists', JSON.stringify(list));
        closeModal();
        if (onSuccess) onSuccess({ id: playlistId, name: playlistName });
        return;
      }
      alert('Lỗi thêm vào playlist: ' + err.message);
    }
  };

  // Handler for creating a new playlist & immediately adding tracks
  const handleCreateNew = async () => {
    const name = inputEl.value.trim();
    if (!name) {
      inputEl.focus();
      return;
    }
    createBtn.disabled = true;
    createBtn.textContent = 'Đang tạo...';
    try {
      const newPl = await api.playlists.create(name);
      await api.playlists.addTracks(newPl.id, trackIds);
      showToast(`Đã tạo "${newPl.name}" và thêm ${titleDisplay}!`);
      closeModal();
      if (onSuccess) onSuccess(newPl);
    } catch (err) {
      const localPl = {
        id: `local_pl_${Date.now()}`,
        name: name,
        track_count: trackIds.length,
        tracks: [],
        track_ids: [...trackIds],
        updated_at: new Date().toISOString()
      };
      const list = JSON.parse(localStorage.getItem('muzifi_local_playlists') || '[]');
      list.unshift(localPl);
      localStorage.setItem('muzifi_local_playlists', JSON.stringify(list));
      closeModal();
      if (onSuccess) onSuccess(localPl);
    }
  };

  createBtn.addEventListener('click', handleCreateNew);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreateNew();
    }
  });

  // Fetch playlists
  let playlists = [];
  try {
    playlists = await api.playlists.list();
  } catch (err) {
    try {
      playlists = JSON.parse(localStorage.getItem('muzifi_local_playlists') || '[]');
    } catch {
      playlists = [];
    }
  }
  store.set({ playlists });

    if (!playlists || playlists.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:20px 10px;color:var(--text-muted);font-size:0.85rem;background:var(--bg-surface);border-radius:var(--radius-md);">
          Chưa có playlist nào. Hãy nhập tên ở trên để tạo ngay!
        </div>
      `;
      return;
    }

    listEl.innerHTML = playlists.map(pl => `
      <div class="track-item pl-select-item" data-id="${pl.id}" style="padding:10px 12px;border-radius:var(--radius-md);cursor:pointer;border:1px solid var(--border-subtle);background:var(--bg-surface);">
        <div class="track-thumb-wrap" style="width:40px;height:40px;background:var(--accent-gradient);display:flex;align-items:center;justify-content:center;color:#fff;border-radius:8px;flex-shrink:0;overflow:hidden;position:relative;">
          <img src="/api/playlists/${pl.id}/thumb?t=${encodeURIComponent(pl.updated_at || '')}" alt="" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
          <div style="display:none;width:100%;height:100%;align-items:center;justify-content:center;">${icons.queue}</div>
        </div>
        <div class="track-meta" style="min-width:0;flex:1;">
          <div class="track-title" style="font-size:0.95rem;font-weight:600;">${escapeHtml(pl.name)}</div>
          <div class="track-sub" style="font-size:0.78rem;color:var(--text-muted);">${pl.track_count || 0} bài hát</div>
        </div>
        <button class="btn-secondary" style="min-height:32px;padding:0 10px;font-size:0.8rem;border-radius:16px;">
          + Thêm
        </button>
      </div>
    `).join('');

    listEl.querySelectorAll('.pl-select-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.dataset.id;
        const pl = playlists.find(p => p.id === id);
        if (pl) addTracksToPlaylist(pl.id, pl.name);
      });
    });
}

/**
 * Modal to pick tracks from Library to add into a given playlist.
 * Used inside PlaylistDetail view.
 */
export async function showAddTracksToPlaylistModal({ playlistId, playlistName, currentTrackIds = [], onSuccess = null }) {
  const modalContainer = document.getElementById('modal-container');
  const existingSet = new Set(currentTrackIds);

  modalContainer.innerHTML = `
    <div class="modal-overlay" id="picker-to-pl-modal">
      <div class="modal-card" style="max-width:540px;height:85vh;display:flex;flex-direction:column;">
        <div class="modal-header">
          <div style="min-width:0;flex:1;">
            <div class="modal-title" style="display:flex;align-items:center;gap:8px;">
              ${icons.plus} Thêm bài vào "${escapeHtml(playlistName)}"
            </div>
            <div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
              Chọn các bài hát từ thư viện
            </div>
          </div>
          <button class="icon-btn" id="modal-close">${icons.x}</button>
        </div>

        <div style="padding:12px 16px;border-bottom:1px solid var(--border-subtle);display:flex;align-items:center;gap:12px;">
          <!-- Search input -->
          <div class="search-input-box" style="margin:0;flex:1;">
            ${icons.search}
            <input type="text" id="picker-search-input" placeholder="Tìm kiếm bài hát, ca sĩ..." style="font-size:0.9rem;">
          </div>
          <span id="picker-total-indicator" style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">0 bài</span>
        </div>

        <div id="picker-tracks-list" style="flex:1;overflow-y:auto;padding:10px 16px;display:flex;flex-direction:column;gap:6px;">
          <div style="text-align:center;padding:30px;color:var(--text-muted);">
            Đang tải thư viện bài hát...
          </div>
        </div>

        <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-top:1px solid var(--border-subtle);">
          <span id="picker-selected-summary" style="font-size:0.85rem;font-weight:600;color:var(--text-main);">
            Đã chọn 0 bài mới
          </span>
          <div style="display:flex;gap:8px;">
            <button class="btn-secondary" id="picker-cancel-btn" style="min-height:36px;padding:0 14px;">Hủy</button>
            <button class="btn-primary" id="picker-submit-btn" style="min-height:36px;padding:0 16px;" disabled>
              + Thêm vào Playlist
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const modal = document.getElementById('picker-to-pl-modal');
  const closeBtn = modal.querySelector('#modal-close');
  const cancelBtn = modal.querySelector('#picker-cancel-btn');
  const submitBtn = modal.querySelector('#picker-submit-btn');
  const searchInput = modal.querySelector('#picker-search-input');
  const listEl = modal.querySelector('#picker-tracks-list');
  const countIndicator = modal.querySelector('#picker-total-indicator');
  const summaryEl = modal.querySelector('#picker-selected-summary');

  const closeModal = () => modal.remove();
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  let allLibraryTracks = [];
  let searchQuery = '';
  const selectedNewIds = new Set();

  const updateSummaryUI = () => {
    const count = selectedNewIds.size;
    summaryEl.textContent = `Đã chọn ${count} bài mới`;
    submitBtn.disabled = count === 0;
    submitBtn.textContent = count > 0 ? `+ Thêm (${count} bài)` : '+ Thêm vào Playlist';
  };

  const renderFilteredTracks = () => {
    let filtered = allLibraryTracks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) || 
        (t.artist && t.artist.toLowerCase().includes(q))
      );
    }

    countIndicator.textContent = `${filtered.length} bài`;

    if (filtered.length === 0) {
      listEl.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--text-muted);font-size:0.9rem;">
          Không tìm thấy bài hát nào phù hợp.
        </div>
      `;
      return;
    }

    listEl.innerHTML = filtered.map(t => {
      const isAlreadyIn = existingSet.has(t.id);
      const isChecked = isAlreadyIn || selectedNewIds.has(t.id);

      return `
        <label class="track-item picker-row ${isAlreadyIn ? 'already-in' : ''}" style="padding:8px 10px;border-radius:var(--radius-md);cursor:${isAlreadyIn ? 'default' : 'pointer'};opacity:${isAlreadyIn ? '0.65' : '1'};">
          <input type="checkbox" class="picker-check" data-id="${t.id}" ${isChecked ? 'checked' : ''} ${isAlreadyIn ? 'disabled' : ''} style="margin-right:10px;width:18px;height:18px;accent-color:var(--accent-primary);">
          
          <div class="track-thumb-wrap" style="width:38px;height:38px;flex-shrink:0;">
            <img class="track-thumb" src="/api/tracks/${t.id}/thumb" alt="" loading="lazy">
          </div>

          <div class="track-meta" style="min-width:0;flex:1;">
            <div class="track-title" style="font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.title)}</div>
            <div class="track-sub" style="font-size:0.75rem;color:var(--text-muted);">
              <span>${escapeHtml(t.artist || 'Nghệ sĩ')}</span>
            </div>
          </div>

          ${isAlreadyIn ? `
            <span style="font-size:0.75rem;color:var(--accent-primary);background:rgba(99,102,241,0.12);padding:2px 8px;border-radius:12px;white-space:nowrap;">
              Đã có
            </span>
          ` : ''}
        </label>
      `;
    }).join('');

    listEl.querySelectorAll('.picker-check').forEach(chk => {
      chk.addEventListener('change', () => {
        const id = chk.dataset.id;
        if (chk.checked) {
          selectedNewIds.add(id);
        } else {
          selectedNewIds.delete(id);
        }
        updateSummaryUI();
      });
    });
  };

  // Search input
  let searchTimer = null;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = e.target.value.trim();
      renderFilteredTracks();
    }, 200);
  });

  // Submit button
  submitBtn.addEventListener('click', async () => {
    if (selectedNewIds.size === 0) return;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Đang thêm...';
    const idsToAdd = Array.from(selectedNewIds);
    try {
      await api.playlists.addTracks(playlistId, idsToAdd);
      showToast(`Đã thêm ${idsToAdd.length} bài vào "${playlistName}"!`);
      closeModal();
      if (onSuccess) onSuccess();
    } catch (err) {
      const list = JSON.parse(localStorage.getItem('muzifi_local_playlists') || '[]');
      const targetPl = list.find(p => p.id === playlistId);
      if (targetPl) {
        if (!targetPl.track_ids) targetPl.track_ids = [];
        idsToAdd.forEach(id => {
          if (!targetPl.track_ids.includes(id)) targetPl.track_ids.push(id);
        });
        targetPl.track_count = targetPl.track_ids.length;
        localStorage.setItem('muzifi_local_playlists', JSON.stringify(list));
        closeModal();
        if (onSuccess) onSuccess();
        return;
      }
      alert('Lỗi thêm bài: ' + err.message);
      submitBtn.disabled = false;
      updateSummaryUI();
    }
  });

  // Fetch library tracks
  try {
    const res = await api.tracks.list({ sort: 'created_desc' });
    allLibraryTracks = res.tracks || [];
  } catch (err) {
    try {
      allLibraryTracks = await getAllOfflineTracks();
    } catch {
      allLibraryTracks = [];
    }
  }
  renderFilteredTracks();
}
