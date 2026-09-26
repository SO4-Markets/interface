// Reading progress indicator (DX-062)
// Slim bar in header driven by scroll, no layout shift, rAF, prefers-reduced-motion, hidden from AT via aria-hidden.
(function () {
  const bar = document.querySelector("[data-reading-progress]");
  if (!bar) return;

  // Respect prefers-reduced-motion: disable animation, keep static or hide
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    // Remove transition if any, keep bar visible but non-animated (no jank)
    bar.style.transition = "none";
  }

  let ticking = false;

  function update() {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop;
    const scrollHeight = doc.scrollHeight - window.innerHeight;
    const progress = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;
    // Use transform scaleX to avoid layout shift and width reflow
    bar.style.transform = `scaleX(${progress})`;
    ticking = false;
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  // Initial
  update();
})();
