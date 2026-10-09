import { store } from '../state.js';
import { api } from '../api.js';
import { icons } from './icons.js';
import { animateFlyToCorner } from './flyAnim.js';
import { getTrackOffline, saveTrackOffline } from '../offlineStorage.js';

export class PlayerEngine {
  constructor() {
    this.audio = document.getElementById('core-audio');
    this.video = document.getElementById('core-video');
    this.activeMedia = this.audio;
    this.isDraggingScrubber = false;
    this.lastSavedPosition = 0;
    this.saveInterval = null;
    this.toastTimer = null;
    this.lastTapTime = 0;

    // Lyrics state
    this.isLyricsOpen = false;
    this.currentLyrics = null;
    this.currentLyricIndex = -1;
    this.lyricsLoadingTrackId = null;
    this.isFetchingSimilar = false;

    // Preload & offline cache state
    this.preloadedTrackId = null;
    this.preloadedBlobUrl = null;
    this.preloadedLyrics = null;
    this.currentBlobUrl = null;

    // Video quality state
    this.currentVideoQuality = parseInt(localStorage.getItem('muzifi_video_quality') || localStorage.getItem('metube_video_quality') || '0', 10) || 0; // 0 = auto
    this.availableQualities = [];
    this.qualitiesFetched = false;
    this.lastPositionSyncTime = 0;

    // Set WebKit audio session for continuous background audio and lockscreen controls on iOS
    if ('audioSession' in navigator) {
      try {
        navigator.audioSession.type = 'playback';
      } catch (e) {}
    }

    this.initElements();
    this.initMediaEvents();
    this.initMediaSession();
    this.initControls();
    this.initKeyboardShortcuts();
    this.startStateSyncTimer();
  }

  initElements() {
    // Mini Player
    this.miniPlayer = document.getElementById('mini-player');
    this.miniProgressBar = document.querySelector('.mini-progress-bar');
    this.miniProgressFill = document.getElementById('mini-progress-fill');
    this.miniClickArea = document.getElementById('mini-click-area');
    this.miniThumb = document.getElementById('mini-thumb');
    this.miniTitle = document.getElementById('mini-title');
    this.miniArtist = document.getElementById('mini-artist');
    this.miniQueueBtn = document.getElementById('mini-btn-queue');
    this.miniPrevBtn = document.getElementById('mini-btn-prev');
    this.miniPlayBtn = document.getElementById('mini-btn-play');
    this.miniPlayIcon = document.getElementById('mini-play-icon');
    this.miniNextBtn = document.getElementById('mini-btn-next');

    // Full Player
    this.fullPlayer = document.getElementById('full-player');
    this.playerShareBtn = document.getElementById('btn-player-share');
    this.playerDownloadBtn = document.getElementById('btn-player-download');
    this.playerTitle = document.getElementById('player-title');
    this.playerArtist = document.getElementById('player-artist');
    this.playerArtwork = document.getElementById('player-artwork');
    this.playerTypeBadge = document.getElementById('player-type-badge');
    this.audioView = document.getElementById('player-audio-view');
    this.videoView = document.getElementById('player-video-view');
    this.mainPlayBtn = document.getElementById('btn-play-pause');
    this.mainPlayIcon = document.getElementById('main-play-icon');
    this.prevBtn = document.getElementById('btn-prev');
    this.nextBtn = document.getElementById('btn-next');
    this.shuffleBtn = document.getElementById('btn-shuffle');
    this.loopBtn = document.getElementById('btn-loop');
    this.loopSub = document.getElementById('loop-subscript');
    
    // Speed & Sleep timer in top bar
    this.rateBtn = document.getElementById('btn-playback-rate');
    this.sleepBtn = document.getElementById('btn-sleep-timer');
    this.sleepText = document.getElementById('sleep-timer-text');
    this.closeBtn = document.getElementById('player-btn-close');
    this.dragHandle = document.getElementById('player-drag-handle');

    // YouTube Music Bottom Tabs
    this.tabUpNextBtn = document.getElementById('tab-btn-upnext');
    this.tabLyricsBtn = document.getElementById('tab-btn-lyrics');

    // Up Next Overlay (YouTube Music style)
    this.upNextView = document.getElementById('player-upnext-view');
    this.upNextCloseBtn = document.getElementById('btn-upnext-close');
    this.upNextDragHandle = document.getElementById('upnext-drag-handle');
    this.upNextContentWrapper = document.getElementById('upnext-content-wrapper');
    this.upNextSubtitle = document.getElementById('upnext-header-subtitle');

    // Lyrics overlay
    this.lyricsView = document.getElementById('player-lyrics-view');
    this.lyricsCloseBtn = document.getElementById('btn-lyrics-close');
    this.lyricsScrollContainer = document.getElementById('lyrics-scroll-container');
    this.lyricsLoading = document.getElementById('lyrics-loading');
    this.lyricsEmpty = document.getElementById('lyrics-empty');
    this.lyricsLinesWrapper = document.getElementById('lyrics-lines-wrapper');
    this.lyricsTrackTitle = document.getElementById('lyrics-track-title');
    
    // Video overlay
    this.pipBtn = document.getElementById('btn-pip');
    this.fullscreenBtn = document.getElementById('btn-fullscreen');
    this.qualityBtn = document.getElementById('btn-video-quality');
    this.qualityLabel = document.getElementById('video-quality-label');

    // Loading overlay
    this.loadingOverlay = document.getElementById('player-loading-overlay');

    // Scrubber
    this.scrubberTrack = document.getElementById('scrubber-track');
    this.scrubberFill = document.getElementById('scrubber-fill');
    this.scrubberHandle = document.getElementById('scrubber-handle');
    this.currentTimeEl = document.getElementById('player-time-current');
    this.totalTimeEl = document.getElementById('player-time-total');
  }

  showPlayerLoading(text = 'Đang tải...') {
    if (this.loadingOverlay) {
      const txt = this.loadingOverlay.querySelector('.player-loading-text');
      if (txt) txt.textContent = text;
      this.loadingOverlay.style.display = 'flex';
    }
  }

  hidePlayerLoading() {
    if (this.loadingOverlay) {
      this.loadingOverlay.style.display = 'none';
    }
  }

  initMediaEvents() {
    const setupEvents = (mediaEl) => {
      mediaEl.addEventListener('timeupdate', () => this.onTimeUpdate());
      mediaEl.addEventListener('ended', () => this.onEnded());
      mediaEl.addEventListener('play', () => {
        this.onPlayStateChange(true);
        this.bindMediaSessionActions();
        if (mediaEl.readyState < 3) {
          store.set({ isBuffering: true });
        }
      });
      mediaEl.addEventListener('playing', () => {
        this.hidePlayerLoading();
        store.set({ isBuffering: false });
        this.syncPositionState();
        this.bindMediaSessionActions();
      });
      mediaEl.addEventListener('canplay', () => {
        this.hidePlayerLoading();
        if (!mediaEl.paused) {
          store.set({ isBuffering: false });
        }
      });
      mediaEl.addEventListener('waiting', () => {
        store.set({ isBuffering: true });
        const { currentTrack } = store.get();
        if (currentTrack?.isOnline) {
          this.showPlayerLoading('Đang tải luồng...');
        }
      });
      mediaEl.addEventListener('pause', () => {
        this.hidePlayerLoading();
        store.set({ isBuffering: false });
        this.onPlayStateChange(false);
        this.syncPositionState();
      });
      mediaEl.addEventListener('loadedmetadata', () => this.onLoadedMetadata());
      mediaEl.addEventListener('error', (e) => {
        this.hidePlayerLoading();
        store.set({ isBuffering: false });
        this.onError(e);
      });
    };

    setupEvents(this.audio);
    if (this.video) {
      setupEvents(this.video);
    }

    // Audio pitch preservation
    if (this.audio && 'preservesPitch' in this.audio) {
      this.audio.preservesPitch = true;
    }
    if (this.video && 'preservesPitch' in this.video) {
      this.video.preservesPitch = true;
    }
  }

  initMediaSession() {
    this.bindMediaSessionActions();
  }

  bindMediaSessionActions() {
    if (!('mediaSession' in navigator)) return;

    const ms = navigator.mediaSession;
    const safeSet = (action, handler) => {
      try {
        ms.setActionHandler(action, handler);
      } catch (e) {
        // Some platforms do not support specific action types
      }
    };

    safeSet('play', () => this.play());
    safeSet('pause', () => this.pause());
    safeSet('previoustrack', () => this.prev());
    safeSet('nexttrack', () => this.next());
    safeSet('stop', () => this.pause());

    // Timeline scrubbing on lock screen (iOS 15+, Android 10+)
    safeSet('seekto', (details) => {
      if (details && details.seekTime !== undefined && !isNaN(details.seekTime)) {
        this.seek(details.seekTime);
      }
    });

    // Explicitly disable seekbackward and seekforward
    // In iOS Control Center and Lock Screen, registering seekbackward/seekforward
    // causes iOS to replace Previous/Next track buttons with 15s skip buttons.
    // Setting them to null guarantees Previous & Next track buttons are displayed.
    safeSet('seekbackward', null);
    safeSet('seekforward', null);
  }

