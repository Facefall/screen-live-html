/** @typedef {{ copy?: Record<string, string | number>, images?: Record<string, string>, copyHints?: Record<string, string> }} DisplayConfig */

/** @param {DisplayConfig | null | undefined} config */
export function applyConfig(config) {
  if (!config) return;

  const copy = config.copy && typeof config.copy === 'object' ? config.copy : {};
  const images =
    config.images && typeof config.images === 'object' ? config.images : {};

  document.querySelectorAll('[data-live-text]').forEach((el) => {
    const key = el.getAttribute('data-live-text');
    if (!key) return;

    const optional = el.hasAttribute('data-live-text-opt');

    if (optional) {
      const hasKey = Object.prototype.hasOwnProperty.call(copy, key);
      const raw = hasKey ? copy[key] : undefined;
      const str = raw == null ? '' : String(raw).trim();
      const footScore =
        el.classList.contains('match_score') &&
        el.closest('.court-sidebar__match-foot');
      if (footScore) {
        el.removeAttribute('hidden');
        el.textContent = str;
        return;
      }
      el.hidden = !str;
      el.textContent = str;
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(copy, key)) return;
    const value = copy[key];
    el.textContent = value == null ? '' : String(value);
  });

  document.querySelectorAll('[data-live-img]').forEach((el) => {
    const key = el.getAttribute('data-live-img');
    if (!key || !Object.prototype.hasOwnProperty.call(images, key)) return;
    const url = images[key];
    const img =
      /** @type {HTMLImageElement | null} */
      (
        el instanceof HTMLImageElement
          ? el
          : el.querySelector(':scope img')
      );
    if (img && typeof url === 'string') img.src = url;
  });

  document.querySelectorAll('[data-live-bg]').forEach((el) => {
    const key = el.getAttribute('data-live-bg');
    if (!key || !Object.prototype.hasOwnProperty.call(images, key)) return;
    const url = images[key];
    if (typeof url === 'string') {
      /** @type {HTMLElement} */
      (el).style.backgroundImage = `url(${JSON.stringify(url)})`;
    }
  });

  document.querySelectorAll('.court-sidebar__match-foot').forEach((foot) => {
    if (!(foot instanceof HTMLElement)) return;
    const scores = [...foot.querySelectorAll(':scope > .match_score')];
    const defaults = [...foot.querySelectorAll(':scope > .match_score_default')];
    if (!scores.length && !defaults.length) return;

    const anyScore = scores.some((el) => el.textContent.trim() !== '');

    scores.forEach((el) => {
      el.style.display = '';
      const filled = el.textContent.trim() !== '';
      el.style.visibility =
        !anyScore ? 'hidden' : filled ? 'visible' : 'hidden';
    });
    defaults.forEach((el) => {
      el.style.visibility = anyScore ? 'hidden' : 'visible';
    });
  });
}

/**
 * @param {{ statusElementId?: string | null }} [options]
 */
export function bindDisplayLive(options = {}) {
  const { statusElementId = null } = options;

  /** @type {HTMLElement | null} */
  const statusEl = statusElementId
    ? document.getElementById(statusElementId)
    : null;

  /** @param {string} mode @param {string} message */
  function setStatus(mode, message) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.dataset.mode = mode;
  }

  const es = new EventSource('/events');

  es.addEventListener('open', () => {
    setStatus('live', '已连接 · 实时配置…');
  });

  es.addEventListener('snapshot', (e) => {
    try {
      const data = JSON.parse(e.data);
      applyConfig(data);
      setStatus('live', '已连接 · 已同步最新配置');
    } catch (_) {
      setStatus('error', '已连接 · 无法解析快照');
    }
  });

  es.addEventListener('config-error', (e) => {
    let msg = '配置有误';
    try {
      msg = JSON.parse(e.data)?.message ?? msg;
    } catch {
      //
    }
    setStatus('error', `配置错误 · ${msg}`);
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      setStatus('error', '连接已断开，正在重试…');
    } else if (es.readyState === EventSource.CONNECTING) {
      setStatus('loading', '正在连接…');
    }
  };
}
