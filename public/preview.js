(() => {
  /** @type {HTMLElement | null} */
  const copyRoot = document.getElementById("preview-copy-keys");
  /** @type {HTMLElement | null} */
  const imgRoot = document.getElementById("preview-img-keys");
  /** @type {HTMLElement | null} */
  const copyCount = document.getElementById("preview-copy-count");
  /** @type {HTMLElement | null} */
  const imgCount = document.getElementById("preview-img-count");
  /** @type {HTMLElement | null} */
  const statusEl = document.getElementById("preview-status");
  /** @type {HTMLElement | null} */
  const updatedEl = document.getElementById("preview-updated");

  /** @param {string} mode @param {string} text */
  function setStatus(mode, text) {
    if (!statusEl) return;
    statusEl.dataset.mode = mode;
    statusEl.textContent = text;
  }

  /** @param {HTMLElement} root @param {string[]} keys */
  function renderKeyList(root, keys) {
    root.textContent = "";
    if (!keys.length) {
      const p = document.createElement("p");
      p.className = "preview-empty muted";
      p.textContent = "（暂无键 · 请在 config/display.json 中补充）";
      root.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    ul.className = "preview-key-list";
    keys.forEach((k) => {
      const li = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = k;
      li.appendChild(code);
      ul.appendChild(li);
    });
    root.appendChild(ul);
  }

  /** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} data */
  function renderSnapshot(data) {
    const copyKeys = Object.keys(data.copy ?? {}).sort();
    const imgKeys = Object.keys(data.images ?? {}).sort();

    if (copyRoot) renderKeyList(copyRoot, copyKeys);
    if (imgRoot) renderKeyList(imgRoot, imgKeys);
    if (copyCount)
      copyCount.textContent = copyKeys.length
        ? `共 ${copyKeys.length} 个键`
        : "共 0 个键";
    if (imgCount)
      imgCount.textContent = imgKeys.length ? `共 ${imgKeys.length} 个键` : "共 0 个键";

    const t = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
    if (updatedEl) {
      updatedEl.hidden = false;
      updatedEl.textContent = `最近同步 · ${stamp}`;
    }
    setStatus("live", `已同步 · ${copyKeys.length + imgKeys.length} keys`);
  }

  if (!copyRoot || !imgRoot) return;

  const es = new EventSource("/events");

  es.addEventListener("open", () => {
    setStatus("loading", "已连接 · 等待快照…");
  });

  es.addEventListener("snapshot", (ev) => {
    try {
      const data = JSON.parse(ev.data);
      renderSnapshot(data);
    } catch {
      setStatus("error", "快照 JSON 解析失败");
    }
  });

  es.addEventListener("config-error", (ev) => {
    let msg = "配置有误";
    try {
      msg = JSON.parse(ev.data)?.message ?? msg;
    } catch {
      //
    }
    setStatus("error", `配置错误 · ${msg}`);
    renderKeyList(copyRoot, []);
    renderKeyList(imgRoot, []);
    if (copyCount) copyCount.textContent = "";
    if (imgCount) imgCount.textContent = "";
    if (updatedEl) {
      updatedEl.hidden = false;
      updatedEl.textContent = "最近同步 · 校验失败（未列出键）";
    }
  });

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      setStatus("error", "连接断开，正在重连…");
    } else if (es.readyState === EventSource.CONNECTING) {
      setStatus("loading", "连接中…");
    }
  };
})();
