let onUnauthorizedCallback = null;

export function setUnauthorizedHandler(fn) {
  onUnauthorizedCallback = fn;
}

async function request(url, options = {}) {
  options.credentials = 'include';
  if (!options.headers) {
    options.headers = {};
  }

  const token = localStorage.getItem('muzifi_token') || localStorage.getItem('metube_token');
  if (token && !options.headers['Authorization']) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  // Auto set JSON content-type if body is an object and not FormData
  if (options.body && !(options.body instanceof FormData) && typeof options.body === 'object') {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, options);

  if (res.status === 401) {
    if (onUnauthorizedCallback) {
      onUnauthorizedCallback();
    }
    const err = await res.json().catch(() => ({ error: 'Unauthorized' }));
    throw new Error(err.error || 'Vui lòng đăng nhập');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `Request failed with status ${res.status}`);
  }

  return res.json().catch(() => ({}));
}

export const api = {
  auth: {
    check: () => request('/api/auth/me'),
    login: (password, profileId) => request('/api/auth/login', { method: 'POST', body: { password, profileId } }),
    logout: async () => {
      try {
        await request('/api/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem('muzifi_token');
        localStorage.removeItem('metube_token');
      }
    },
    googleUrl: () => request('/api/auth/google/url'),
  },
  tracks: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/api/tracks?${q}`);
    },
    update: (id, data) => request(`/api/tracks/${id}`, { method: 'PATCH', body: data }),
    delete: (id) => request(`/api/tracks/${id}`, { method: 'DELETE' }),
    batchDelete: (ids) => request('/api/tracks/batch-delete', { method: 'POST', body: { ids } }),
    upload: (formData, onProgress) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/tracks/upload');
        xhr.withCredentials = true;

        if (xhr.upload && onProgress) {
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const percent = Math.round((e.loaded / e.total) * 100);
              onProgress(percent, e.loaded, e.total);
            }
          };
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch (err) {
              resolve({});
            }
          } else if (xhr.status === 401) {
            if (onUnauthorizedCallback) onUnauthorizedCallback();
            reject(new Error('Unauthorized'));
          } else {
            let msg = 'Upload failed';
            try {
              const data = JSON.parse(xhr.responseText);
              msg = data.error || msg;
            } catch (e) {}
            reject(new Error(msg));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    }
  },
  get: (url) => request(url),
  youtube: {
    info: (url) => request('/api/youtube/info', { method: 'POST', body: { url } }),
    download: (payload) => request('/api/youtube/download', { method: 'POST', body: payload }),
    getFeed: (topic = '', params = {}) => {
      const sp = new URLSearchParams(params);
      if (topic) sp.set('topic', topic);
      const qs = sp.toString();
      return request('/api/youtube/feed' + (qs ? '?' + qs : ''));
    },
    search: (q, params = {}) => {
      const sp = new URLSearchParams(params);
      sp.set('q', q);
      return request('/api/youtube/search?' + sp.toString());
    },
    suggest: (q) => request('/api/youtube/suggest?q=' + encodeURIComponent(q)),
    getRelated: (v) => request('/api/youtube/related?v=' + encodeURIComponent(v)),
    preload: (params = {}) => request('/api/youtube/preload?' + new URLSearchParams(params).toString()),
    getQualities: (v) => request('/api/youtube/qualities?v=' + encodeURIComponent(v)),
    meData: () => request('/api/youtube/me-data'),
    syncMeData: () => request('/api/youtube/me-data/sync', { method: 'POST' }),
    getRecommendations: (force = false) => request('/api/youtube/recommendations' + (force ? '?force=true' : '')),
  },
  jobs: {
    list: () => request('/api/jobs'),
    cancel: (id) => request(`/api/jobs/${id}/cancel`, { method: 'POST' }),
    retry: (id) => request(`/api/jobs/${id}/retry`, { method: 'POST' }),
    clearCompleted: () => request('/api/jobs/clear-completed', { method: 'POST' }),
  },
  playlists: {
    list: () => request('/api/playlists'),
    create: (name) => request('/api/playlists', { method: 'POST', body: { name } }),
    get: (id) => request(`/api/playlists/${id}`),
    rename: (id, name) => request(`/api/playlists/${id}`, { method: 'PATCH', body: { name } }),
    delete: (id) => request(`/api/playlists/${id}`, { method: 'DELETE' }),
    addTracks: (id, trackIds) => request(`/api/playlists/${id}/tracks`, { method: 'POST', body: { trackIds } }),
    removeTrack: (id, trackId) => request(`/api/playlists/${id}/tracks/${trackId}`, { method: 'DELETE' }),
    reorder: (id, trackIds) => request(`/api/playlists/${id}/reorder`, { method: 'PUT', body: { trackIds } }),
    uploadAvatar: (id, formData) => request(`/api/playlists/${id}/avatar`, { method: 'POST', body: formData }),
    setAvatar: (id, avatar) => request(`/api/playlists/${id}`, { method: 'PATCH', body: { avatar } }),
  },
  player: {
    getState: () => request('/api/player-state'),
    updateState: (state) => request('/api/player-state', { method: 'PUT', body: state }),
  },
  lyrics: {
    get: (params = {}) => request('/api/lyrics?' + new URLSearchParams(params).toString()),
  },
  system: {
    storage: () => request('/api/system/storage'),
    settings: () => request('/api/settings'),
    updateSettings: (data) => request('/api/settings', { method: 'PUT', body: data }),
    updateYtDlp: () => request('/api/system/update-ytdlp', { method: 'POST' }),
  }
};
