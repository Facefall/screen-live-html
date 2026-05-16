import { bindDisplayLive } from './display-live.js';

void bindDisplayLive({
  eventsUrl: '/events/v2',
  bootstrapUrl: '/api/display-v2',
});

(() => {
  if (/\bqa=1\b/.test(location.search)) {
    document.body.classList.add('badminton-page--qa-ref');
  }
  if (/\bcopy=1\b/.test(location.search)) {
    document.body.classList.add('badminton-page--show-copy');
  }
})();

(() => {
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.code !== 'Enter') return;
    if (!document.body.classList.contains('badminton-page')) return;
    e.preventDefault();
    if (document.fullscreenElement) {
      void (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement;
    void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  });
})();

(() => {
  const root = document.querySelector('.court-thumbs');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.court-thumb');
    if (!btn || !root.contains(btn)) return;

    root.querySelectorAll('.court-thumb').forEach((el) => {
      el.classList.toggle('court-thumb--active', el === btn);
      el.setAttribute('aria-pressed', el === btn ? 'true' : 'false');
    });
  });
})();

(() => {
  const root = document.querySelector('.court-sidebar__matches');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const article = e.target.closest('.court-sidebar__match');
    if (!article || !root.contains(article)) return;

    root.querySelectorAll('.court-sidebar__match').forEach((el) => {
      const on = el === article;
      el.classList.toggle('court-sidebar__match--active', on);
      if (on) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');
    });
  });
})();
