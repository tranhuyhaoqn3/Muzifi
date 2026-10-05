import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';
import { animateFlyToCorner } from './flyAnim.js';

export class OnlineView {
  constructor(playerEngine) {
    this.player = playerEngine;
    this.container = document.getElementById('main-view');
    this.feedItems = null;
    this.searchItems = null;
    this.currentQuery = '';
    this.currentUser = null;
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

    this.container.innerHTML = `
      <div class="online-view">
        <!-- Search Bar with Suggestions -->
        <div class="search-bar-row ytm-search-row" style="margin-bottom:18px;position:relative;">
          <div class="search-input-box" style="position:relative;">
            ${icons.search}
            <input type="text" id="online-search-input" autocomplete="off" spellcheck="false" placeholder="Tìm kiếm bài hát, nghệ sĩ, remix..." value="${this.escapeHtml(this.currentQuery || '')}">
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
              <p class="empty-title">Đang tải nhạc trực tuyến...</p>
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
        const res = await api.online.suggest(q.trim());
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
      msg.includes('urlopen')
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
      listEl.innerHTML = Array(8).fill(0).map(() => `
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
      const feed = await api.online.getFeed(topic, { page: 1 });
      this.feedItems = feed.items || [];
      this.allItems = [...this.feedItems];
      this.renderVideoCards(this.feedItems, false, false);
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
      listEl.innerHTML = Array(8).fill(0).map(() => `
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
      const res = await api.online.search(query, { page: 1 });
      this.searchItems = res.items || [];
      this.allItems = [...this.searchItems];
      this.renderVideoCards(this.searchItems, true, false);
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
      const durStr = this.player.formatTime(item.duration || item.duration_sec || 0);
      const viewsStr = item.viewsText || this.formatViews(item.views);
      const initial = (item.channel || item.artist || 'M').trim().charAt(0).toUpperCase();

      return `
        <div class="yt-video-card" data-id="${item.id}">
          <div class="yt-thumb-container">
            <img class="yt-thumb-img" src="${item.thumbnail || item.thumbnail_url || ''}" alt="" loading="lazy">
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
            <div class="yt-channel-avatar" title="${this.escapeHtml(item.channel || item.artist || '')}">
              ${initial}
            </div>

            <div class="yt-card-meta-col">
              <h3 class="yt-card-title" title="${this.escapeHtml(item.title)}">
                ${this.escapeHtml(item.title)}
              </h3>
              
              <div class="yt-card-channel-name">
                <span>${this.escapeHtml(item.channel || item.artist || '')}</span>
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

    const sentinelHtml = `
      <div id="online-sentinel" style="grid-column: 1 / -1; height: 50px; display: flex; align-items: center; justify-content: center; margin: 16px 0;">
        <div class="infinite-loader" style="display:none;font-size:0.82rem;color:var(--text-muted);display:flex;align-items:center;gap:8px;">
          <div style="width:16px;height:16px;border:2px solid var(--border-subtle);border-top-color:var(--accent-primary);border-radius:50%;animation:spin 0.8s linear infinite;"></div>
          <span>Đang tải thêm bài hát...</span>
        </div>
      </div>
    `;

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

        const trackData = {
          ...item,
          id: `online_${item.id}_audio`,
          onlineId: String(item.id),
          soundcloudId: String(item.id),
          isOnline: true,
          thumbnail_url: item.thumbnail || item.thumbnail_url,
          artist: item.channel || item.artist || 'Nghệ sĩ'
        };

        if (this.player && this.player.downloadTrackAudio) {
          this.player.downloadTrackAudio(trackData, dlBtn);
        } else if (this.player && this.player.showDownloadModalForTrack) {
          this.player.showDownloadModalForTrack(trackData, dlBtn);
        } else {
          api.online.download({
            url: item.url || (item.id ? `https://soundcloud.com/tracks/${item.id}` : null),
            id: item.id,
            mediaType: 'audio',
            quality: 'HQ',
            title: item.title,
            artist: item.channel || item.artist,
            thumbnail: item.thumbnail || item.thumbnail_url
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
        const res = await api.online.search(this.currentQuery, { page: this.page });
        newItems = (res.items || []).filter(it => !this.renderedVideoIds.has(it.id));
      } else {
        const feed = await api.online.getFeed('', { page: this.page });
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
      return `${(views / 1000000).toFixed(1)}Tr lượt nghe`;
    }
    if (views >= 1000) {
      return `${Math.round(views / 1000)}k lượt nghe`;
    }
    return `${views} lượt nghe`;
  }

  playOnline(item, mediaType = 'audio', allItems = null, isFromSearch = false) {
    if (!navigator.onLine) {
      this.player?.showToast('Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.', 3500);
      return;
    }
    store.set({ isPlaylistMode: false });

    const singleTrack = {
      id: `online_${item.id}_audio`,
      onlineId: String(item.id),
      soundcloudId: String(item.id),
      title: item.title,
      artist: item.channel || item.artist || 'Nghệ sĩ',
      album: 'Nhạc Trực Tuyến',
      duration_sec: item.duration || item.duration_sec || 0,
      media_type: 'audio',
      isOnline: true,
      thumbnail_url: item.thumbnail || item.thumbnail_url,
      publishedTime: item.publishedTime || '',
      source: 'online'
    };

    store.set({ queue: [singleTrack], originalQueue: [singleTrack], isPlaylistMode: false });
    this.player.loadOnlineTrack(singleTrack, true);
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
