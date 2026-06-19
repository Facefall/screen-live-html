import { bindDisplayLive } from './display-live.js';

void bindDisplayLive({
  eventsUrl: '/events/v3',
  bootstrapUrl: '/api/display-v3',
});

(() => {
  if (/\bqa=1\b/.test(location.search)) {
    document.body.classList.add('badminton-v3-page--qa-ref');
  }
  if (/\bcopy=1\b/.test(location.search)) {
    document.body.classList.add('badminton-v3-page--show-copy');
  }
})();

(() => {
  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.code !== 'Enter') return;
    if (!document.body.classList.contains('badminton-v3-page')) return;
    e.preventDefault();
    if (document.fullscreenElement) {
      void (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      return;
    }
    const el = document.documentElement;
    void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
  });
})();
