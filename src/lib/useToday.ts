"use client";

import { useSyncExternalStore } from "react";

// The site is a static export, so "today" has to come from the reader's clock, not the build.
// The server snapshot is null: the prerendered HTML shows dates as of the last data check, and the
// browser swaps in the real date right after hydration (no mismatch, no stale "today" line).

const localISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60 * 60 * 1000); // pick up midnight rollovers on long-open tabs
  const onVisible = () => document.visibilityState === "visible" && onChange();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Today's date (YYYY-MM-DD, reader's timezone), or null during prerender and hydration. */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, localISO, () => null);
}