  initControls() {
    // Mini player clicks
    if (this.miniClickArea) {
      this.miniClickArea.addEventListener('click', () => this.openFullPlayer());
    }
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.closeFullPlayer());
    }
    if (this.dragHandle) {
      this.dragHandle.addEventListener('click', () => this.closeFullPlayer());
    }

    // Mini Player Up Next
    if (this.miniQueueBtn) {
      this.miniQueueBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showUpNextModal();
      });
    }

    // Mini Player Prev
    if (this.miniPrevBtn) {
      this.miniPrevBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.prev();
      });
    }

    // Mini Player Play/Pause
    if (this.miniPlayBtn) {
      this.miniPlayBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePlay();
      });
    }

    // Mini Player Next
    if (this.miniNextBtn) {
      this.miniNextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.next();
      });
    }

    // Top-Right Player Download Button (Only for online tracks)
    if (this.playerDownloadBtn) {
      this.playerDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.downloadTrackAudio(store.get().currentTrack, this.playerDownloadBtn);
      });
    }

    // Mini Scrubber click/drag
    if (this.miniProgressBar) {
      this.miniProgressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        const rect = this.miniProgressBar.getBoundingClientRect();
        const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const duration = this.getDuration();
        if (duration > 0) {
          this.seek(pos * duration);
        }
      });
    }

    // Full Player Play/Pause
    if (this.mainPlayBtn) {
      this.mainPlayBtn.addEventListener('click', () => this.togglePlay());
    }
    if (this.prevBtn) {
      this.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.next());
    }

    // Double-tap on video container to seek ±10s (like YouTube)
    if (this.videoView) {
      this.videoView.addEventListener('click', (e) => {
        if (e.target.closest('#video-overlay-ctrls')) return;
        const now = Date.now();
        if (now - this.lastTapTime < 300) {
          // Double tap detected
          const rect = this.videoView.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          if (clickX < rect.width / 2) {
            this.seekBy(-10);
          } else {
            this.seekBy(10);
          }
          this.lastTapTime = 0;
        } else {
          this.lastTapTime = now;
          // Single tap: toggle play after 250ms if no second tap
          setTimeout(() => {
            if (this.lastTapTime === now) {
              this.togglePlay();
            }
          }, 250);
        }
      });
    }

    // Shuffle & Loop
    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    }
    if (this.loopBtn) {
      this.loopBtn.addEventListener('click', () => this.cycleLoopMode());
    }

    // Playback Rate
    if (this.rateBtn) {
      this.rateBtn.addEventListener('click', () => this.showSpeedModal());
    }

    // Sleep Timer
    if (this.sleepBtn) {
      this.sleepBtn.addEventListener('click', () => this.showSleepTimerModal());
    }

    // Share Track button
    if (this.playerShareBtn) {
      this.playerShareBtn.addEventListener('click', () => this.shareCurrentTrack());
    }

    // YouTube Music Tabs & Overlays
    if (this.tabUpNextBtn) {
      this.tabUpNextBtn.addEventListener('click', () => this.toggleUpNext());
    }
    if (this.tabLyricsBtn) {
      this.tabLyricsBtn.addEventListener('click', () => this.toggleLyrics());
    }
    if (this.upNextCloseBtn) {
      this.upNextCloseBtn.addEventListener('click', () => this.closeUpNext());
    }
    if (this.upNextDragHandle) {
      this.upNextDragHandle.addEventListener('click', () => this.closeUpNext());
    }
    if (this.lyricsCloseBtn) {
      this.lyricsCloseBtn.addEventListener('click', () => this.closeLyrics());
    }

    // Full Player Scrubber drag & click
    const handleScrub = (e) => {
      const rect = this.scrubberTrack.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const pos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const duration = this.getDuration();
      const targetTime = pos * duration;

      this.scrubberFill.style.width = `${pos * 100}%`;
      this.scrubberHandle.style.left = `${pos * 100}%`;
      this.currentTimeEl.textContent = this.formatTime(targetTime);

      if (!this.isDraggingScrubber) {
        this.seek(targetTime);
      }
      return targetTime;
    };

    if (this.scrubberTrack) {
      this.scrubberTrack.addEventListener('mousedown', (e) => {
        this.isDraggingScrubber = true;
        handleScrub(e);
        const onMove = (ev) => handleScrub(ev);
        const onUp = (ev) => {
          this.isDraggingScrubber = false;
          const target = handleScrub(ev);
          this.seek(target);
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      this.scrubberTrack.addEventListener('touchstart', (e) => {
        this.isDraggingScrubber = true;
        handleScrub(e);
        const onTouchMove = (ev) => handleScrub(ev);
        const onTouchEnd = (ev) => {
          this.isDraggingScrubber = false;
          const target = handleScrub(ev.changedTouches ? ev.changedTouches[0] : ev);
          this.seek(target);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', onTouchEnd);
        };
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
      }, { passive: true });
    }

    // Video PiP & Fullscreen
    if (this.pipBtn) {
      this.pipBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
          } else if (document.pictureInPictureEnabled) {
            await this.video.requestPictureInPicture();
          }
        } catch (err) {
          console.warn('PiP error:', err);
        }
      });
    }

    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.video.requestFullscreen) {
          this.video.requestFullscreen();
        } else if (this.video.webkitEnterFullscreen) {
          this.video.webkitEnterFullscreen();
        }
      });
    }

    // Video Quality Selection
    if (this.qualityBtn) {
      this.qualityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showQualityModal();
      });
    }
  }

  initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      // Ignore if user is typing in input or textarea
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        this.togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        this.prev();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        this.next();
      } else if (e.key === '[' || e.code === 'Minus') {
        e.preventDefault();
        this.stepPlaybackRate(-0.25);
      } else if (e.key === ']' || e.code === 'Equal') {
        e.preventDefault();
        this.stepPlaybackRate(0.25);
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault();
        this.cycleLoopMode();
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault();
        this.toggleShuffle();
      }
    });
  }

  getDuration() {
    const mediaDur = this.activeMedia.duration;
    if (mediaDur && !isNaN(mediaDur) && mediaDur > 0) {
      return mediaDur;
    }
    const trackDur = store.get().currentTrack?.duration_sec;
    if (trackDur && !isNaN(trackDur) && trackDur > 0) {
      return trackDur;
    }
    return 0;
  }

  getAuthStreamUrl(url) {
    if (!url) return url;
    const apiBase = localStorage.getItem('muzifi_server_url') || '';
    const fullUrl = (url.startsWith('/') && apiBase) ? `${apiBase}${url}` : url;
    const token = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
    if (!token) return fullUrl;
    const separator = fullUrl.includes('?') ? '&' : '?';
    return `${fullUrl}${separator}token=${encodeURIComponent(token)}`;
  }

  async loadTrack(track, autoPlay = true, resumePosition = 0, shouldPop = false) {
    if (!track) return;
    this.preloadedTrackId = null;
    this.hidePlayerLoading();

    if (shouldPop) {
      this.openFullPlayer();
    }

    // 1. Immediately display player and update UI (0ms synchronous response)
    const apiBase = localStorage.getItem('muzifi_server_url') || '';
    let thumbUrl = track.thumbBlob
      ? URL.createObjectURL(track.thumbBlob)
      : (track.thumbDataUrl || `${apiBase}/api/tracks/${track.id}/thumb`);
    const fallbackSvg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%236366f1"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';

    if (this.miniThumb) {
      this.miniThumb.src = thumbUrl;
      this.miniThumb.onerror = () => { this.miniThumb.src = fallbackSvg; };
    }
    if (this.miniTitle) this.miniTitle.textContent = track.title;
    if (this.miniArtist) this.miniArtist.textContent = track.artist || 'Nghệ sĩ';
    if (this.miniPlayer) this.miniPlayer.style.display = 'flex';

    if (this.playerTitle) this.playerTitle.textContent = track.title;
    if (this.playerArtist) {
      this.playerArtist.textContent = track.artist || 'Nghệ sĩ';
    }
    if (this.playerArtwork) {
      this.playerArtwork.src = thumbUrl;
      this.playerArtwork.onerror = () => { this.playerArtwork.src = fallbackSvg; };
    }
    if (this.playerTypeBadge) this.playerTypeBadge.style.display = 'none';
    if (this.playerDownloadBtn) this.playerDownloadBtn.style.display = 'none';

    store.set({ currentTrack: track, currentTime: resumePosition, duration: track.duration_sec || 0, isPlaying: autoPlay });

    this.updateMediaSession(track);
    this.updateDocumentTitle();

    // 2. Prepare media element (DO NOT pause this.audio to preserve background audio session)
    if (this.video) this.video.pause();

    this.activeMedia = this.audio;
    if (this.videoView) this.videoView.style.display = 'none';
    if (this.audioView) this.audioView.style.display = 'block';

    const currentRate = store.get().playbackRate || 1.0;
    this.activeMedia.playbackRate = currentRate;
    if (this.rateBtn) this.rateBtn.textContent = `${currentRate}x`;
    this.activeMedia.loop = false;

    // 3. Resolve audio stream synchronously (using local blob, memory preloaded blob, or IndexedDB)
    let streamUrl = this.getAuthStreamUrl(`/api/tracks/${track.id}/stream`);
    let isFromCache = false;

    if (track.blob) {
      if (this.currentBlobUrl) {
        try { URL.revokeObjectURL(this.currentBlobUrl); } catch (e) {}
      }
      this.currentBlobUrl = URL.createObjectURL(track.blob);
      streamUrl = this.currentBlobUrl;
      isFromCache = true;
    } else if (this.preloadedTrackId === track.id && this.preloadedBlobUrl) {
      if (this.currentBlobUrl && this.currentBlobUrl !== this.preloadedBlobUrl) {
        try { URL.revokeObjectURL(this.currentBlobUrl); } catch (e) {}
      }
      this.currentBlobUrl = this.preloadedBlobUrl;
      streamUrl = this.currentBlobUrl;
      isFromCache = true;
      if (this.preloadedLyrics && !this.currentLyrics) {
        this.currentLyrics = this.preloadedLyrics;
      }
      this.preloadedBlobUrl = null;
      this.preloadedTrackId = null;
      this.preloadedLyrics = null;
    } else {
      try {
        const offlineRec = await getTrackOffline(track.id);
        if (offlineRec && offlineRec.blob) {
          if (this.currentBlobUrl) {
            try { URL.revokeObjectURL(this.currentBlobUrl); } catch (e) {}
          }
          this.currentBlobUrl = URL.createObjectURL(offlineRec.blob);
          streamUrl = this.currentBlobUrl;
          isFromCache = true;
          if (offlineRec.lyrics && !this.currentLyrics) {
            this.currentLyrics = offlineRec.lyrics;
            if (this.isLyricsOpen) this.renderLyrics(this.currentLyrics);
          }
          if (offlineRec.thumbBlob) {
            const obThumb = URL.createObjectURL(offlineRec.thumbBlob);
            if (this.playerArtwork) this.playerArtwork.src = obThumb;
            if (this.miniThumb) this.miniThumb.src = obThumb;
          }
        }
      } catch (e) {}
    }

    // Assign source, load, seek, and play SYNCHRONOUSLY (Essential for iOS Safari & Android background playback)
    this.audio.src = streamUrl;
    this.audio.load();

    if (resumePosition > 0) {
      this.activeMedia.currentTime = resumePosition;
    }

    // 4. Start playback immediately within synchronous user gesture/ended event stack
    if (autoPlay) {
      const playPromise = this.activeMedia.play();
      if (playPromise !== undefined) {
        playPromise.catch(err => {
          console.warn('Continuous playback start notice:', err);
          setTimeout(() => {
            if (this.activeMedia.paused && store.get().isPlaying) {
              this.activeMedia.play().catch(() => {
                this.onPlayStateChange(false);
              });
            }
          }, 150);
        });
      }
    }

    // 5. Asynchronously check/save IndexedDB in background without blocking audio playback
    const isStandalone = Boolean(
      window.Capacitor ||
      window.__muzifi_guest_mode ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'file:' ||
      localStorage.getItem('muzifi_standalone_mode') === 'true'
    );
    if (!isFromCache && !isStandalone && navigator.onLine) {
      saveTrackOffline(track).catch(() => {});
    }

    // Refresh lyrics if currently open
    this.currentLyrics = null;
    this.currentLyricIndex = -1;
    if (this.isLyricsOpen) {
      this.loadLyricsForCurrentTrack();
    }

    // Refresh Up Next drawer if open
    if (this.upNextView && this.upNextView.style.display !== 'none') {
      this.renderUpNextContent();
    }

    // Tell Service Worker to background-cache this track for offline playback
    this.notifySWCacheTrack(track.id);

    // Preload next track in queue early
    this.preloadNextInQueue();
  }

  async loadOnlineTrack(onlineTrack, shouldPop = false) {
    if (!onlineTrack) return;
    if (!navigator.onLine) {
      this.showToast('Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.', 3500);
      return;
    }
    this.preloadedTrackId = null;

    if (shouldPop) {
      this.openFullPlayer();
    }

    if (this.isFullPlayerOpen() || shouldPop) {
      this.showPlayerLoading('Đang tải...');
    }

    const streamUrl = this.getAuthStreamUrl(`/api/youtube/stream?v=${encodeURIComponent(onlineTrack.youtubeId)}&type=audio`);

    // DO NOT call this.audio.pause()! Swapping src and calling load/play preserves background audio session
    if (this.video) this.video.pause();

    this.activeMedia = this.audio;
    if (this.videoView) this.videoView.style.display = 'none';
    if (this.audioView) this.audioView.style.display = 'block';

    // Assign source and load immediately
    this.audio.src = streamUrl;
    this.audio.load();

    const currentRate = store.get().playbackRate || 1.0;
    this.activeMedia.playbackRate = currentRate;
    if (this.rateBtn) this.rateBtn.textContent = `${currentRate}x`;

    // Native loop is managed in onEnded() for cross-device consistency
    this.activeMedia.loop = false;

    const rawArtist = (onlineTrack.artist || onlineTrack.channel || '').trim();
    const cleanArtist = (!rawArtist || /^youtube$/i.test(rawArtist)) ? 'Nghệ sĩ' : rawArtist.replace(/\byoutube\b/gi, '').trim() || 'Nghệ sĩ';
    const cleanTitle = (onlineTrack.title || 'Bản nhạc trực tuyến').replace(/\s*-\s*YouTube$/i, '').trim();

    const thumbUrl = onlineTrack.thumbnail_url || '/api/tracks/placeholder/thumb';
    if (this.miniThumb) this.miniThumb.src = thumbUrl;
    if (this.miniTitle) this.miniTitle.textContent = cleanTitle;
    if (this.miniArtist) this.miniArtist.textContent = cleanArtist;
    if (this.miniPlayer) this.miniPlayer.style.display = 'flex';

    if (this.playerTitle) this.playerTitle.textContent = cleanTitle;
    if (this.playerArtist) {
      this.playerArtist.textContent = cleanArtist;
    }
    if (this.playerArtwork) this.playerArtwork.src = thumbUrl;
    if (this.playerTypeBadge) this.playerTypeBadge.style.display = 'none';
    if (this.playerDownloadBtn) this.playerDownloadBtn.style.display = 'inline-flex';

    store.set({ currentTrack: onlineTrack, currentTime: 0, duration: onlineTrack.duration_sec || 0, isLibraryQueue: false });
    this.updateDocumentTitle();

    // Refresh lyrics if currently open
    this.currentLyrics = null;
    this.currentLyricIndex = -1;
    if (this.isLyricsOpen) {
      this.loadLyricsForCurrentTrack();
    }

    // Refresh Up Next drawer if open
    // Update lock screen / media notification metadata
    this.updateMediaSession(onlineTrack);

    // Start playback synchronously without blocking
    const playPromise = this.activeMedia.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Online autoplay notice:', err);
        setTimeout(() => {
          if (this.activeMedia.paused && store.get().isPlaying) {
            this.activeMedia.play().catch(() => {
              this.onPlayStateChange(false);
            });
          }
        }, 150);
      });
    }

    // Preload next track early on the server
    this.preloadNextInQueue();
  }

  playOnlineTrack(onlineTrack, shouldPop = false) {
    return this.loadOnlineTrack(onlineTrack, shouldPop);
  }

  updateMediaSession(track) {
    if (!('mediaSession' in navigator) || !track) return;

    let thumbUrl = track.thumbBlob ? URL.createObjectURL(track.thumbBlob) : track.thumbnail_url;
    if (!thumbUrl) {
      const apiBase = localStorage.getItem('muzifi_server_url') || '';
      thumbUrl = `${apiBase || window.location.origin}/api/tracks/${track.id}/thumb`;
    } else if (thumbUrl.startsWith('/')) {
      const apiBase = localStorage.getItem('muzifi_server_url') || '';
      thumbUrl = `${apiBase || window.location.origin}${thumbUrl}`;
    }

    let artistName = (track.artist && track.artist !== 'Nghệ sĩ') ? track.artist : (track.channel || 'Muzifi');
    if (/^youtube$/i.test(artistName.trim())) artistName = 'Muzifi';
    else artistName = artistName.replace(/\byoutube\b/gi, '').trim() || 'Muzifi';

    const cleanTitle = (track.title || 'Đang phát').replace(/\s*-\s*YouTube$/i, '').trim();
    const albumName = track.album && !/youtube/i.test(track.album) ? track.album : (track.isOnline ? 'Trực tuyến' : 'Muzifi');

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: cleanTitle,
        artist: artistName,
        album: albumName,
        artwork: [
          { src: thumbUrl, sizes: '96x96', type: 'image/jpeg' },
          { src: thumbUrl, sizes: '128x128', type: 'image/jpeg' },
          { src: thumbUrl, sizes: '192x192', type: 'image/jpeg' },
          { src: thumbUrl, sizes: '256x256', type: 'image/jpeg' },
          { src: thumbUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });
    } catch (e) {
      console.warn('Failed to set mediaSession metadata:', e);
    }
  }

  updateDocumentTitle() {
    const { currentTrack, isPlaying } = store.get();
    if (!currentTrack || !currentTrack.title) {
      document.title = 'Muzifi - Nghe Nhạc Offline & Tải Nhạc Miễn Phí';
      return;
    }

    const artist = (currentTrack.artist && currentTrack.artist !== 'Nghệ sĩ') ? ` - ${currentTrack.artist}` : '';
    document.title = `${currentTrack.title}${artist} | Muzifi`;
  }

  async play() {
    try {
      await this.activeMedia.play();
    } catch (e) {
      console.warn('Play failed:', e);
    }
  }

  pause() {
    this.activeMedia.pause();
  }

  togglePlay() {
    if (this.activeMedia.paused) {
      this.play();
    } else {
      this.pause();
    }
  }

  seek(targetTime) {
    const duration = this.getDuration();
    const maxBound = duration > 0 ? duration : 86400;
    const clamped = Math.max(0, Math.min(targetTime, maxBound));

    this.activeMedia.currentTime = clamped;
    this.onTimeUpdate();
    this.syncPositionState();
  }

  seekBy(deltaSeconds) {
    const current = this.activeMedia.currentTime || 0;
    this.seek(current + deltaSeconds);
    const sign = deltaSeconds > 0 ? `+${deltaSeconds}` : `${deltaSeconds}`;
    this.showToast(`Tua ${sign}s`, 1000);
  }

  stepPlaybackRate(delta) {
    const current = store.get().playbackRate || 1.0;
    const nextRate = Math.round((current + delta) * 100) / 100;
    this.setPlaybackRate(nextRate);
  }

  setPlaybackRate(rate) {
    const clamped = Math.max(0.25, Math.min(rate, 3.0));
    const formatted = parseFloat(clamped.toFixed(2));

    this.audio.playbackRate = formatted;
    this.video.playbackRate = formatted;

    store.set({ playbackRate: formatted });

    if (this.rateBtn) {
      this.rateBtn.textContent = `${formatted}x`;
    }

    this.syncPositionState();
    this.showToast(`Tốc độ phát: ${formatted}x`, 1200);
  }

  showSpeedModal() {
    const modalContainer = document.getElementById('modal-container');
    const currentRate = store.get().playbackRate || 1.0;
    const presets = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="speed-picker-modal">
        <div class="modal-card" style="max-width:340px;">
          <div class="modal-header">
            <h3 class="modal-title">Tốc độ phát</h3>
            <button class="icon-btn" id="modal-speed-close">${icons.x}</button>
          </div>
          <div class="modal-body" style="display:flex;flex-direction:column;gap:8px;">
            ${presets.map(r => `
              <button class="btn-secondary speed-option-btn ${r === currentRate ? 'active' : ''}" data-rate="${r}" style="justify-content:space-between;padding:10px 16px;">
                <span>${r === 1.0 ? '1.0x (Chuẩn)' : `${r}x`}</span>
                ${r === currentRate ? `<span style="color:var(--accent-primary);display:inline-flex;align-items:center;">${icons.check}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('speed-picker-modal');
    modal.querySelector('#modal-speed-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.speed-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rate = parseFloat(btn.dataset.rate);
        this.setPlaybackRate(rate);
        modal.remove();
      });
    });
  }

  async showQualityModal() {
    const { currentTrack } = store.get();
    if (!currentTrack || !currentTrack.youtubeId) {
      this.showToast('Chỉ áp dụng cho video trực tuyến', 1500);
      return;
    }

    const modalContainer = document.getElementById('modal-container');
    
    // Show loading state first
    modalContainer.innerHTML = `
      <div class="quality-modal-backdrop" id="quality-modal">
        <div class="quality-modal">
          <div class="quality-modal-header">
            <h3>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
              Chất lượng video
            </h3>
            <button class="quality-modal-close" id="quality-modal-close">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="quality-loading" id="quality-loading">
            <div class="spinner"></div>
            <span>Đang tải chất lượng có sẵn...</span>
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('quality-modal');
    modal.querySelector('#quality-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Fetch available qualities (with reliable fallback)
    try {
      const res = await (api.youtube.getQualities ? api.youtube.getQualities(currentTrack.youtubeId) : api.get(`/api/youtube/qualities?v=${encodeURIComponent(currentTrack.youtubeId)}`)).catch(() => ({}));
      let qualities = res?.qualities || [];
      if (!Array.isArray(qualities) || qualities.length === 0) {
        qualities = [
          { height: 1080, label: '1080p HD' },
          { height: 720, label: '720p HD' },
          { height: 480, label: '480p' },
          { height: 360, label: '360p' }
        ];
      }
      
      // Add "Auto" option at the beginning
      const allOptions = [
        { height: 0, label: 'Tự động' },
        ...qualities
      ];

      const currentQ = this.currentVideoQuality;
      const loading = document.getElementById('quality-loading');
      if (loading) {
        loading.outerHTML = `
          <div class="quality-modal-list">
            ${allOptions.map(q => {
              const isActive = q.height === currentQ;
              const tagClass = q.height >= 720 ? 'hd' : 'sd';
              const tag = q.height === 0 ? '' 
                : q.height >= 1080 ? `<span class="quality-item-tag hd">FHD</span>`
                : q.height >= 720 ? `<span class="quality-item-tag hd">HD</span>`
                : q.height >= 480 ? `<span class="quality-item-tag sd">SD</span>`
                : '';
              return `
                <button class="quality-modal-item ${isActive ? 'active' : ''}" data-quality="${q.height}">
                  <span>
                    <span class="quality-item-label">${q.label}</span>
                    ${tag}
                  </span>
                </button>
              `;
            }).join('')}
          </div>
        `;
      }

      // Bind quality option clicks
      modal.querySelectorAll('.quality-modal-item').forEach(btn => {
        btn.addEventListener('click', () => {
          const quality = parseInt(btn.dataset.quality, 10);
          this.changeVideoQuality(quality);
          modal.remove();
        });
      });

    } catch (err) {
      console.error('Failed to fetch qualities, applying default list:', err);
      const defaultOptions = [
        { height: 0, label: 'Tự động' },
        { height: 1080, label: '1080p HD' },
        { height: 720, label: '720p HD' },
        { height: 480, label: '480p' },
        { height: 360, label: '360p' }
      ];
      const loading = document.getElementById('quality-loading');
      if (loading) {
        loading.outerHTML = `
          <div class="quality-modal-list">
            ${defaultOptions.map(q => `
              <button class="quality-modal-item ${q.height === this.currentVideoQuality ? 'active' : ''}" data-quality="${q.height}">
                <span>
                  <span class="quality-item-label">${q.label}</span>
                  ${q.height >= 720 ? '<span class="quality-item-tag hd">HD</span>' : ''}
                </span>
              </button>
            `).join('')}
          </div>
        `;
        modal.querySelectorAll('.quality-modal-item').forEach(btn => {
          btn.addEventListener('click', () => {
            const quality = parseInt(btn.dataset.quality, 10);
            this.changeVideoQuality(quality);
            modal.remove();
          });
        });
      }
    }
  }

  changeVideoQuality(quality) {
    const prevQuality = this.currentVideoQuality;
    this.currentVideoQuality = quality;
    localStorage.setItem('muzifi_video_quality', String(quality));

    // Update quality label on video overlay button
    if (this.qualityLabel) {
      this.qualityLabel.textContent = quality === 0 ? 'Auto' : `${quality}p`;
    }

    // If same quality, no need to reload
    if (prevQuality === quality) return;

    const { currentTrack } = store.get();
    if (!currentTrack || !currentTrack.isOnline || currentTrack.media_type !== 'video') {
      this.showToast(quality === 0 ? 'Chất lượng: Tự động' : `Chất lượng: ${quality}p`, 1500);
      return;
    }

    // Save current playback position
    const currentTime = this.activeMedia.currentTime || 0;
    const wasPlaying = !this.activeMedia.paused;

    // Rebuild stream URL with new quality
    const qualityParam = quality ? `&quality=${quality}` : '';
    const newStreamUrl = this.getAuthStreamUrl(`/api/youtube/stream?v=${encodeURIComponent(currentTrack.youtubeId)}&type=video${qualityParam}`);

    this.showToast(quality === 0 ? 'Đang chuyển sang chất lượng tự động...' : `Đang chuyển sang ${quality}p...`, 2000);

    // Reload video with new quality
    this.video.src = newStreamUrl;
    this.video.currentTime = currentTime;
    
    const onCanPlay = async () => {
      this.video.removeEventListener('canplay', onCanPlay);
      this.video.currentTime = currentTime;
      if (wasPlaying) {
        try {
          await this.video.play();
        } catch (err) {
          console.warn('Quality switch autoplay error:', err);
        }
      }
      this.showToast(quality === 0 ? 'Chất lượng: Tự động' : `Đang phát ${quality}p`, 1500);
    };
    this.video.addEventListener('canplay', onCanPlay);
  }

  setLoopMode(mode, showToastNotification = false) {
    store.set({ loopMode: mode });

    // Audio/video looping handled in onEnded() and next() for 100% reliable cross-device playback
    this.audio.loop = false;
    if (this.video) this.video.loop = false;

    if (this.loopBtn) {
      if (mode === 'off') {
        this.loopBtn.classList.remove('active');
        if (this.loopSub) this.loopSub.textContent = '';
        if (showToastNotification) this.showToast('Tắt lặp lại', 1200);
      } else if (mode === 'all') {
        this.loopBtn.classList.add('active');
        if (this.loopSub) this.loopSub.textContent = 'All';
        if (showToastNotification) this.showToast('Lặp lại danh sách', 1200);
      } else if (mode === 'one') {
        this.loopBtn.classList.add('active');
        if (this.loopSub) this.loopSub.textContent = '1';
        if (showToastNotification) this.showToast('Lặp lại 1 bài', 1200);
      }
    }
  }

  cycleLoopMode() {
    const modes = ['off', 'all', 'one'];
    const currentMode = store.get().loopMode || 'off';
    const nextMode = modes[(modes.indexOf(currentMode) + 1) % modes.length];
    this.setLoopMode(nextMode, true);
  }

  toggleShuffle() {
    const { isShuffle, queue, originalQueue, currentTrack } = store.get();
    const newShuffle = !isShuffle;

    if (newShuffle) {
      const orig = originalQueue && originalQueue.length ? [...originalQueue] : [...queue];
      const remaining = orig.filter(t => t.id !== currentTrack?.id);
      for (let i = remaining.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
      }
      const shuffledQueue = currentTrack ? [currentTrack, ...remaining] : remaining;
      store.set({ isShuffle: true, queue: shuffledQueue, originalQueue: orig });
      if (this.shuffleBtn) this.shuffleBtn.classList.add('active');
      this.showToast('Đã bật xáo trộn (Shuffle)', 1200);
      if (this.upNextView && this.upNextView.style.display !== 'none') {
        this.renderUpNextContent();
      }
    } else {
      const restored = originalQueue && originalQueue.length ? [...originalQueue] : [...queue];
      store.set({ isShuffle: false, queue: restored });
      if (this.shuffleBtn) this.shuffleBtn.classList.remove('active');
      this.showToast('Đã tắt xáo trộn', 1200);
      if (this.upNextView && this.upNextView.style.display !== 'none') {
        this.renderUpNextContent();
      }
    }
    this.preloadNextInQueue();
  }

  async next(isUserAction = true) {
    const { queue, currentTrack, loopMode, isPlaylistMode } = store.get();
    if (!queue || queue.length === 0) return;

    const currentIndex = queue.findIndex(t => 
      t.id === currentTrack?.id || (t.youtubeId && currentTrack?.youtubeId && t.youtubeId === currentTrack.youtubeId)
    );
    let nextIndex = currentIndex !== -1 ? currentIndex + 1 : 0;

    if (nextIndex >= queue.length) {
      if (loopMode === 'all') {
        nextIndex = 0;
      } else if (isUserAction) {
        // User manually requested Next: loop back to beginning of queue
        nextIndex = 0;
      } else {
        // Automatically reached the end of queue
        const { isLibraryQueue } = store.get();
        if (isLibraryQueue || !currentTrack?.isOnline || isPlaylistMode || currentTrack?.isPlaylist) {
          this.pause();
          this.seek(0);
          this.hidePlayerLoading();
          return;
        }

        if (navigator.onLine) {
          // Continuous Spotify Autoplay for Online tracks only
          try {
            let ytId = currentTrack?.youtubeId;
            if (!ytId && currentTrack?.source_url) {
              const m = currentTrack.source_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
              if (m) ytId = m[1];
            }
            if (!ytId && currentTrack?.title) {
              const sr = await api.youtube.search(`${currentTrack.title} ${currentTrack.artist || ''}`.trim(), { limit: 1 });
              ytId = sr?.items?.[0]?.id;
            }

            if (ytId) {
              const res = await api.youtube.getRelated(ytId);
              if (res?.items && res.items.length > 0) {
                const currentMediaType = currentTrack?.media_type || 'audio';
                const newTracks = res.items
                  .filter(it => it.id !== ytId)
                  .map(it => ({
                    id: `yt_${it.id}_${currentMediaType}`,
                    youtubeId: it.id,
                    title: it.title,
                    artist: it.channel || 'Nghệ sĩ',
                    album: res.topic || res.genre || 'Radio Trực Tuyến',
                    genre: res.genre || '',
                    duration_sec: it.duration || 0,
                    media_type: currentMediaType,
                    isOnline: true,
                    thumbnail_url: it.thumbnail
                  }));

                const existingIds = new Set(queue.map(t => t.youtubeId || (t.id && t.id.replace('yt_', '').split('_')[0])));
                const freshTracks = newTracks.filter(t => !existingIds.has(t.youtubeId));
                const toAdd = freshTracks.length > 0 ? freshTracks : newTracks.filter(t => t.youtubeId !== ytId);

                if (toAdd.length > 0) {
                  const updatedQueue = [...queue, ...toAdd];
                  store.set({ queue: updatedQueue, originalQueue: updatedQueue });

                  const nextTrack = toAdd[0];
                  if (res.genre) {
                    nextTrack.genre = res.genre;
                    nextTrack.topic = res.topic;
                  }
                  this.loadOnlineTrack(nextTrack);
                  return;
                }
              }
            }
          } catch (err) {
            console.warn('Failed to autoplay related track:', err);
          }

          this.pause();
          this.seek(0);
          this.hidePlayerLoading();
          return; // End of queue
        } else {
          this.pause();
          this.seek(0);
          this.hidePlayerLoading();
          return; // End of playlist / queue
        }
      }
    }

    const nextTrack = queue[nextIndex];
    if (nextTrack) {
      if (nextTrack.isOnline) {
        this.loadOnlineTrack(nextTrack, false);
      } else {
        this.loadTrack(nextTrack, true, 0, false);
      }
    }
  }

  prev() {
    if (this.activeMedia.currentTime > 3) {
      this.seek(0);
      return;
    }

    const { queue, currentTrack } = store.get();
    if (!queue || queue.length === 0) return;

    const currentIndex = queue.findIndex(t => 
      t.id === currentTrack?.id || (t.youtubeId && currentTrack?.youtubeId && t.youtubeId === currentTrack.youtubeId)
    );
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1;
    }

    const prevTrack = queue[prevIndex];
    if (prevTrack) {
      if (prevTrack.isOnline) {
        this.loadOnlineTrack(prevTrack, false);
      } else {
        this.loadTrack(prevTrack, true, 0, false);
      }
    }
  }

  onEnded() {
    const { sleepTimer, loopMode, currentTrack } = store.get();
    if (sleepTimer && sleepTimer.mode === 'end_of_track') {
      this.pause();
      this.clearSleepTimer();
      return;
    }

    if (loopMode === 'one') {
      this.seek(0);
      this.play().catch(() => {
        if (currentTrack) {
          if (currentTrack.isOnline) this.loadOnlineTrack(currentTrack, false);
          else this.loadTrack(currentTrack, true, 0, false);
        }
      });
      return;
    }

    // Automatically advance to next track (isUserAction = false)
    this.next(false);
  }

  onTimeUpdate() {
    if (this.isDraggingScrubber) return;

    const current = this.activeMedia.currentTime || 0;
    const duration = this.getDuration();

    const percent = duration > 0 ? (current / duration) * 100 : 0;
    if (this.scrubberFill) this.scrubberFill.style.width = `${percent}%`;
    if (this.scrubberHandle) this.scrubberHandle.style.left = `${percent}%`;
    if (this.miniProgressFill) this.miniProgressFill.style.width = `${percent}%`;

    if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(current);
    if (this.totalTimeEl) this.totalTimeEl.textContent = this.formatTime(duration);

    store.set({ currentTime: current, duration });

    // Throttle OS lockscreen sync to avoid timeline jitter (OS auto-ticks timeline via playbackRate)
    const now = Date.now();
    if (!this.lastPositionSyncTime || now - this.lastPositionSyncTime >= 4000) {
      this.lastPositionSyncTime = now;
      this.syncPositionState();
    }

    this.updateLyricsHighlight();
    this.checkPreloadNextTrack(current, duration);

    // Smooth volume fade out for end_of_track sleep timer in the final 45 seconds
    const { sleepTimer } = store.get();
    if (sleepTimer && sleepTimer.mode === 'end_of_track' && duration > 0) {
      const timeLeftSec = duration - current;
      if (timeLeftSec <= 45 && timeLeftSec > 0) {
        this.applySleepFade(timeLeftSec * 1000, 45000);
      }
    }
  }

  checkPreloadNextTrack(current, duration) {
    if (!duration || duration <= 0) return;
    const timeLeft = duration - current;

    // Trigger preload when remaining time is 30 seconds or less
    if (timeLeft <= 30 && timeLeft > 0) {
      this.preloadNextInQueue();
    }
  }

  preloadNextInQueue() {
    const { queue, currentTrack, isPlaylistMode, isLibraryQueue } = store.get();
    if (!queue || queue.length === 0) return;

    const currentIndex = queue.findIndex(t => 
      t.id === currentTrack?.id || (t.youtubeId && currentTrack?.youtubeId && t.youtubeId === currentTrack.youtubeId)
    );
    if (currentIndex === -1) return;

    // If approaching end of queue and current track is online, queue similar tracks early (unless playlist or library)
    if (!isPlaylistMode && !isLibraryQueue && !currentTrack?.isPlaylist && currentIndex + 2 >= queue.length && currentTrack?.isOnline && !this.isFetchingSimilar && navigator.onLine) {
      this.fetchAndQueueSimilarTracks(currentTrack);
    }

    const nextTrack = queue[currentIndex + 1];
    if (!nextTrack) return;

    if (this.preloadedTrackId === nextTrack.id) return;

    if (nextTrack.isOnline && nextTrack.youtubeId && navigator.onLine) {
      this.preloadedTrackId = nextTrack.id;
      const mediaType = nextTrack.media_type || 'audio';
      // Preload on server so disk cache is ready before current track ends
      api.youtube.preload({ v: nextTrack.youtubeId, type: mediaType }).catch(err => {
        console.warn('[Preload] Server preload notice:', err);
      });
    } else if (!nextTrack.isOnline && nextTrack.id) {
      // Library track: pre-read from IndexedDB into memory for 0ms transition
      getTrackOffline(nextTrack.id).then(rec => {
        if (rec && rec.blob && rec.blob.size > 0) {
          if (this.preloadedBlobUrl && this.preloadedBlobUrl !== this.currentBlobUrl) {
            try { URL.revokeObjectURL(this.preloadedBlobUrl); } catch (e) {}
          }
          this.preloadedTrackId = nextTrack.id;
          this.preloadedBlobUrl = URL.createObjectURL(rec.blob);
          this.preloadedLyrics = rec.lyrics;
        }
      }).catch(() => {});
    }
  }

  onLoadedMetadata() {
    const duration = this.getDuration();
    if (this.totalTimeEl) this.totalTimeEl.textContent = this.formatTime(duration);
    store.set({ duration });
    this.syncPositionState();
  }

  onPlayStateChange(isPlaying) {
    store.set({ isPlaying });
    this.updateDocumentTitle();
    const playSvg = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    const pauseSvg = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;

    if (this.miniPlayIcon) this.miniPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;
    if (this.mainPlayIcon) this.mainPlayIcon.innerHTML = isPlaying ? pauseSvg : playSvg;

    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }

  async onError(e) {
    console.error('Media playback error:', e);
    this.hidePlayerLoading();
    this.onPlayStateChange(false);

    if (!navigator.onLine) {
      this.showToast('Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.', 3500);
      return;
    }

    const { currentTrack, queue } = store.get();
    if (currentTrack?.isOnline && currentTrack.youtubeId) {
      try {
        const streamUrl = this.getAuthStreamUrl(`/api/youtube/stream?v=${encodeURIComponent(currentTrack.youtubeId)}&type=${currentTrack.media_type || 'audio'}`);
        const checkRes = await fetch(streamUrl);
        if (!checkRes.ok) {
          let errData = {};
          try { errData = await checkRes.json(); } catch { errData = { error: await checkRes.text() }; }

          if (checkRes.status === 403 || errData.code === 'AGE_RESTRICTED' || (errData.error && errData.error.includes('giới hạn độ tuổi'))) {
            this.showToast('Video này bị giới hạn độ tuổi (18+).', 4000);
            this.handlePlaybackSkipAfterError();
            return;
          } else if (checkRes.status === 404 || errData.code === 'UNAVAILABLE' || (errData.error && errData.error.includes('không khả dụng'))) {
            this.showToast('Video này không khả dụng hoặc bị chặn bản quyền.', 4000);
            this.handlePlaybackSkipAfterError();
            return;
          }
        }
      } catch (checkErr) {
        if (!navigator.onLine || checkErr.message?.includes('fetch') || checkErr.message?.includes('network')) {
          this.showToast('Bạn đang offline, hãy chuyển sang nghe nhạc ở thư viện.', 3500);
          return;
        }
        console.warn('Check stream error failed:', checkErr);
      }
    }

    this.showToast('Không thể phát nội dung hoặc luồng video. Vui lòng kiểm tra lại.', 3000);
  }

  handlePlaybackSkipAfterError() {
    const { queue, currentTrack } = store.get();
    if (queue && queue.length > 1) {
      setTimeout(() => {
        const nowCurrent = store.get().currentTrack;
        if (nowCurrent?.id === currentTrack?.id) {
          this.showToast('Đang tự động chuyển sang bài tiếp theo...', 2000);
          this.next();
        }
      }, 2500);
    }
  }

  syncPositionState() {
    if (!('mediaSession' in navigator) || !navigator.mediaSession.setPositionState) return;
    try {
      const duration = this.getDuration();
      if (duration && !isNaN(duration) && duration > 0 && isFinite(duration)) {
        const cur = Math.max(0, Math.min(this.activeMedia.currentTime || 0, duration));
        navigator.mediaSession.setPositionState({
          duration: Math.round(duration * 100) / 100,
          playbackRate: this.activeMedia.playbackRate || 1.0,
          position: Math.round(cur * 100) / 100
        });
      }
    } catch (e) {
      // Ignore rapid sync bounds error
    }
  }

  restoreSleepVolume() {
    if (this._sleepInitialVolume !== undefined && this.activeMedia) {
      try {
        this.activeMedia.volume = this._sleepInitialVolume;
      } catch {}
      delete this._sleepInitialVolume;
    }
  }

  applySleepFade(leftMs, totalFadeMs = 60000) {
    if (!this.activeMedia) return;
    if (leftMs <= totalFadeMs && leftMs > 0) {
      if (this._sleepInitialVolume === undefined) {
        this._sleepInitialVolume = typeof this.activeMedia.volume === 'number' ? this.activeMedia.volume : 1.0;
      }
      const ratio = Math.max(0, Math.min(1, leftMs / totalFadeMs));
      // Psychoacoustic smooth cubic easing curve
      const targetVol = this._sleepInitialVolume * Math.pow(ratio, 1.4);
      this.activeMedia.volume = Math.max(0, Math.min(1, targetVol));
    } else if (leftMs > totalFadeMs && this._sleepInitialVolume !== undefined) {
      this.restoreSleepVolume();
    }
  }

  clearSleepTimer() {
    const { sleepTimerInterval } = store.get();
    if (sleepTimerInterval) {
      clearInterval(sleepTimerInterval);
    }
    this.restoreSleepVolume();
    store.set({ sleepTimer: null, sleepTimerInterval: null });
    if (this.sleepBtn) {
      this.sleepBtn.classList.remove('active');
      this.sleepBtn.title = 'Hẹn giờ đi ngủ';
    }
    if (this.sleepText) {
      this.sleepText.textContent = '';
      this.sleepText.style.display = 'none';
    }
  }

  setSleepTimer(option) {
    this.clearSleepTimer();
    if (!option || option === 'off') return;

    if (option === 'end_of_track') {
      store.set({
        sleepTimer: { mode: 'end_of_track', label: 'Hết bài' },
        sleepTimerInterval: null
      });
      if (this.sleepBtn) {
        this.sleepBtn.classList.add('active');
        this.sleepBtn.title = 'Hẹn giờ: Hết bài hát này';
      }
      if (this.sleepText) {
        this.sleepText.textContent = 'Hết bài';
        this.sleepText.style.display = 'inline-flex';
      }
      return;
    }

    const minutes = parseInt(option, 10);
    if (isNaN(minutes) || minutes <= 0) return;

    const endTime = Date.now() + minutes * 60 * 1000;
    const interval = setInterval(() => {
      const leftMs = endTime - Date.now();
      if (leftMs <= 0) {
        this.pause();
        this.clearSleepTimer();
      } else {
        // Smoothly fade out volume in the last 60 seconds
        this.applySleepFade(leftMs, 60000);

        const leftMin = Math.ceil(leftMs / (60 * 1000));
        if (this.sleepText) {
          if (leftMs <= 60000) {
            this.sleepText.textContent = `${Math.ceil(leftMs / 1000)}s`;
          } else {
            this.sleepText.textContent = `${leftMin}m`;
          }
          this.sleepText.style.display = 'inline-flex';
        }
      }
    }, 1000);

    store.set({
      sleepTimer: { mode: 'minutes', minutes, endTime },
      sleepTimerInterval: interval
    });

    if (this.sleepBtn) {
      this.sleepBtn.classList.add('active');
      this.sleepBtn.title = `Hẹn giờ: ${minutes} phút (giảm dần âm lượng 60s cuối)`;
    }
    if (this.sleepText) {
      this.sleepText.textContent = `${minutes}m`;
      this.sleepText.style.display = 'inline-flex';
    }
  }

  addSleepTimerMinutes(minsToAdd = 5) {
    const { sleepTimer } = store.get();
    if (!sleepTimer || sleepTimer.mode !== 'minutes') {
      this.setSleepTimer(minsToAdd);
      return;
    }
    const newEndTime = (sleepTimer.endTime || Date.now()) + minsToAdd * 60 * 1000;
    sleepTimer.endTime = newEndTime;
    const leftMin = Math.ceil((newEndTime - Date.now()) / (60 * 1000));
    sleepTimer.minutes = leftMin;
    this.restoreSleepVolume();
    store.set({ sleepTimer: { ...sleepTimer } });
    if (this.sleepText) {
      this.sleepText.textContent = `${leftMin}m`;
      this.sleepText.style.display = 'inline-flex';
    }
  }

  showSleepTimerModal() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const { sleepTimer } = store.get();
    const isRunning = !!sleepTimer;

    const formatRemaining = () => {
      const currentTimer = store.get().sleepTimer;
      if (!currentTimer) return '';
      if (currentTimer.mode === 'end_of_track') return 'Dừng khi hết bài hát hiện tại';
      if (currentTimer.endTime) {
        const leftSec = Math.max(0, Math.floor((currentTimer.endTime - Date.now()) / 1000));
        const m = Math.floor(leftSec / 60);
        const s = leftSec % 60;
        return `Còn ${m}:${s.toString().padStart(2, '0')}`;
      }
      return '';
    };

    const options = [
      { id: 'off', label: 'Tắt hẹn giờ' },
      { id: 5, label: '5 phút' },
      { id: 10, label: '10 phút' },
      { id: 15, label: '15 phút' },
      { id: 20, label: '20 phút' },
      { id: 30, label: '30 phút' },
      { id: 45, label: '45 phút' },
      { id: 60, label: '60 phút' },
      { id: 'end_of_track', label: 'Hết bài hát này' }
    ];

    const currentSelected = !sleepTimer ? 'off' : (sleepTimer.mode === 'end_of_track' ? 'end_of_track' : sleepTimer.minutes);

    modalContainer.innerHTML = `
      <div class="modal-overlay" id="sleep-timer-modal" style="display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,0.65);">
        <div class="modal-card" style="max-width:440px;width:100%;border-radius:24px 24px 0 0;padding:16px 20px 24px 20px;max-height:85vh;display:flex;flex-direction:column;animation:slideUpSheet 0.22s ease-out;background:var(--bg-surface, #1e1e24);border:1px solid var(--border-subtle);border-bottom:none;">
          <div style="width:36px;height:4px;background:rgba(255,255,255,0.25);border-radius:2px;margin:0 auto 14px auto;"></div>
          <div class="modal-header" style="padding-bottom:12px;border-bottom:1px solid var(--border-subtle);display:flex;justify-content:space-between;align-items:center;">
            <h3 class="modal-title" style="font-size:1.05rem;display:flex;align-items:center;gap:10px;margin:0;font-weight:700;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Hẹn giờ đi ngủ
            </h3>
            <button class="icon-btn" id="modal-sleep-close" style="min-width:32px;min-height:32px;">${icons.x}</button>
          </div>

          <div style="font-size:0.75rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;padding:10px 4px 4px 4px;">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
            <span>Tự động giảm âm lượng êm dịu trong 60 giây cuối trước khi dừng</span>
          </div>

          ${isRunning ? `
            <div style="background:rgba(99,102,241,0.12);border:1px solid rgba(99,102,241,0.3);border-radius:var(--radius-md);padding:12px 14px;margin-top:12px;display:flex;align-items:center;justify-content:space-between;">
              <div>
                <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">Đang hẹn giờ</div>
                <div id="sleep-modal-countdown" style="font-size:0.95rem;font-weight:700;color:var(--accent-primary, #818cf8);margin-top:2px;">
                  ${formatRemaining()}
                </div>
              </div>
              <div style="display:flex;gap:8px;">
                ${sleepTimer.mode === 'minutes' ? `
                  <button id="btn-sleep-add-5" class="pill-btn" style="min-height:30px;padding:2px 10px;font-size:0.75rem;font-weight:600;background:var(--accent-primary, #6366f1);color:#fff;">+ 5 phút</button>
                ` : ''}
                <button id="btn-sleep-turn-off" class="pill-btn" style="min-height:30px;padding:2px 10px;font-size:0.75rem;color:#f87171;border:1px solid rgba(248,113,113,0.3);">Tắt</button>
              </div>
            </div>
          ` : ''}

          <div class="modal-body" style="padding:10px 0 0 0;overflow-y:auto;display:flex;flex-direction:column;gap:2px;max-height:55vh;">
            ${options.map(opt => {
              const isSelected = String(currentSelected) === String(opt.id);
              return `
                <button class="sleep-option-btn" data-id="${opt.id}" style="display:flex;align-items:center;justify-content:space-between;width:100%;padding:13px 14px;border-radius:12px;background:${isSelected ? 'rgba(255,255,255,0.08)' : 'transparent'};border:none;color:${isSelected ? 'var(--accent-primary, #818cf8)' : 'var(--text-main)'};font-size:0.92rem;font-weight:${isSelected ? '700' : '500'};text-align:left;cursor:pointer;transition:background 0.15s ease;">
                  <span>${opt.label}</span>
                  ${isSelected ? `<span style="display:flex;align-items:center;color:var(--accent-primary, #818cf8);">${icons.check}</span>` : ''}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const modal = document.getElementById('sleep-timer-modal');
    const closeBtn = document.getElementById('modal-sleep-close');
    const turnOffBtn = document.getElementById('btn-sleep-turn-off');
    const add5Btn = document.getElementById('btn-sleep-add-5');
    const countdownEl = document.getElementById('sleep-modal-countdown');

    const closeModal = () => {
      if (modalInterval) clearInterval(modalInterval);
      modal?.remove();
    };

    closeBtn?.addEventListener('click', closeModal);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    let modalInterval = null;
    if (isRunning && sleepTimer.mode === 'minutes' && countdownEl) {
      modalInterval = setInterval(() => {
        if (!store.get().sleepTimer) {
          clearInterval(modalInterval);
          closeModal();
          return;
        }
        countdownEl.textContent = formatRemaining();
      }, 1000);
    }

    if (turnOffBtn) {
      turnOffBtn.addEventListener('click', () => {
        this.clearSleepTimer();
        closeModal();
      });
    }

    if (add5Btn) {
      add5Btn.addEventListener('click', () => {
        this.addSleepTimerMinutes(5);
        if (countdownEl) countdownEl.textContent = formatRemaining();
      });
    }

    modal.querySelectorAll('.sleep-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id === 'off') {
          this.clearSleepTimer();
        } else if (id === 'end_of_track') {
          this.setSleepTimer('end_of_track');
        } else {
          this.setSleepTimer(parseInt(id, 10));
        }
        closeModal();
      });
    });
  }

  showToast(message, durationMs = 1500) {
    // Top toasts completely removed per user request
  }

  openFullPlayer() {
    if (this.fullPlayer) {
      this.fullPlayer.style.display = 'flex';
      this.fullPlayer.classList.remove('slide-in');
      void this.fullPlayer.offsetWidth;
      this.fullPlayer.classList.add('slide-in');
    }
  }

  isFullPlayerOpen() {
    return Boolean(this.fullPlayer && this.fullPlayer.style.display !== 'none');
  }

  closeFullPlayer() {
    if (this.fullPlayer) {
      this.fullPlayer.classList.remove('slide-in');
      this.fullPlayer.style.display = 'none';
    }
  }

  onForegroundResume() {
    if (!this.activeMedia) return;

    // 1. Sync play state & time directly from media element
    const current = this.activeMedia.currentTime || 0;
    const isPlaying = !this.activeMedia.paused && !this.activeMedia.ended;
    store.set({ isPlaying, currentTime: current });
    this.onPlayStateChange(isPlaying);
    this.syncPositionState();

    // 2. Refresh scrubber and time elements
    if (this.currentTimeEl) this.currentTimeEl.textContent = this.formatTime(current);
    const duration = this.getDuration();
    if (this.totalTimeEl && duration > 0) this.totalTimeEl.textContent = this.formatTime(duration);
    if (this.scrubberFill && duration > 0) {
      const pct = (current / duration) * 100;
      this.scrubberFill.style.width = `${pct}%`;
      if (this.scrubberHandle) this.scrubberHandle.style.left = `${pct}%`;
    }
    if (this.miniProgressFill && duration > 0) {
      this.miniProgressFill.style.width = `${(current / duration) * 100}%`;
    }

    // 3. Ensure player visibility and force compositor redraw
    if (this.fullPlayer && this.fullPlayer.style.display !== 'none') {
      this.fullPlayer.style.opacity = '1';
      this.fullPlayer.style.transform = 'translateY(0)';
      if (this.upNextView && this.upNextView.style.display !== 'none') {
        this.renderUpNextContent();
      }
    }

    if (this.isLyricsOpen) {
      this.updateLyricsHighlight();
    }
  }

  startStateSyncTimer() {
    setInterval(() => {
      const { currentTrack, queue, loopMode, isShuffle, playbackRate, isAuthenticated } = store.get();
      if (!currentTrack || !isAuthenticated) return;

      const positionSec = Math.round(this.activeMedia.currentTime || 0);

      localStorage.setItem('cloudbeats_state', JSON.stringify({
        trackId: currentTrack.id,
        positionSec,
        loopMode,
        isShuffle,
        playbackRate,
      }));

      if (Math.abs(positionSec - this.lastSavedPosition) >= 5) {
        this.lastSavedPosition = positionSec;
        api.player.updateState({
          track_id: currentTrack.id,
          position_sec: positionSec,
          queue: queue.map(t => t.id),
          loop_mode: loopMode,
          shuffle: isShuffle ? 1 : 0,
          rate: playbackRate
        }).catch(() => {});
      }
    }, 5000);
  }

  formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  formatRelativeTime(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const diffSec = Math.floor((now - date) / 1000);
      if (diffSec < 60) return 'Vừa xong';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`;
      if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)} ngày trước`;
      if (diffSec < 31536000) return `${Math.floor(diffSec / 2592000)} tháng trước`;
      return `${Math.floor(diffSec / 31536000)} năm trước`;
    } catch {
      return '';
    }
  }

  /** Tell the Service Worker to background-cache a track for offline playback */
  notifySWCacheTrack(trackId) {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const token = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
      navigator.serviceWorker.controller.postMessage({
        type: 'CACHE_TRACK',
        trackId,
        token
      });
    }
  }

  openLyrics() {
    this.closeUpNext();
    this.isLyricsOpen = true;
    if (this.lyricsView) this.lyricsView.style.display = 'flex';
    if (this.tabLyricsBtn) this.tabLyricsBtn.classList.add('active');

    // If lyrics are already available and valid, ensure they are rendered into the DOM
    if (this.currentLyrics && (this.currentLyrics.hasSynced || this.currentLyrics.plainLyrics)) {
      if (!this.lyricsLinesWrapper || !this.lyricsLinesWrapper.hasChildNodes()) {
        this.renderLyrics(this.currentLyrics);
      } else {
        this.updateLyricsHighlight(true);
      }
    } else {
      this.loadLyricsForCurrentTrack();
    }
  }

  closeLyrics() {
    this.isLyricsOpen = false;
    if (this.lyricsView) this.lyricsView.style.display = 'none';
    if (this.tabLyricsBtn) this.tabLyricsBtn.classList.remove('active');
  }

  toggleLyrics() {
    if (this.isLyricsOpen || (this.lyricsView && this.lyricsView.style.display !== 'none')) {
      this.closeLyrics();
    } else {
      this.openLyrics();
    }
  }

  async loadLyricsForCurrentTrack() {
    const track = store.get().currentTrack;
    if (!track) return;

    this.lyricsLoadingTrackId = track.id;
    if (this.lyricsLoading) this.lyricsLoading.style.display = 'flex';
    if (this.lyricsEmpty) this.lyricsEmpty.style.display = 'none';
    if (this.lyricsLinesWrapper) this.lyricsLinesWrapper.innerHTML = '';
    if (this.lyricsTrackTitle) {
      this.lyricsTrackTitle.textContent = `${track.title} • ${track.artist || 'Nghệ sĩ'}`;
    }

    // Check IndexedDB offline lyrics first
    try {
      const offlineRec = await getTrackOffline(track.id);
      if (offlineRec && offlineRec.lyrics && (offlineRec.lyrics.hasSynced || offlineRec.lyrics.plainLyrics)) {
        if (this.lyricsLoadingTrackId !== track.id) return;
        if (this.lyricsLoading) this.lyricsLoading.style.display = 'none';
        this.currentLyrics = offlineRec.lyrics;
        this.renderLyrics(offlineRec.lyrics);
        return;
      }
    } catch {}

    try {
      const ytId = track.youtubeId || 
        (track.id && track.id.startsWith('yt_') ? track.id.split('_')[1] : '') ||
        (track.source_url ? (track.source_url.match(/(?:v=|\/embed\/|\/watch\?v=|youtu\.be\/|\/v\/)([a-zA-Z0-9_-]{11})/)?.[1] || '') : '');

      const res = await api.lyrics.get({
        trackId: track.isOnline ? '' : (track.id || ''),
        youtubeId: ytId,
        title: track.title || '',
        artist: track.artist || '',
        duration: track.duration_sec || 0
      });

      if (this.lyricsLoadingTrackId !== track.id) return;
      if (this.lyricsLoading) this.lyricsLoading.style.display = 'none';

      if (res && res.success && (res.hasSynced || res.plainLyrics)) {
        this.currentLyrics = res;
        this.renderLyrics(res);
      } else {
        this.currentLyrics = null;
        if (this.lyricsEmpty) this.lyricsEmpty.style.display = 'flex';
      }
    } catch (err) {
      console.warn('Error loading lyrics:', err);
      if (this.lyricsLoading) this.lyricsLoading.style.display = 'none';
      if (this.lyricsEmpty) this.lyricsEmpty.style.display = 'flex';
    }
  }

  renderLyrics(lyricsData) {
    if (!this.lyricsLinesWrapper) return;
    this.lyricsLinesWrapper.innerHTML = '';

    if (lyricsData.hasSynced && lyricsData.parsedLyrics?.length > 0) {
      this.lyricsLinesWrapper.innerHTML = lyricsData.parsedLyrics.map((item, idx) => {
        const text = item.text || '...';
        return `<div class="lyric-line" data-time="${item.time}" data-index="${idx}">${this.escapeHtml(text)}</div>`;
      }).join('');

      this.lyricsLinesWrapper.querySelectorAll('.lyric-line').forEach(el => {
        el.addEventListener('click', () => {
          const time = parseFloat(el.dataset.time);
          if (!isNaN(time)) {
            this.seek(time);
            this.play();
          }
        });
      });

      this.updateLyricsHighlight(true);
    } else if (lyricsData.plainLyrics) {
      const lines = lyricsData.plainLyrics.split('\n');
      this.lyricsLinesWrapper.innerHTML = lines.map(line => {
        const text = line.trim();
        return text ? `<div class="lyric-line plain">${this.escapeHtml(text)}</div>` : `<div style="height:12px;"></div>`;
      }).join('');
    }
  }

  updateLyricsHighlight(forceScroll = false) {
    if (!this.isLyricsOpen || !this.currentLyrics?.hasSynced) return;

    const currentTime = this.activeMedia.currentTime || 0;
    const lines = this.currentLyrics.parsedLyrics || [];
    if (lines.length === 0) return;

    let activeIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (currentTime >= lines[i].time) {
        activeIndex = i;
      } else {
        break;
      }
    }

    if (activeIndex !== this.currentLyricIndex || forceScroll) {
      this.currentLyricIndex = activeIndex;
      const lineEls = this.lyricsLinesWrapper.querySelectorAll('.lyric-line');
      lineEls.forEach((el, idx) => {
        if (idx === activeIndex) {
          el.classList.add('active');
          if (this.lyricsScrollContainer) {
            const container = this.lyricsScrollContainer;
            const targetScroll = el.offsetTop - (container.clientHeight / 2) + (el.clientHeight / 2);
            container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
          }
        } else {
          el.classList.remove('active');
        }
      });
    }
  }

  openUpNext() {
    this.closeLyrics();
    if (this.upNextView) {
      this.upNextView.style.display = 'flex';
    }
    if (this.tabUpNextBtn) this.tabUpNextBtn.classList.add('active');
    this.renderUpNextContent();
  }

  closeUpNext() {
    if (this.upNextView) {
      this.upNextView.style.display = 'none';
    }
    if (this.tabUpNextBtn) this.tabUpNextBtn.classList.remove('active');
  }

  toggleUpNext() {
    if (this.upNextView && this.upNextView.style.display !== 'none') {
      this.closeUpNext();
    } else {
      this.openUpNext();
    }
  }

  renderUpNextContent() {
    if (!this.upNextContentWrapper) return;
    const { queue, currentTrack, isLibraryQueue } = store.get();
    if (this.upNextSubtitle) {
      this.upNextSubtitle.textContent = '';
    }

    if (!queue || queue.length === 0) {
      this.upNextContentWrapper.innerHTML = `
        <div style="padding:24px 16px;text-align:center;color:var(--text-muted);font-size:0.85rem;background:var(--bg-surface);border-radius:var(--radius-md);">
          Danh sách phát trống.
        </div>
      `;
      return;
    }

    const titlePrefix = isLibraryQueue ? 'Danh sách phát thư viện' : 'Danh sách phát';
    const genrePill = (!isLibraryQueue && currentTrack?.genre)
      ? `<span style="font-size:0.7rem;padding:2px 8px;border-radius:10px;background:var(--accent-glow, rgba(99,102,241,0.15));color:var(--accent-primary, #6366f1);font-weight:600;text-transform:none;">${this.escapeHtml(currentTrack.genre)}</span>`
      : '';
    const fetchingPill = (!isLibraryQueue && this.isFetchingSimilar)
      ? '<span style="font-size:0.72rem;color:var(--accent-primary);text-transform:none;display:inline-flex;align-items:center;gap:4px;"><svg class="spin-loader" viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Đang thêm...</span>'
      : '';

    this.upNextContentWrapper.innerHTML = `
      <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <div style="font-size:0.75rem;font-weight:700;letter-spacing:0.06em;color:var(--text-secondary);text-transform:uppercase;display:flex;align-items:center;gap:6px;">
          ${icons.music}
          <span>${titlePrefix} (${queue.length})</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${genrePill}
          ${fetchingPill}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;">
        ${queue.map((track, idx) => {
          const isPlaying = (track.id === currentTrack?.id) || 
            (track.youtubeId && currentTrack?.youtubeId && track.youtubeId === currentTrack.youtubeId);
          const thumb = track.isOnline
            ? (track.thumbnail_url || `https://i.ytimg.com/vi/${track.youtubeId}/hqdefault.jpg`)
            : `/api/tracks/${track.id}/thumb`;

          return `
            <div class="ytm-queue-item ${isPlaying ? 'active' : ''}" data-id="${track.id}">
              <div class="ytm-item-index" style="${isPlaying ? 'color:var(--accent-primary, #10b981);font-weight:bold;' : ''}">
                ${isPlaying ? icons.play : (idx + 1)}
              </div>
              <div class="ytm-item-thumb-box" style="position:relative;">
                <img class="ytm-item-thumb" src="${thumb}" alt="" loading="lazy">
                <span style="position:absolute;bottom:2px;right:2px;background:rgba(0,0,0,0.7);border-radius:3px;padding:1px;display:flex;color:#fff;">
                  ${track.media_type === 'video' ? icons.videoFile : icons.audioFile}
                </span>
              </div>
              <div class="ytm-item-info">
                <div class="ytm-item-title" title="${this.escapeHtml(track.title)}" style="${isPlaying ? 'color:var(--accent-primary, #10b981);font-weight:bold;' : ''}">
                  ${this.escapeHtml(track.title)}
                </div>
                <div class="ytm-item-artist">
                  ${this.escapeHtml(track.artist || 'Nghệ sĩ')}
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="ytm-item-duration">
                  ${this.formatTime(track.duration_sec || 0)}
                </div>
                <button class="icon-btn btn-upnext-share" data-id="${track.id}" title="Chia sẻ bài hát" style="width:30px;height:30px;border-radius:50%;color:var(--text-muted);">
                  ${icons.share}
                </button>
                ${track.isOnline ? `
                  <button class="icon-btn btn-upnext-dl" data-id="${track.id}" title="Tải bài này về máy" style="width:30px;height:30px;border-radius:50%;color:var(--text-muted);">
                    ${icons.download}
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Bind click events on items
    this.upNextContentWrapper.querySelectorAll('.ytm-queue-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('.btn-upnext-dl') || e.target.closest('.btn-upnext-share')) return;
        const id = el.dataset.id;
        const targetTrack = queue.find(t => t.id === id);
        if (targetTrack) {
          if (targetTrack.isOnline) {
            this.loadOnlineTrack(targetTrack, false);
          } else {
            this.loadTrack(targetTrack, true, 0, false);
          }
        }
      });
    });

    // Bind click on upnext share buttons
    this.upNextContentWrapper.querySelectorAll('.btn-upnext-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const targetTrack = (currentTrack && currentTrack.id === id) ? currentTrack : queue.find(t => t.id === id);
        if (targetTrack) this.shareTrack(targetTrack);
      });
    });

    // Bind click on upnext download buttons
    this.upNextContentWrapper.querySelectorAll('.btn-upnext-dl').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const targetTrack = (currentTrack && currentTrack.id === id) ? currentTrack : queue.find(t => t.id === id);
        if (targetTrack) this.downloadTrackAudio(targetTrack, btn);
      });
    });

    // Smoothly scroll active item into view
    setTimeout(() => {
      const activeItem = this.upNextContentWrapper.querySelector('.ytm-queue-item.active');
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }, 80);
  }

  updateTrackGenre(genre, topic, isMusic, chips = []) {
    const { currentTrack } = store.get();
    if (!currentTrack) return;
    currentTrack.genre = genre;
    currentTrack.topic = topic;
    currentTrack.isMusic = isMusic;
    currentTrack.chips = chips;
    store.set({ currentTrack: { ...currentTrack } });

    if (this.playerTypeBadge) {
      const isVideo = currentTrack.media_type === 'video';
      this.playerTypeBadge.innerHTML = isVideo ? `${icons.videoFile} Video` : `${icons.audioFile} Audio`;
    }

    if (this.upNextView && this.upNextView.style.display !== 'none') {
      this.renderUpNextContent();
    }
  }

  showDownloadModalForTrack(track, sourceEl = null) {
    this.downloadTrackAudio(track, sourceEl);
  }

  async downloadTrackAudio(track, sourceEl = null) {
    if (!track) {
      this.showToast('Không có bài nào đang phát', 1500);
      return;
    }

    // Trigger fly-to-corner animation
    const startSource = sourceEl || this.playerDownloadBtn || document.getElementById('player-thumb');
    animateFlyToCorner(startSource, track);

    let youtubeId = track.youtubeId;
    if (!youtubeId && track.id) {
      if (typeof track.id === 'string') {
        if (track.id.startsWith('yt_')) {
          youtubeId = track.id.split('_')[1];
        } else if (/^[a-zA-Z0-9_-]{11}$/.test(track.id)) {
          youtubeId = track.id;
        }
      }
    }
    if (!youtubeId && track.source_url) {
      const match = track.source_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) youtubeId = match[1];
    }
    if (!youtubeId && track.url) {
      const match = track.url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) youtubeId = match[1];
    }

    if (!youtubeId) {
      this.showToast('Tệp này đã có sẵn trong thư viện cá nhân', 2500);
      return;
    }

    const title = track.title || 'bài hát';
    const artist = track.artist || track.channel || '';
    this.showToast(`Đang thêm audio "${title}" vào tiến trình tải...`, 2000);
    try {
      await api.youtube.download({
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        mediaType: 'audio',
        quality: '720p',
        title: title,
        artist: artist
      });
      this.showToast(`Đã thêm "${title}" vào danh sách tác vụ tải!`, 3000);
      try {
        const jobs = await api.jobs.list();
        store.setJobs(jobs);
      } catch {}
    } catch (err) {
      console.error('Download error:', err);
      this.showToast(`Lỗi tải: ${err.message}`, 3000);
    }
  }

  showUpNextModal() {
    this.openFullPlayer();
    this.openUpNext();
  }

  showQueueModal() {
    this.showUpNextModal();
  }

  async fetchAndQueueSimilarTracks(track) {
    if (!track) return;
    const { isPlaylistMode, isLibraryQueue } = store.get();
    if (isPlaylistMode || track.isPlaylist || isLibraryQueue || !track.isOnline) return;
    if (this.isFetchingSimilar) return;

    let youtubeId = track.youtubeId;
    if (!youtubeId && track.source_url) {
      const match = track.source_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) youtubeId = match[1];
    }

    // If it's a library track without YouTube ID, search YouTube to find its matching seed ID
    if (!youtubeId && track.title && navigator.onLine) {
      try {
        const query = `${track.title} ${track.artist || ''}`.trim();
        const searchRes = await api.youtube.search(query, { limit: 1 });
        if (searchRes?.items?.[0]?.id) {
          youtubeId = searchRes.items[0].id;
        }
      } catch (err) {
        console.warn('Could not resolve YouTube ID for track:', err);
      }
    }

    if (!youtubeId) return;

    this.isFetchingSimilar = true;
    if (this.upNextView && this.upNextView.style.display !== 'none') {
      this.renderUpNextContent();
    }

    try {
      const res = await api.youtube.getRelated(youtubeId);
      const current = store.get().currentTrack;
      if (!current || (current.id !== track.id && current.youtubeId !== youtubeId)) return;

      if (res) {
        if (res.genre) {
          this.updateTrackGenre(res.genre, res.topic, res.isMusic, res.chips || []);
        }

        if (res.items && res.items.length > 0) {
          const mediaType = track.media_type || 'audio';
          const similarTracks = res.items
            .filter(it => it.id !== youtubeId)
            .map(it => ({
              id: `yt_${it.id}_${mediaType}`,
              youtubeId: it.id,
              title: it.title,
              artist: it.channel || 'Nghệ sĩ',
              album: res.topic || res.genre || 'Radio Trực Tuyến',
              genre: res.genre || '',
              duration_sec: it.duration || 0,
              media_type: mediaType,
              isOnline: true,
              thumbnail_url: it.thumbnail,
            }));

          const { queue } = store.get();
          const existingIds = new Set(queue.map(t => t.youtubeId || (t.id && t.id.replace('yt_', '').split('_')[0])));
          const fresh = similarTracks.filter(t => !existingIds.has(t.youtubeId));

          if (fresh.length > 0) {
            const updated = [...queue, ...fresh];
            store.set({ queue: updated, originalQueue: updated });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to fetch similar tracks:', e.message);
    } finally {
      this.isFetchingSimilar = false;
      if (this.upNextView && this.upNextView.style.display !== 'none') {
        this.renderUpNextContent();
      }
    }
  }

  async shareTrack(track) {
    if (!track) return;
    const origin = window.location.origin;
    let ytId = track.youtube_id || track.youtubeId;
    if (!ytId && track.id && typeof track.id === 'string' && track.id.startsWith('yt_')) {
      const parts = track.id.split('_');
      if (parts.length >= 2) ytId = parts[1];
    }
    if (!ytId && track.source_url) {
      const match = track.source_url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) ytId = match[1];
    }
    if (!ytId && track.url) {
      const match = track.url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match) ytId = match[1];
    }
    const isOnline = !!(ytId || track.isOnline);
    const shareUrl = isOnline && ytId
      ? `${origin}/?v=${encodeURIComponent(ytId)}`
      : `${origin}/?track=${encodeURIComponent(track.id)}`;

    const cleanTitle = (track.title || 'Bài hát').replace(/\s*-\s*YouTube$/i, '').trim();
    let rawArtist = track.artist || track.channel || '';
    if (/^youtube$/i.test(rawArtist.trim())) rawArtist = '';
    else rawArtist = rawArtist.replace(/\byoutube\b/gi, '').trim();
    // Mobile: native share sheet
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `${cleanTitle}${rawArtist && rawArtist !== 'Nghệ sĩ' ? ` - ${rawArtist}` : ''} | Muzifi`,
          text: `Nghe "${cleanTitle}" trên Muzifi:`,
          url: shareUrl
        });
        return;
      } catch (err) {
        if (err.name === 'AbortError') return;
        // fall through to modal
      }
    }

    // Desktop: copy link immediately to clipboard and open share options
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch (_) {}

    this.showToast(copied ? 'Đã sao chép liên kết chia sẻ' : 'Chia sẻ bài hát', 2000);
    this.showShareModal({ title: cleanTitle, artist: rawArtist, shareUrl, copied });
  }

  showShareModal({ title, artist, shareUrl, copied = false }) {
    document.getElementById('share-modal-overlay')?.remove();
    const displayArtist = (artist && artist !== 'Nghệ sĩ') ? artist : '';
    const overlay = document.createElement('div');
    overlay.id = 'share-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <style>
        @keyframes _sm_up{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        #share-modal-box{background:var(--bg-secondary,#1e1e2e);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:26px 22px 22px;width:min(440px,92vw);animation:_sm_up .25s cubic-bezier(.34,1.56,.64,1);box-shadow:0 24px 64px rgba(0,0,0,.6);}
        #share-modal-box h3{margin:0 0 2px;font-size:1rem;color:var(--text-primary,#fff);}
        .sm-subtitle{font-size:.8rem;color:var(--text-secondary,#aaa);margin-bottom:18px;}
        .sm-label{font-size:.72rem;color:var(--text-secondary,#aaa);margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em;}
        .sm-link-row{display:flex;gap:8px;align-items:center;}
        .sm-link-input{flex:1;background:var(--bg-tertiary,#2a2a3e);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:10px 12px;color:var(--text-primary,#fff);font-size:.85rem;outline:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
        #sm-copy-btn{background:var(--accent,#7c3aed);color:#fff;border:none;border-radius:10px;padding:10px 16px;font-size:.85rem;font-weight:600;cursor:pointer;white-space:nowrap;transition:background .2s,transform .1s;}
        #sm-copy-btn:hover{background:var(--accent-hover,#6d28d9);}
        #sm-copy-btn:active{transform:scale(.95);}
        .sm-socials{display:flex;gap:10px;margin-top:16px;}
        .sm-soc-btn{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:9px 8px;font-size:.8rem;font-weight:500;color:var(--text-primary,#fff);text-decoration:none;transition:background .18s;cursor:pointer;}
        .sm-soc-btn:hover{background:rgba(255,255,255,.13);}
        #sm-close-btn{float:right;background:none;border:none;cursor:pointer;color:var(--text-secondary,#aaa);font-size:1.3rem;line-height:1;padding:0;margin-top:-4px;transition:color .15s;}
        #sm-close-btn:hover{color:#fff;}
      </style>
      <div id="share-modal-box">
        <button id="sm-close-btn" aria-label="Đóng">&#x2715;</button>
        <h3>Chia s&#7867; b&#224;i h&#225;t</h3>
        <div class="sm-subtitle">${displayArtist ? `${this.escapeHtml(title)} &mdash; ${this.escapeHtml(displayArtist)}` : this.escapeHtml(title)}</div>
        <div class="sm-label">Li&#234;n k&#7871;t chia s&#7867;</div>
        <div class="sm-link-row">
          <input id="sm-link-input" class="sm-link-input" type="text" readonly value="${shareUrl}" />
          <button id="sm-copy-btn">Sao ch&#233;p</button>
        </div>
        <div class="sm-socials">
          <a class="sm-soc-btn" id="sm-wa" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WhatsApp
          </a>
          <a class="sm-soc-btn" id="sm-fb" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877f2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.994 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            Facebook
          </a>
          <a class="sm-soc-btn" id="sm-tg" target="_blank" rel="noopener">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="#29b6f6"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            Telegram
          </a>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const enc = encodeURIComponent(shareUrl);
    const txt = encodeURIComponent(`Nghe "${title}" tr\u00ean Muzifi: ${shareUrl}`);
    overlay.querySelector('#sm-wa').href = `https://wa.me/?text=${txt}`;
    overlay.querySelector('#sm-fb').href = `https://www.facebook.com/sharer/sharer.php?u=${enc}`;
    overlay.querySelector('#sm-tg').href = `https://t.me/share/url?url=${enc}&text=${encodeURIComponent(`Nghe "${title}" tr\u00ean Muzifi`)}`;
    const copyBtn = overlay.querySelector('#sm-copy-btn');
    const linkInput = overlay.querySelector('#sm-link-input');

    if (copied) {
      copyBtn.textContent = '\u2713 \u0110\u00e3 sao ch\u00e9p';
      copyBtn.style.background = '#22c55e';
      setTimeout(() => { copyBtn.textContent = 'Sao ch\u00e9p'; copyBtn.style.background = ''; }, 2500);
    }
    copyBtn.addEventListener('click', async () => {
      let ok = false;
      try { await navigator.clipboard.writeText(shareUrl); ok = true; } catch (_) {}
      if (!ok) { try { linkInput.select(); ok = document.execCommand('copy'); } catch (_) {} }
      if (ok) {
        copyBtn.textContent = '\u2713 \u0110\u00e3 sao ch\u00e9p';
        copyBtn.style.background = '#22c55e';
        setTimeout(() => { copyBtn.textContent = 'Sao ch\u00e9p'; copyBtn.style.background = ''; }, 2000);
      }
    });
    linkInput.addEventListener('click', () => linkInput.select());
    const close = () => overlay.remove();
    overlay.querySelector('#sm-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
  }

  shareCurrentTrack() {
    const { currentTrack } = store.get();
    if (currentTrack) {
      this.shareTrack(currentTrack);
    } else {
      this.showToast('Chưa có bài hát nào đang phát', 2000);
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
