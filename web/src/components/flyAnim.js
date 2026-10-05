/**
 * Animate an element (or track thumbnail) flying to the top-right corner (#btn-header-jobs)
 * with a realistic physics arc, shrinking, spinning, and a bounce impact on arrival.
 *
 * @param {HTMLElement|DOMRect|Event|null} source - Source element, bounding rect, or click event
 * @param {Object} track - Information about the track (title, thumbnail, thumbnail_url, etc.)
 */
export function animateFlyToCorner(source, track = {}) {
  try {
    // 1. Target is the download button in top right header (#btn-header-jobs or .header-right)
    const targetEl = document.getElementById('btn-header-jobs') || document.querySelector('.header-right');
    let targetRect = { top: 14, left: window.innerWidth - 60, width: 38, height: 38 };
    if (targetEl) {
      const r = targetEl.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        targetRect = r;
      }
    }

    // 2. Start position
    let startX = window.innerWidth / 2;
    let startY = window.innerHeight / 2;

    if (source) {
      if (source.target && source.clientX !== undefined) {
        // Event passed
        startX = source.clientX;
        startY = source.clientY;
      } else if (typeof source.getBoundingClientRect === 'function') {
        const r = source.getBoundingClientRect();
        startX = r.left + r.width / 2;
        startY = r.top + r.height / 2;
      } else if (typeof source.left === 'number') {
        startX = source.left + (source.width || 0) / 2;
        startY = source.top + (source.height || 0) / 2;
      }
    }

    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    // 3. Create the flying flyer element
    const flyer = document.createElement('div');
    flyer.className = 'fly-to-download-ghost';

    const thumb = track.thumbnail_url || track.thumbnail || (track.youtubeId ? `https://i.ytimg.com/vi/${track.youtubeId}/default.jpg` : '');

    if (thumb) {
      flyer.innerHTML = `<img src="${thumb}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;pointer-events:none;">`;
    } else {
      flyer.innerHTML = `
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" style="color:#fff;">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      `;
    }

    const initialSize = 52;
    flyer.style.cssText = `
      position: fixed;
      top: ${startY - initialSize / 2}px;
      left: ${startX - initialSize / 2}px;
      width: ${initialSize}px;
      height: ${initialSize}px;
      border-radius: 50%;
      z-index: 100000;
      pointer-events: none;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-surface, #1e1e24);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.6), 0 0 16px rgba(99, 102, 241, 0.8);
      border: 2px solid var(--accent-primary, #6366f1);
      transform: translate3d(0, 0, 0) scale(1) rotate(0deg);
      transition: transform 0.68s cubic-bezier(0.2, 0.9, 0.3, 1),
                  top 0.68s cubic-bezier(0.5, 0, 0.8, 0.3),
                  left 0.68s cubic-bezier(0.2, 0.9, 0.3, 1),
                  opacity 0.68s cubic-bezier(0.4, 0, 1, 1);
      opacity: 1;
    `;

    document.body.appendChild(flyer);

    // Trigger animation next frame
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const finalSize = 26;
        flyer.style.top = `${endY - finalSize / 2}px`;
        flyer.style.left = `${endX - finalSize / 2}px`;
        flyer.style.width = `${finalSize}px`;
        flyer.style.height = `${finalSize}px`;
        flyer.style.transform = `translate3d(0, 0, 0) scale(0.6) rotate(360deg)`;
        flyer.style.opacity = `0.3`;
      });
    });

    // When animation hits destination
    setTimeout(() => {
      flyer.remove();
      if (targetEl) {
        targetEl.classList.remove('jobs-btn-pop');
        void targetEl.offsetWidth; // re-flow
        targetEl.classList.add('jobs-btn-pop');
        setTimeout(() => targetEl.classList.remove('jobs-btn-pop'), 600);
      }
    }, 700);
  } catch (err) {
    console.warn('animateFlyToCorner notice:', err);
  }
}
