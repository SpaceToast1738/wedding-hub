"use client";

import { useEffect } from "react";

// B7 (v1.13.0): on mount, scrolls the element with id={targetId} into
// view. Used by the day-of timeline so opening /today/day-of on a
// phone lands on whatever's currently happening (or about to happen)
// rather than the start of the day.
//
// `block: "center"` keeps the active row in the middle of the viewport
// — leaves context above and below visible. `behavior: "smooth"` is
// purely aesthetic. `instant` would also work; smooth tells the user
// "we adjusted the scroll for you" via the visible motion.
export function ScrollToCurrent({ targetId }: { targetId: string | null }) {
  useEffect(() => {
    if (!targetId) return;
    const el = document.getElementById(targetId);
    if (!el) return;
    // Defer one frame so the browser has finished laying out the
    // server-rendered content before we measure.
    const id = window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [targetId]);
  return null;
}
