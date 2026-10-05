"use client";

import { useSyncExternalStore } from "react";
import { companyById } from "@/data";

// "My list": the companies a reader has starred, kept in their browser's localStorage (no account), plus the
// "my list only" filter shared by the trail, the timing chart and the roles grid. Like useToday, the server
// snapshot is empty, so the prerendered page shows nothing starred and the browser fills it in after hydration.

const KEY = "marauders-map:my-list";
const EMPTY: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let raw: string | null | undefined; // last value read from storage
let starred = EMPTY;
let memoryOnly = false; // storage unavailable (blocked, or a full quota): keep the list for this visit only
let onlyMine = false;

const parse = (s: string | null): ReadonlySet<string> => {
  try {
    const ids = JSON.parse(s ?? "[]");
    return Array.isArray(ids) ? new Set(ids.filter((id): id is string => typeof id === "string" && !!companyById[id])) : EMPTY;
  } catch {
    return EMPTY;
  }
};

function read() {
  if (memoryOnly) return starred;
  try {
    const s = localStorage.getItem(KEY);
    if (s !== raw) {
      raw = s;
      starred = parse(s);
    }
  } catch {
    memoryOnly = true;
  }
  return starred;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => e.key === KEY && onChange(); // starred in another tab
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Starred company ids; empty during prerender and hydration. */
export function useStarred(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}

export function toggleStar(id: string) {
  const next = new Set(read());
  if (next.has(id)) next.delete(id);
  else next.add(id);
  starred = next;
  if (!memoryOnly) {
    try {
      raw = JSON.stringify([...next]);
      localStorage.setItem(KEY, raw);
    } catch {
      memoryOnly = true;
    }
  }
  notify();
}

/** Whether the views are narrowed to the starred companies. Not persisted: a fresh visit shows everyone. */
export function useMyListOnly(): boolean {
  return useSyncExternalStore(subscribe, () => onlyMine, () => false);
}

export function setMyListOnly(on: boolean) {
  onlyMine = on;
  notify();
}
