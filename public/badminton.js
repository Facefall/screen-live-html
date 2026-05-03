/**
 * QA: append ?qa=1 to URL to show translucent all.png for pixel comparison.
 */
(() => {
  if (/\bqa=1\b/.test(location.search)) {
    document.body.classList.add("badminton-page--qa-ref");
  }
})();

/**
 * Camera thumbnail active state.
 */
(() => {
  const root = document.querySelector(".court-thumbs");
  if (!root) return;

  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".court-thumb");
    if (!btn || !root.contains(btn)) return;

    root.querySelectorAll(".court-thumb").forEach((el) => {
      el.classList.toggle("court-thumb--active", el === btn);
      el.setAttribute("aria-pressed", el === btn ? "true" : "false");
    });
  });
})();
