import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';
import { UserModal } from './UserModal.js';
import { animateFlyToCorner } from './flyAnim.js';

export class OnlineView {
  constructor(playerEngine) {
    this.player = playerEngine;
    this.container = document.getElementById('main-view');
    this.activeChip = 'all'; // 'all' | 'subscriptions' | 'liked' | 'playlists'
    this.feedItems = null;
    this.searchItems = null;
    this.currentQuery = '';
    this.currentUser = null;
    this.meData = null;
    this.page = 1;
    this.isLoadingMore = false;
    this.hasMore = true;
    this.renderedVideoIds = new Set();
    this.observer = null;
    this.allItems = [];
  }

  async render() {
    try {
      const auth = await api.auth.check();
      this.currentUser = auth.user;
    } catch {
      this.currentUser = null;
    }

    const isGoogle = Boolean(this.currentUser?.isGoogle);

    this.container.innerHTML = `
      <div class="online-view">
        <!-- Search Bar (YouTube Style with Suggestions) -->
        <div class="search-bar-row ytm-search-row" style="margin-bottom:14px;position:relative;">
          <div class="search-input-box" style="position:relative;">
            ${icons.search}
            <input type="text" id="online-search-input" autocomplete="off" spellcheck="false" placeholder="Tìm kiếm bài hát, video trực tuyến..." value="${this.escapeHtml(this.currentQuery || '')}">
            <button id="online-search-clear" class="icon-btn" style="min-height:32px;min-width:32px;${this.currentQuery ? 'display:inline-flex;' : 'display:none;'}">${icons.x}</button>
          </div>
          <button id="btn-online-search-submit" class="btn-primary" style="min-height:44px;padding:0 18px;font-weight:600;">
            Tìm
          </button>
          <!-- Suggestions Dropdown -->
          <div id="search-suggestions-dropdown" class="search-suggestions-dropdown" style="display:none;"></div>
        </div>

        <!-- Dynamic Feed & Content Area -->
        <div id="online-content-area">
          <div id="online-feed-list" class="yt-video-grid">
            <div class="empty-state" style="grid-column: 1 / -1;">
              <p class="empty-title">Đang tải dữ liệu trực tuyến...</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();

    const items = this.currentQuery ? this.searchItems : this.feedItems;
    if (items && items.length > 0) {
      this.renderVideoCards(items, Boolean(this.currentQuery));
    } else {
      await this.fetchFeed();
    }
  }

  bindEvents() {
    const searchInput = document.getElementById('online-search-input');
    const searchBtn = document.getElementById('btn-online-search-submit');
    const clearBtn = document.getElementById('online-search-clear');
    const dropdown = document.getElementById('search-suggestions-dropdown');

    let suggestTimer = null;
    let selectedSuggestIndex = -1;
    let currentSuggestions = [];

    const hideDropdown = () => {
      if (dropdown) {
        dropdown.style.display = 'none';
        dropdown.innerHTML = '';
      }
      selectedSuggestIndex = -1;
      currentSuggestions = [];
    };

    const renderSuggestions = (suggestions) => {
      if (!dropdown) return;
      if (!suggestions || suggestions.length === 0) {
        hideDropdown();
        return;
      }
      currentSuggestions = suggestions;
      selectedSuggestIndex = -1;

      dropdown.innerHTML = suggestions.map((item, idx) => {
        const escaped = this.escapeHtml(item);
        return `
          <div class="search-suggestion-item" data-index="${idx}" data-val="${escaped}">
            <span class="suggestion-search-icon">${icons.search}</span>
            <span class="suggestion-text">${escaped}</span>
            <button class="suggestion-insert-btn" type="button" data-val="${escaped}" title="Điền vào ô tìm kiếm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"/>
                <polyline points="7 7 17 7 17 17"/>
              </svg>
            </button>
          </div>
        `;
      }).join('');

      dropdown.style.display = 'block';

      dropdown.querySelectorAll('.search-suggestion-item').forEach(el => {
        el.addEventListener('mousedown', (e) => {
          if (e.target.closest('.suggestion-insert-btn')) {
            e.preventDefault();
            e.stopPropagation();
            const val = e.target.closest('.suggestion-insert-btn').dataset.val;
            if (searchInput) {
              searchInput.value = val;
              searchInput.focus();
              if (clearBtn) clearBtn.style.display = 'inline-flex';
              fetchSuggest(val);
            }
            return;
          }

          e.preventDefault();
          const val = el.dataset.val;
          if (searchInput) searchInput.value = val;
          hideDropdown();
          this.search(val);
        });
      });
    };

    const fetchSuggest = async (q) => {
      if (!q || !q.trim()) {
        hideDropdown();
        return;
      }
      try {
        const res = await api.youtube.suggest(q.trim());
        if (searchInput && searchInput.value.trim() === q.trim()) {
          renderSuggestions(res.suggestions || []);
        }
      } catch {
        // silent fail
      }
    };

    const doSearch = () => {
      const q = searchInput?.value.trim();
      hideDropdown();
      if (!q) return;
      this.search(q);
    };

    searchBtn?.addEventListener('click', doSearch);

    searchInput?.addEventListener('input', () => {
      const q = searchInput.value;
      if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
      clearTimeout(suggestTimer);
      if (!q.trim()) {
        hideDropdown();
        return;
      }
      suggestTimer = setTimeout(() => {
        fetchSuggest(q);
      }, 150);
    });

    searchInput?.addEventListener('focus', () => {
      const q = searchInput.value.trim();
      if (q && currentSuggestions.length > 0) {
        dropdown.style.display = 'block';
      } else if (q) {
        fetchSuggest(q);
      }
    });

    searchInput?.addEventListener('keydown', (e) => {
      if (dropdown && dropdown.style.display !== 'none' && currentSuggestions.length > 0) {
        const items = dropdown.querySelectorAll('.search-suggestion-item');
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          selectedSuggestIndex = (selectedSuggestIndex + 1) % items.length;
          items.forEach((it, idx) => it.classList.toggle('active', idx === selectedSuggestIndex));
          if (selectedSuggestIndex >= 0 && items[selectedSuggestIndex]) {
            items[selectedSuggestIndex].scrollIntoView({ block: 'nearest' });
            searchInput.value = currentSuggestions[selectedSuggestIndex];
          }
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          selectedSuggestIndex = (selectedSuggestIndex - 1 + items.length) % items.length;
          items.forEach((it, idx) => it.classList.toggle('active', idx === selectedSuggestIndex));
          if (selectedSuggestIndex >= 0 && items[selectedSuggestIndex]) {
            items[selectedSuggestIndex].scrollIntoView({ block: 'nearest' });
            searchInput.value = currentSuggestions[selectedSuggestIndex];
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          hideDropdown();
          return;
        }
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        doSearch();
      }
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.ytm-search-row')) {
        hideDropdown();
      }
    });

    clearBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.currentQuery = '';
      this.searchItems = null;
      clearBtn.style.display = 'none';
      hideDropdown();
      if (this.feedItems && this.feedItems.length > 0) {
        this.renderVideoCards(this.feedItems, false);
      } else {
        this.fetchFeed();
      }
    });

    window.addEventListener('online', () => {
      if (store.get().activeTab === 'online') {
        this.fetchFeed();
      }
    });
    window.addEventListener('offline', () => {
      if (store.get().activeTab === 'online') {
        const listEl = document.getElementById('online-feed-list');
        this.renderOfflineState(listEl);
      }
    });
  }

  isOffline(err) {
    if (!navigator.onLine) return true;
    if (!err) return false;
    const msg = (err.message || '').toLowerCase();
    return (
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('offline') ||
      msg.includes('failed') ||
      msg.includes('timeout') ||
      msg.includes('503') ||
      msg.includes('500') ||
      msg.includes('getaddrinfo') ||
      msg.includes('enotfound') ||
      msg.includes('urlopen') ||
      msg.includes('youtube')
    );
  }

  renderOfflineState(container) {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1; padding: 48px 20px; text-align: center;">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(255, 255, 255, 0.06); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-muted);">
            <line x1="1" y1="1" x2="23" y2="23"></line>
            <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
            <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
            <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
            <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
            <line x1="12" y1="20" x2="12.01" y2="20"></line>
          </svg>
        </div>
        <p class="empty-title" style="font-size: 1.1rem; font-weight: 600; margin-bottom: 8px;">Bạn đang offline</p>
        <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 380px; margin: 0 auto 20px; line-height: 1.5;">
          Không có kết nối mạng để nghe nhạc trực tuyến. Hãy chuyển sang nghe nhạc ở thư viện của bạn.
        </p>
        <button id="btn-goto-library" class="btn-primary" style="margin: 0 auto; min-height: 42px; padding: 0 22px; border-radius: 22px; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; font-size: 0.9rem; cursor: pointer;">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
          </svg>
          <span>Chuyển sang nghe nhạc ở Thư viện</span>
        </button>
      </div>
    `;

    container.querySelector('#btn-goto-library')?.addEventListener('click', () => {
      const navLib = document.querySelector('.nav-item[data-tab="library"]');
      if (navLib) {
        navLib.click();
      } else if (window.app?.switchTab) {
        window.app.switchTab('library');
      } else {
        window.location.hash = '#library';
      }
    });
  }

