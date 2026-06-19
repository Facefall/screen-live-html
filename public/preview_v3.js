(() => {
  /** badminton_v3 / display_v3.json */
  const COPY_MODULE_DEFS = [
    {
      title: "比分",
      keys: ["badminton_v3_a", "badminton_v3_b"],
    },
  ];

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
  /** @type {HTMLButtonElement | null} */
  const resetBtn = document.getElementById("preview-reset");

  /** @type {Record<string, string>} */
  let baselineCopy = {};
  /** @type {Record<string, string>} */
  let baselineImages = {};

  /** @param {string} mode @param {string} text */
  function setStatus(mode, text) {
    if (!statusEl) return;
    statusEl.dataset.mode = mode;
    statusEl.textContent = text;
  }

  /** @param {unknown} value */
  function valueAsString(value) {
    if (typeof value === "number" || typeof value === "string") {
      return String(value);
    }
    return "";
  }

  /** @param {Record<string, unknown>} obj */
  function stringifyRecord(obj) {
    /** @type {Record<string, string>} */
    const out = {};
    for (const k of Object.keys(obj)) {
      out[k] = valueAsString(obj[k]);
    }
    return out;
  }

  /** @param {Record<string, string>} baseline @param {'copy'|'images'} section */
  function applyBaselineToInputs(baseline, section) {
    const root = section === "copy" ? copyRoot : imgRoot;
    if (!root) return;
    root.querySelectorAll(`input.preview-field-input[data-section="${section}"]`).forEach((inp) => {
      if (!(inp instanceof HTMLInputElement)) return;
      const key = inp.dataset.fieldKey;
      if (!key) return;
      inp.value = baseline[key] ?? "";
    });
  }

  function resetInputsToBaseline() {
    applyBaselineToInputs(baselineCopy, "copy");
    applyBaselineToInputs(baselineImages, "images");
    setStatus("live", "已重置为上次快照的内容");
  }

  /**
   * @param {HTMLElement} parent
   * @param {string} k
   * @param {Record<string, unknown>} obj
   * @param {Record<string, string>} copyHints
   */
  function appendCopyFieldRow(parent, k, obj, copyHints) {
    const row = document.createElement("div");
    row.className = "preview-field-row";

    const keyCol = document.createElement("div");
    keyCol.className = "preview-field-key";
    const code = document.createElement("code");
    code.textContent = k;
    keyCol.appendChild(code);

    const rawHint = copyHints[k];
    const hintStr = typeof rawHint === "string" ? rawHint.trim() : "";
    if (hintStr) {
      const hint = document.createElement("p");
      hint.className = "preview-field-hint";
      hint.textContent = hintStr;
      keyCol.appendChild(hint);
    } else {
      const placeholder = document.createElement("p");
      placeholder.className = "preview-field-hint preview-field-hint--empty";
      placeholder.textContent =
        "（暂无说明 · 可由开发在 config/display-copy-labels-v3.json 补充）";
      keyCol.appendChild(placeholder);
    }

    const valCol = document.createElement("div");
    valCol.className = "preview-field-val";
    const input = document.createElement("input");
    input.type = "text";
    input.className = "preview-field-input";
    input.autocomplete = "off";
    input.dataset.section = "copy";
    input.dataset.fieldKey = k;
    input.value = valueAsString(obj[k]);

    valCol.appendChild(input);
    row.appendChild(keyCol);
    row.appendChild(valCol);
    parent.appendChild(row);
  }

  /**
   * @param {HTMLElement} root
   * @param {Record<string, unknown>} obj
   * @param {Record<string, string>} copyHints
   */
  function renderCopyGrouped(root, obj, copyHints) {
    root.textContent = "";
    const keys = Object.keys(obj);
    if (!keys.length) {
      root.classList.remove("preview-copy-keys--grouped");
      const p = document.createElement("p");
      p.className = "preview-empty muted";
      p.textContent = "（暂无 copy 键 · 请在 config/display_v3.json 补充）";
      root.appendChild(p);
      return;
    }
    root.classList.add("preview-copy-keys--grouped");

    /** @type {Set<string>} */
    const claimed = new Set();

    for (const mod of COPY_MODULE_DEFS) {
      const present = mod.keys.filter((k) => Object.prototype.hasOwnProperty.call(obj, k));
      present.forEach((k) => claimed.add(k));
      if (!present.length) continue;

      const sectionEl = document.createElement("section");
      sectionEl.className = "preview-copy-module";
      const h3 = document.createElement("h3");
      h3.className = "preview-copy-module-title";
      h3.textContent = mod.title;
      const grid = document.createElement("div");
      grid.className = "preview-copy-module-grid";

      for (const k of mod.keys) {
        if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
        appendCopyFieldRow(grid, k, obj, copyHints);
      }

      sectionEl.appendChild(h3);
      sectionEl.appendChild(grid);
      root.appendChild(sectionEl);
    }

    const orphanKeys = Object.keys(obj)
      .filter((k) => !claimed.has(k))
      .sort();
    if (orphanKeys.length) {
      const sectionEl = document.createElement("section");
      sectionEl.className = "preview-copy-module";
      const h3 = document.createElement("h3");
      h3.className = "preview-copy-module-title";
      h3.textContent = "其它";
      const grid = document.createElement("div");
      grid.className = "preview-copy-module-grid";
      for (const k of orphanKeys) {
        appendCopyFieldRow(grid, k, obj, copyHints);
      }
      sectionEl.appendChild(h3);
      sectionEl.appendChild(grid);
      root.appendChild(sectionEl);
    }
  }

  /**
   * @param {'images'} section
   * @param {HTMLElement} root
   * @param {Record<string, unknown>} obj
   * @param {Record<string, string>} hints
   */
  function renderImagesSection(section, root, obj, hints) {
    root.textContent = "";
    const keys = Object.keys(obj).sort();
    if (!keys.length) {
      const p = document.createElement("p");
      p.className = "preview-empty muted";
      p.textContent = "（暂无 images 键 · 请在 config/display_v3.json 补充）";
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

      const ih = hints[k];
      const ihStr = typeof ih === "string" ? ih.trim() : "";
      if (ihStr) {
        const hint = document.createElement("p");
        hint.className = "preview-field-hint";
        hint.textContent = ihStr;
        keyCol.appendChild(hint);
      } else {
        const placeholder = document.createElement("p");
        placeholder.className = "preview-field-hint preview-field-hint--empty";
        placeholder.textContent =
          "（暂无说明 · 可由开发在 config/display-copy-labels-v3.json 补充）";
        keyCol.appendChild(placeholder);
      }

      const valCol = document.createElement("div");
      valCol.className = "preview-field-val";
      const input = document.createElement("input");
      input.type = "text";
      input.className = "preview-field-input";
      input.autocomplete = "off";
      input.dataset.section = section;
      input.dataset.fieldKey = k;
      input.value = valueAsString(obj[k]);

      valCol.appendChild(input);
      row.appendChild(keyCol);
      row.appendChild(valCol);
      root.appendChild(row);
    }
  }

  /** @param {{ copy?: Record<string, unknown>; images?: Record<string, unknown>; copyHints?: Record<string, string> }} data */
  function renderSnapshot(data) {
    const copyRaw =
      typeof data.copy === "object" && data.copy !== null ? data.copy : {};
    const imgRaw =
      typeof data.images === "object" && data.images !== null ? data.images : {};
    const copyHints =
      typeof data.copyHints === "object" && data.copyHints !== null
        ? /** @type {Record<string, string>} */ ({ ...data.copyHints })
        : {};

    baselineCopy = stringifyRecord(copyRaw);
    baselineImages = stringifyRecord(imgRaw);

    const copyKeys = Object.keys(copyRaw).sort();
    const imgKeys = Object.keys(imgRaw).sort();

    if (copyRoot) renderCopyGrouped(copyRoot, copyRaw, copyHints);
    if (imgRoot) renderImagesSection("images", imgRoot, imgRaw, copyHints);

    if (resetBtn) {
      resetBtn.disabled = copyKeys.length === 0 && imgKeys.length === 0;
    }

    if (copyCount)
      copyCount.textContent = copyKeys.length
        ? `共 ${copyKeys.length} 个键 · 仅可改右侧输入框`
        : "共 0 个键";
    if (imgCount)
      imgCount.textContent = imgKeys.length
        ? `共 ${imgKeys.length} 个键 · 仅可改右侧输入框`
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
      `已同步 · images ${imgKeys.length} / copy ${copyKeys.length}`,
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
      const res = await fetch("/api/display-v3/patch", {
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
      setStatus("live", "已保存 · 等待 SSE 同步（/events/v3）");
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
  resetBtn?.addEventListener("click", () => {
    resetInputsToBaseline();
  });

  const es = new EventSource("/events/v3");

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
    baselineCopy = {};
    baselineImages = {};
    setStatus("error", `配置错误 · ${msg}`);
    renderCopyGrouped(copyRoot, {}, {});
    renderImagesSection("images", imgRoot, {}, {});
    if (resetBtn) resetBtn.disabled = true;
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
