"use client";

import { useEffect } from "react";

// v1.25.2: defensive cleanup for any inherited service worker.
//
// We never registered a service worker in this app, but a long-lived
// browser session that visited an earlier deployment of *something*
// at this domain may have one cached. A stale SW would intercept
// fetches and serve old chunks — exactly the symptom users reported
// for the mobile navbar (clicks landing on "/" because the SW served
// an old MobileTabBar.tsx with stale hrefs). User confirmed (29 Apr
// 2026) that incognito mode doesn't have the bug, which is the
// classic SW-cache fingerprint.
//
// This component runs once on mount, finds any registered SWs, and
// unregisters them. Also clears the Cache Storage entries the SW
// might have populated. Does nothing on subsequent mounts (idempotent
// — once unregistered there's nothing to find).
//
// Mount once at the root layout; safe to leave in place permanently.
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => {
        if (registrations.length === 0) return;
        // Surface the cleanup in dev so we can confirm it's working.
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.log(
            `[ServiceWorkerCleanup] unregistering ${registrations.length} stale SW(s)`,
          );
        }
        return Promise.all(registrations.map((r) => r.unregister()));
      })
      .catch(() => {
        // Non-critical — fail silently rather than logging a scary
        // error. Worst case is the SW stays around and the user can
        // clear their browser cache manually.
      });
    // Also clear any Cache Storage entries — they live independently
    // of the SW that populated them.
    if ("caches" in window) {
      caches
        .keys()
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .catch(() => {});
    }
  }, []);
  return null;
}
