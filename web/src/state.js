class StateStore {
  constructor() {
    this.state = {
      isAuthenticated: false,
      activeTab: 'library',
      tracks: [],
      totalTracks: 0,
      libraryFilter: 'all',
      searchQuery: '',
      sortBy: 'created_desc',
      playlists: [],
      activePlaylist: null,
      jobs: [],
      activeJobsCount: 0,
      
      // Player state
      currentTrack: null,
      queue: [],
      originalQueue: [],
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      playbackRate: 1.0,
      loopMode: 'off', // 'off' | 'one' | 'all'
      isShuffle: false,
      seekStep: 10,
      sleepTimer: null,
      sleepTimerInterval: null,
      settings: {},
    };

    this.listeners = new Set();
  }

  get() {
    return this.state;
  }

  set(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.state);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  setJobs(jobs) {
    const active = jobs.filter(j => j.status === 'queued' || j.status === 'downloading' || j.status === 'processing' || j.deviceSaving).length;
    this.set({ jobs, activeJobsCount: active });
  }

  updateJob(job) {
    const existingIndex = this.state.jobs.findIndex(j => j.id === job.id);
    let newJobs = [...this.state.jobs];
    if (existingIndex >= 0) {
      newJobs[existingIndex] = job;
    } else {
      newJobs.unshift(job);
    }
    this.setJobs(newJobs);
  }
}

export const store = new StateStore();