  async switchChip(chip) {
    this.activeChip = chip;
    this.container.querySelectorAll('.yt-chip[data-chip]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.chip === chip);
    });
    await this.loadActiveChipContent();
  }

  async loadActiveChipContent(forceRefresh = false) {
    const contentArea = document.getElementById('online-content-area');
    if (!contentArea) return;

    if (this.activeChip === 'all') {
      contentArea.innerHTML = `
        <div id="online-feed-list" class="yt-video-grid">
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p class="empty-title">Đang tải dữ liệu trực tuyến...</p>
          </div>
        </div>
      `;
      const itemsToRender = this.currentQuery ? this.searchItems : this.feedItems;
      if (itemsToRender && itemsToRender.length > 0 && !forceRefresh) {
        this.renderVideoCards(itemsToRender, Boolean(this.currentQuery));
      } else {
        if (this.currentQuery) {
          await this.search(this.currentQuery);
        } else {
          await this.fetchFeed();
        }
      }
      return;
    }

    const isGoogle = Boolean(this.currentUser?.isGoogle);

    // If user is not logged in to Google, show prompt
    if (!isGoogle) {
      this.renderGooglePrompt(contentArea, this.activeChip);
      return;
    }

    contentArea.innerHTML = `
      <div class="empty-state">
        <p class="empty-title">Đang tải dữ liệu trực tuyến...</p>
      </div>
    `;

    try {
      if (!this.meData || forceRefresh) {
        this.meData = await api.youtube.meData();
      }

      if (this.activeChip === 'subscriptions') {
        this.renderSubscriptions(this.meData?.subscriptions || []);
      } else if (this.activeChip === 'liked') {
        this.renderLikedVideos(this.meData?.liked || []);
      } else if (this.activeChip === 'playlists') {
        this.renderPlaylists(this.meData?.playlists || []);
      }
    } catch (err) {
      contentArea.innerHTML = `
        <div class="empty-state">
          <p class="empty-title" style="color:#ef4444;">Không thể tải dữ liệu</p>
          <p style="font-size:0.85rem;color:var(--text-muted);">${this.escapeHtml(err.message)}</p>
        </div>
      `;
    }
  }

  renderGooglePrompt(container, chip) {
    let title = 'Đăng nhập Google để xem kênh đã đăng ký';
    let desc = 'Đăng nhập bằng tài khoản Google để theo dõi các video mới nhất từ các kênh bạn yêu thích.';

    if (chip === 'liked') {
      title = 'Đăng nhập Google để xem Video đã thích';
      desc = 'Toàn bộ danh sách các bài hát và video bạn đã bấm thích sẽ hiển thị tại đây.';
    } else if (chip === 'playlists') {
      title = 'Đăng nhập Google để xem Danh sách phát';
      desc = 'Nghe và phát lại tất cả danh sách phát bạn đã tạo.';
    }

    container.innerHTML = `
      <div class="empty-state" style="padding:60px 20px;max-width:440px;margin:0 auto;text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" style="color:var(--text-muted);">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88C7.55 15.8 9.68 15 12 15s4.45.8 6.14 2.12C16.43 19.18 14.03 20 12 20z"/>
          </svg>
        </div>
        <h3 style="font-size:1.1rem;font-weight:600;margin:0 0 8px;">${title}</h3>
        <p style="font-size:0.85rem;color:var(--text-muted);margin:0 0 20px;line-height:1.4;">${desc}</p>
        <button id="btn-prompt-google-login" class="pill-btn" style="background:#ffffff;color:#1f2937;font-weight:600;font-size:0.88rem;padding:8px 20px;border:none;margin:0 auto;display:inline-flex;align-items:center;gap:8px;">
          <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
          Đăng nhập bằng Google
        </button>
      </div>
    `;

    container.querySelector('#btn-prompt-google-login')?.addEventListener('click', () => {
      new UserModal(this.currentUser, (newUser) => {
        if (window.app?.onUserChanged) window.app.onUserChanged(newUser);
        this.currentUser = newUser;
        this.render();
      }).show();
    });
  }

  renderSubscriptions(subs) {
    const contentArea = document.getElementById('online-content-area');
    if (!contentArea) return;

    if (subs.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Không tìm thấy kênh đăng ký nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Tài khoản Google chưa có kênh đăng ký hoặc hãy bấm nút Đồng bộ.
          </p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:14px;">
        ${subs.map(sub => `
          <div class="subscription-card" style="background:var(--bg-surface);padding:14px;border-radius:var(--radius-lg);border:1px solid var(--border-subtle);display:flex;align-items:center;gap:12px;">
            <img src="${sub.thumbnail || ''}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover;flex-shrink:0;background:var(--bg-elevated);">
            <div style="min-width:0;flex:1;">
              <h4 style="font-size:0.88rem;font-weight:600;margin:0 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(sub.title)}">
                ${this.escapeHtml(sub.title)}
              </h4>
              <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${this.escapeHtml(sub.description || 'Kênh nghệ sĩ')}
              </p>
              <button class="pill-btn btn-search-channel" data-name="${this.escapeHtml(sub.title)}" style="font-size:0.72rem;padding:3px 10px;min-height:26px;">
                Xem video
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    contentArea.querySelectorAll('.btn-search-channel').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const searchInput = document.getElementById('online-search-input');
        if (searchInput) searchInput.value = name;
        this.switchChip('all');
        this.search(name);
      });
    });
  }

  renderLikedVideos(liked) {
    const contentArea = document.getElementById('online-content-area');
    if (!contentArea) return;

    if (liked.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Chưa có video đã thích nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Hãy thích video trực tuyến hoặc bấm nút Đồng bộ lại.
          </p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div id="online-feed-list" class="yt-video-grid"></div>
    `;

    this.renderVideoCards(liked);
  }

  renderPlaylists(playlists) {
    const contentArea = document.getElementById('online-content-area');
    if (!contentArea) return;

    if (playlists.length === 0) {
      contentArea.innerHTML = `
        <div class="empty-state" style="padding:40px 20px;">
          <p class="empty-title">Chưa có Playlist nào</p>
          <p style="color:var(--text-muted);font-size:0.85rem;margin:8px auto 16px;">
            Tài khoản của bạn chưa có playlist nào.
          </p>
        </div>
      `;
      return;
    }

    contentArea.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(240px, 1fr));gap:16px;">
        ${playlists.map(pl => `
          <div class="yt-playlist-card" style="background:var(--bg-surface);border-radius:var(--radius-lg);overflow:hidden;border:1px solid var(--border-subtle);display:flex;flex-direction:column;">
            <div style="position:relative;aspect-ratio:16/9;background:var(--bg-elevated);overflow:hidden;">
              <img src="${pl.thumbnail || ''}" alt="" style="width:100%;height:100%;object-fit:cover;">
              <div style="position:absolute;bottom:0;right:0;background:rgba(0,0,0,0.8);color:#fff;font-size:0.75rem;padding:4px 8px;border-top-left-radius:6px;display:flex;align-items:center;gap:4px;">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="8" y1="6" x2="21" y2="6"/>
                  <line x1="8" y1="12" x2="21" y2="12"/>
                  <line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/>
                  <line x1="3" y1="12" x2="3.01" y2="12"/>
                  <line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
                <span>${pl.itemCount || 0} bài</span>
              </div>
            </div>
            <div style="padding:12px;display:flex;flex-direction:column;flex:1;justify-content:space-between;gap:8px;">
              <div>
                <h4 style="font-size:0.88rem;font-weight:600;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${this.escapeHtml(pl.title)}">
                  ${this.escapeHtml(pl.title)}
                </h4>
                ${pl.description ? `
                <p style="font-size:0.75rem;color:var(--text-muted);margin:0;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
                  ${this.escapeHtml(pl.description)}
                </p>` : ''}
              </div>
              <div style="display:flex;gap:6px;margin-top:6px;">
                <button class="btn-primary btn-play-yt-playlist" data-id="${pl.id}" data-type="audio" data-title="${this.escapeHtml(pl.title)}" style="flex:1;font-size:0.78rem;padding:6px 8px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:4px;" title="Nghe playlist">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Nghe</span>
                </button>
                <button class="pill-btn btn-play-yt-playlist" data-id="${pl.id}" data-type="video" data-title="${this.escapeHtml(pl.title)}" style="flex:1;font-size:0.78rem;padding:6px 8px;min-height:32px;display:inline-flex;align-items:center;justify-content:center;gap:4px;" title="Xem playlist video">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  <span>Video</span>
                </button>
                <a href="https://www.youtube.com/playlist?list=${pl.id}" target="_blank" class="pill-btn" style="font-size:0.78rem;padding:6px 10px;min-height:32px;display:inline-flex;align-items:center;" title="Mở liên kết">
                  ${icons.externalLink}
                </a>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    contentArea.querySelectorAll('.btn-play-yt-playlist').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        const mediaType = btn.dataset.type || 'audio';
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = 'Đang tải...';
        try {
          const info = await api.youtube.info(`https://www.youtube.com/playlist?list=${id}`);
          const entries = (info.items || info.entries || (info.id ? [info] : []))
            .filter(it => it && it.id && it.title !== '[Private video]' && it.title !== '[Deleted video]');
          if (entries.length === 0) throw new Error('Playlist không có bài hát nào hoặc là playlist riêng tư');

          const queue = entries.map(it => ({
            id: `yt_${it.id}_${mediaType}`,
            youtubeId: it.id,
            title: it.title,
            artist: it.channel || title,
            album: title,
            duration_sec: it.duration || 0,
            media_type: mediaType,
            isOnline: true,
            isPlaylist: true,
            thumbnail_url: it.thumbnail,
            publishedTime: it.publishedTime || ''
          }));

          store.set({ queue, originalQueue: queue, isPlaylistMode: true });
          this.player.loadOnlineTrack(queue[0], true);
          this.player?.showToast(`Đang phát playlist "${title}" (${queue.length} bài)`);
        } catch (err) {
          alert('Lỗi phát playlist: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
        }
      });
    });
  }

  async fetchFeed(topic = '') {
    this.currentQuery = '';
    this.page = 1;
    this.hasMore = true;
    this.renderedVideoIds.clear();
    this.allItems = [];
    const listEl = document.getElementById('online-feed-list');

    if (!navigator.onLine) {
      this.renderOfflineState(listEl);
      return;
    }

    if (listEl) {
      listEl.innerHTML = Array(6).fill(0).map(() => `
        <div class="video-card skeleton-card">
          <div class="skeleton-shimmer skeleton-thumb-16-9"></div>
          <div class="video-info" style="gap:8px;padding-top:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:85%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:50%;"></div>
          </div>
        </div>
      `).join('');
    }

    this.isSearch = false;
    try {
      // Try AI recommendations first (Gemini-powered weekly trending)
      let items = [];
      try {
        const rec = await api.youtube.getRecommendations();
        items = rec?.items || [];
      } catch (recErr) {
        // Recommendations unavailable, fall through to regular feed
      }

      // Fall back to regular feed if recommendations are empty
      if (items.length === 0) {
        const feed = await api.youtube.getFeed(topic, { page: 1 });
        items = feed.items || [];
      }

      // Cap at 100 and disable infinite scroll (fixed list)
      this.feedItems = items.slice(0, 100);
      this.allItems = [...this.feedItems];
      this.hasMore = false;
      if (this.activeChip === 'all') {
        this.renderVideoCards(this.feedItems, false, false);
      }
    } catch (err) {
      if (listEl) {
        this.renderOfflineState(listEl);
      }
    }
  }

  async search(query) {
    this.currentQuery = query;
    this.page = 1;
    this.hasMore = true;
    this.renderedVideoIds.clear();
    this.allItems = [];
    this.isSearch = true;
    const listEl = document.getElementById('online-feed-list');

    if (!navigator.onLine) {
      this.renderOfflineState(listEl);
      return;
    }

    if (listEl) {
      listEl.innerHTML = Array(6).fill(0).map(() => `
        <div class="video-card skeleton-card">
          <div class="skeleton-shimmer skeleton-thumb-16-9"></div>
          <div class="video-info" style="gap:8px;padding-top:6px;">
            <div class="skeleton-shimmer skeleton-text-lg" style="width:85%;"></div>
            <div class="skeleton-shimmer skeleton-text-sm" style="width:50%;"></div>
          </div>
        </div>
      `).join('');
    }

    try {
      const res = await api.youtube.search(query, { page: 1 });
      this.searchItems = res.items || [];
      this.allItems = [...this.searchItems];
      if (this.activeChip === 'all') {
        this.renderVideoCards(this.searchItems, true, false);
      }
    } catch (err) {
      if (listEl) {
        this.renderOfflineState(listEl);
      }
    }
  }

  renderVideoCards(items, isSearch = false, append = false) {
    const isSearchResult = Boolean(isSearch || this.isSearch || this.currentQuery);
    const listEl = document.getElementById('online-feed-list');
    if (!listEl) return;

    if (!append) {
      this.renderedVideoIds.clear();
    }

    const uniqueItems = (items || []).filter(item => {
      if (!item || !item.id || this.renderedVideoIds.has(item.id)) return false;
      this.renderedVideoIds.add(item.id);
      return true;
    });

    if (!append && uniqueItems.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <p class="empty-title">Không tìm thấy bài hát nào</p>
          <p>Thử tìm với từ khóa khác.</p>
        </div>
      `;
      return;
    }

    const cardsHtml = uniqueItems.map(item => {
      const durStr = this.player.formatTime(item.duration || 0);
      const viewsStr = item.viewsText || this.formatViews(item.views);
      const initial = (item.channel || 'Y').trim().charAt(0).toUpperCase();

      return `
        <div class="yt-video-card" data-id="${item.id}">
          <div class="yt-thumb-container">
            <img class="yt-thumb-img" src="${item.thumbnail}" alt="" loading="lazy">
            ${durStr ? `<span class="yt-thumb-duration">${durStr}</span>` : ''}
            <div class="yt-thumb-hover-overlay">
              <div class="yt-thumb-play-circle" title="Phát ngay">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                  <polygon points="6 4 19 12 6 20 6 4" />
                </svg>
              </div>
            </div>
          </div>

          <div class="yt-card-info-row">
            <div class="yt-channel-avatar" title="${this.escapeHtml(item.channel || '')}">
              ${initial}
            </div>

            <div class="yt-card-meta-col">
              <h3 class="yt-card-title" title="${this.escapeHtml(item.title)}">
                ${this.escapeHtml(item.title)}
              </h3>
              
              <div class="yt-card-channel-name">
                <span>${this.escapeHtml(item.channel || '')}</span>
              </div>

              <div class="yt-card-stats">
                ${viewsStr ? `<span>${viewsStr}</span>${item.publishedTime ? ' • ' : ''}` : ''}${item.publishedTime ? `<span>${this.escapeHtml(item.publishedTime)}</span>` : ''}
              </div>

              <div class="yt-card-actions">
                <button class="yt-action-btn yt-action-audio btn-play-online-audio" data-id="${item.id}" title="Nghe âm thanh">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M9 18V5l12-2v13" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="16" r="3" />
                  </svg>
                  <span>Nghe</span>
                </button>
                <button class="yt-action-btn yt-action-download btn-download-online" data-id="${item.id}" title="Tải về máy">
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    const sentinelHtml = this.hasMore ? `
      <div id="online-sentinel" style="grid-column: 1 / -1; height: 50px; display: flex; align-items: center; justify-content: center; margin: 16px 0;">
        <div class="infinite-loader" style="display:none;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
          <div style="width:16px;height:16px;border:2px solid var(--border-subtle);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span>Đang tải thêm bài hát...</span>
        </div>
      </div>
    ` : '';

    if (append) {
      const sentinel = document.getElementById('online-sentinel');
      if (sentinel) {
        sentinel.insertAdjacentHTML('beforebegin', cardsHtml);
      } else {
        listEl.insertAdjacentHTML('beforeend', cardsHtml + sentinelHtml);
      }
    } else {
      listEl.innerHTML = cardsHtml + sentinelHtml;
    }

    // Bind card events
    const allContextItems = this.allItems.length > 0 ? this.allItems : items;

    uniqueItems.forEach(item => {
      const card = listEl.querySelector(`.yt-video-card[data-id="${item.id}"]`);
      if (!card) return;

      const audioBtn = card.querySelector('.btn-play-online-audio');
      audioBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.playOnline(item, 'audio', isSearchResult ? null : allContextItems, isSearchResult);
      });

      const dlBtn = card.querySelector('.btn-download-online');
      dlBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        animateFlyToCorner(dlBtn, item);

        if (this.player && this.player.downloadTrackAudio) {
          this.player.downloadTrackAudio({
            ...item,
            id: `yt_${item.id}_audio`,
            youtubeId: item.id,
            isOnline: true,
            thumbnail_url: item.thumbnail || item.thumbnail_url,
            artist: item.channel || item.artist || 'Nghệ sĩ'
          }, dlBtn);
        } else if (this.player && this.player.showDownloadModalForTrack) {
          this.player.showDownloadModalForTrack({
            ...item,
            id: `yt_${item.id}_audio`,
            youtubeId: item.id,
            isOnline: true,
            thumbnail_url: item.thumbnail || item.thumbnail_url,
            artist: item.channel || item.artist || 'Nghệ sĩ'
          }, dlBtn);
        } else {
          api.youtube.download({
            url: item.url || `https://www.youtube.com/watch?v=${item.id}`,
            mediaType: 'audio',
            quality: '720p',
            title: item.title,
            artist: item.channel
          }).then(() => {
            this.player?.showToast(`Đã thêm "${item.title}" vào tiến trình tải!`, 2500);
          }).catch(err => {
            alert('Lỗi tải: ' + err.message);
          });
        }
      });

      card.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        this.playOnline(item, 'audio', isSearchResult ? null : allContextItems, isSearchResult);
      });
    });

    this.setupInfiniteScroll();
  }

  setupInfiniteScroll() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    const sentinel = document.getElementById('online-sentinel');
    if (!sentinel) return;

    this.observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.isIntersecting && !this.isLoadingMore && this.hasMore) {
        this.loadMore();
      }
    }, {
      rootMargin: '400px'
    });

    this.observer.observe(sentinel);
  }

  async loadMore() {
    if (this.isLoadingMore || !this.hasMore) return;
    this.isLoadingMore = true;

    const sentinel = document.getElementById('online-sentinel');
    const loader = sentinel?.querySelector('.infinite-loader');
    if (loader) loader.style.display = 'flex';

    this.page += 1;

    try {
      let newItems = [];
      if (this.currentQuery) {
        const res = await api.youtube.search(this.currentQuery, { page: this.page });
        newItems = (res.items || []).filter(it => !this.renderedVideoIds.has(it.id));
      } else {
        const feed = await api.youtube.getFeed('', { page: this.page });
        newItems = (feed.items || []).filter(it => !this.renderedVideoIds.has(it.id));
      }

      if (newItems.length === 0) {
        this.hasMore = false;
        if (loader) loader.style.display = 'none';
        return;
      }

      this.allItems = [...this.allItems, ...newItems];
      if (this.currentQuery) this.searchItems = this.allItems;
      else this.feedItems = this.allItems;

      this.renderVideoCards(newItems, Boolean(this.currentQuery), true);
    } catch (err) {
      console.warn('Infinite scroll error:', err);
    } finally {
      this.isLoadingMore = false;
      if (loader) loader.style.display = 'none';
    }
  }

  formatViews(views) {
    if (!views) return '';
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}Tr lượt xem`;
    }
    if (views >= 1000) {
      return `${Math.round(views / 1000)}k lượt xem`;
    }
    return `${views} lượt xem`;
  }

  playOnline(item, mediaType = 'audio', allItems = null, isFromSearch = false) {
    if (!navigator.onLine) {
      this.player?.showToast('Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.', 3500);
      return;
    }
    store.set({ isPlaylistMode: false });

    // SPOTIFY EXPERIENCE:
    // When playing an individual track from home feed, search or trending:
    // Seed the playback with this single track and immediately launch Spotify Song Radio
    // so that Up Next is dynamically generated based on this exact song's artist, mood & genre!
    const singleTrack = {
      id: `yt_${item.id}_${mediaType}`,
      youtubeId: item.id,
      title: item.title,
      artist: item.channel || item.artist || 'Nghệ sĩ',
      album: 'Radio Trực Tuyến',
      duration_sec: item.duration || 0,
      media_type: mediaType,
      isOnline: true,
      thumbnail_url: item.thumbnail || item.thumbnail_url,
      publishedTime: item.publishedTime || ''
    };

    store.set({ queue: [singleTrack], originalQueue: [singleTrack], isPlaylistMode: false });
    this.player.loadOnlineTrack(singleTrack, true);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
