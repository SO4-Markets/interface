"use client";

import { useEffect, useRef } from "react";

export function ReadingProgress() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = ref.current;
    if (!bar) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) {
      bar.style.transition = "none";
    }

    // Hide on short pages where progress is noise (match build-time MIN_WORDS threshold heuristic)
    // If the document is not scrollable, hide the bar
    function isShortPage() {
      return document.documentElement.scrollHeight <= window.innerHeight + 150;
    }
    if (isShortPage()) {
      bar.style.display = "none";
      return;
    }

    let ticking = false;
    // Arrow functions, not declarations: a hoisted `function` loses the
    // `if (!bar) return` narrowing above, so `bar` would read as nullable.
    const update = () => {
      const doc = document.documentElement;
      const scrollTop = window.scrollY || doc.scrollTop;
      const scrollHeight = doc.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? Math.min(scrollTop / scrollHeight, 1) : 0;
      bar.style.transform = `scaleX(${progress})`;
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      data-reading-progress
      aria-hidden="true"
      // Fixed slim bar, no layout shift: absolute at header bottom, transform scaleX
      className="reading-progress pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-left bg-primary print:hidden"
      style={{ transform: "scaleX(0)" }}
    />
  );
}
