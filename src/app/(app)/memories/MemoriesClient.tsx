"use client";

// v2.17.0: the interactive shell around the Memory Book. Owns the
// "show what it cost" switch (off by default, remembered per browser),
// marks the current chapter in the sticky rail, and offers print.
// The book itself is the hook-free MemoryBook tree.

import { useEffect, useMemo, useState } from "react";
import { MemoryBook } from "@/components/memories/MemoryBook";
import { redactMoney } from "@/lib/memories/redact";
import type { MemoryBookData } from "@/lib/memories/types";

const MONEY_KEY = "wh-memories-money";

export function MemoriesClient({ data }: { data: MemoryBookData }) {
  const [showMoney, setShowMoney] = useState(false);
  const [current, setCurrent] = useState<string | undefined>(undefined);

  useEffect(() => {
    try {
      setShowMoney(window.localStorage.getItem(MONEY_KEY) === "1");
    } catch {
      /* private mode etc. */
    }
  }, []);

  const toggleMoney = (on: boolean) => {
    setShowMoney(on);
    try {
      window.localStorage.setItem(MONEY_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const shown = useMemo(() => (showMoney ? data : redactMoney(data)), [data, showMoney]);

  // Mark the chapter in view on the rail. Plain DOM: the rail is part of
  // the hook-free tree, so we toggle a class rather than re-render it.
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>(".mb-chapter[data-chapter]"));
    if (!sections.length || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setCurrent(visible.target.getAttribute("data-chapter") ?? undefined);
      },
      { rootMargin: "-20% 0px -70% 0px", threshold: 0 },
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [shown]);

  useEffect(() => {
    document.querySelectorAll<HTMLAnchorElement>(".mb-rail a[data-chapter]").forEach((a) => {
      a.classList.toggle("is-active", a.getAttribute("data-chapter") === current);
    });
  }, [current]);

  return (
    <MemoryBook
      data={shown}
      mode="screen"
      actions={
        <>
          <a href="#part-before" className="mb-btn">
            Start reading
          </a>
          <button type="button" className="mb-btn ghost" onClick={() => window.print()}>
            Print / save as PDF
          </button>
          {data.moneyIncluded && (
            <label className="mb-toggle">
              <input type="checkbox" checked={showMoney} onChange={(e) => toggleMoney(e.target.checked)} />
              Show what it cost
            </label>
          )}
        </>
      }
    />
  );
}
