(() => {
  if (/\bqa=1\b/.test(location.search)) {
    document.body.classList.add("badminton-page--qa-ref");
  }
})();

(() => {
  document.addEventListener("keydown", (e) => {
    if (!e.altKey || e.code !== "Enter") return;
    if (!document.body.classList.contains("badminton-page")) return;
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
