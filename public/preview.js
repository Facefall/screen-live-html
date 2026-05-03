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
  /** @type {HTMLButtonElement | null} */
  const saveCopyBtn = document.getElementById("preview-save-copy");
  /** @type {HTMLButtonElement | null} */
  const saveImgBtn = document.getElementById("preview-save-images");

  /** @param {string} mode @param {string} text */
  function setStatus(mode, text) {
    if (!statusEl) return;
    statusEl.dataset.mode = mode;
    statusEl.textContent = text;
  }

  /**
   * @param {'copy'|'images'} section
   * @param {HTMLElement} root
   * @param {Record<string, unknown>} obj
   */
  function renderSection(section, root, obj) {
    root.textContent = "";
    const keys = Object.keys(obj).sort();
    if (!keys.length) {
      const p = document.createElement("p");
      p.className = "preview-empty muted";
      p.textContent =
        section === "copy"
          ? "（暂无 copy 键 · 请在 config/display.json 补充）"
          : "（暂无 images 键）";
      root.appendChild(p);
      return;
    }

    for (const k of keys) {
      const row = document.createElement("div");
      row.className = "preview-field-row";

      const keyCol = document.createElement("div");
      keyCol.className = "preview-field-key";
      const code = document.createElement("code");
      code.textContent = k;
      keyCol.appendChild(code);

      const valCol = document.createElement("div");
      valCol.className = "preview-field-val";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "preview-field-input";
      input.autocomplete = "off";
      input.dataset.section = section;
      input.dataset.fieldKey = k;
      const raw = obj[k];
      input.value =
        typeof raw === "number" || typeof raw === "string"
          ? String(raw)
          : "";

      valCol.appendChild(input);
      row.appendChild(keyCol);
      row.appendChild(valCol);
      root.appendChild(row);
    }
  }

  /** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown> }} data */
  function renderSnapshot(data) {
    const copyKeys = Object.keys(data.copy ?? {}).sort();
    const imgKeys = Object.keys(data.images ?? {}).sort();

    if (copyRoot) renderSection("copy", copyRoot, data.copy ?? {});
    if (imgRoot) renderSection("images", imgRoot, data.images ?? {});

    if (copyCount)
      copyCount.textContent = copyKeys.length
        ? `共 ${copyKeys.length} 个键 · 仅可修改右侧内容`
        : "共 0 个键";
    if (imgCount)
      imgCount.textContent = imgKeys.length
        ? `共 ${imgKeys.length} 个键 · 仅可修改右侧内容`
        : "共 0 个键";

    const t = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const stamp = `${pad(t.getHours())}:${pad(t.getMinutes())}:${pad(t.getSeconds())}`;
    if (updatedEl) {
      updatedEl.hidden = false;
      updatedEl.textContent = `最近同步 · ${stamp}`;
    }
    setStatus(
      "live",
      `已同步 · copy ${copyKeys.length} / images ${imgKeys.length}`,
    );
  }

  /**
   * @param {'copy'|'images'} section
   */
  async function saveSection(section) {
    const root = section === "copy" ? copyRoot : imgRoot;
    if (!root) return;

    const inputs = root.querySelectorAll(
      `input.preview-field-input[data-section="${section}"]`,
    );
    /** @type {Record<string, string>} */
    const payload = {};
    inputs.forEach((inp) => {
      if (!(inp instanceof HTMLInputElement)) return;
      const key = inp.dataset.fieldKey;
      if (!key) return;
      payload[key] = inp.value;
    });

    if (!Object.keys(payload).length) return;

    const body =
      section === "copy" ? { copy: payload } : { images: payload };

    const activeBtn = section === "copy" ? saveCopyBtn : saveImgBtn;
    if (activeBtn) activeBtn.disabled = true;
    setStatus("loading", "保存中…");

    try {
      const res = await fetch("/api/display/patch", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      /** @type {{ ok?: boolean; error?: string }} */
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        if (!res.ok) {
          throw new Error(text.slice(0, 160) || `HTTP ${res.status}`);
        }
      }
      if (!res.ok) {
        throw new Error(data.error || text.slice(0, 160) || `HTTP ${res.status}`);
      }
      setStatus("live", "已保存 · 等待 SSE 同步");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setStatus("error", `保存失败 · ${msg}`);
    } finally {
      if (activeBtn) activeBtn.disabled = false;
    }
  }

  if (!copyRoot || !imgRoot) return;

  saveCopyBtn?.addEventListener("click", () => void saveSection("copy"));
  saveImgBtn?.addEventListener("click", () => void saveSection("images"));

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
    renderSection("copy", copyRoot, {});
    renderSection("images", imgRoot, {});
    if (copyCount) copyCount.textContent = "";
    if (imgCount) imgCount.textContent = "";
    if (updatedEl) {
      updatedEl.hidden = false;
      updatedEl.textContent = "最近同步 · 校验失败（未列出字段）";
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
