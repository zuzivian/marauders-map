import type { Change, Hiring, ISODate, Posting } from "@/data/types";
import { daysBetween } from "./season";
import { removedUrls } from "./watch";

// How long postings stay up, from the posting's own date (hiring.json) and the watcher's log of removals (changes.json).
// A removal is dated by the first daily check that no longer listed the posting, so it's accurate to about a day.

export interface Lifetime {
  state: "live" | "removed";
  start: ISODate | null; // the posting's own date, else when the watcher first saw it; null when neither is known
  startIsPosted: boolean; // false means start is approximate (the watcher may have seen it after it went up)
  removed?: ISODate; // the day the watcher found it gone
  days: number | null; // up to its removal, or to today while live; null without a start
}

/** One lifetime per posting, in the same order. Changes dated after `today` haven't happened yet for this reader. */
export function lifetimes(company: string, postings: Posting[], changes: Change[], today: ISODate): Lifetime[] {
  const log = changes.filter((c) => c.company === company && c.date <= today);
  const gone = removedUrls(log, company);
  const firstSeen = new Map<string, ISODate>();
  const lastRemoved = new Map<string, ISODate>();
  for (const c of log) {
    if (c.kind === "removed") lastRemoved.set(c.url, c.date);
    else if (!firstSeen.has(c.url) || c.date < firstSeen.get(c.url)!) firstSeen.set(c.url, c.date);
  }
  return postings.map((p) => {
    const removed = gone.has(p.url) ? lastRemoved.get(p.url) : undefined;
    const own = p.posted ?? null;
    const start = own ?? firstSeen.get(p.url) ?? null;
    return {
      state: removed ? "removed" : "live",
      start,
      startIsPosted: own !== null,
      removed,
      days: start ? Math.max(0, daysBetween(start, removed ?? today)) : null,
    };
  });
}

export interface CameDown {
  n: number; // postings
  median: number; // days
  min: number;
  max: number;
}

/** Postings that came down with no stated deadline, across all companies: how many days they really stayed up. */
export function cameDownStats(all: Record<string, Hiring>, changes: Change[], today: ISODate): CameDown | null {
  const days: number[] = [];
  for (const [id, h] of Object.entries(all)) {
    const ls = lifetimes(id, h.current.postings, changes, today);
    h.current.postings.forEach((p, i) => {
      const d = ls[i].days;
      if (ls[i].state === "removed" && !p.closes && d !== null) days.push(d);
    });
  }
  if (!days.length) return null;
  days.sort((a, b) => a - b);
  const mid = days.length >> 1;
  return { n: days.length, median: Math.round(days.length % 2 ? days[mid] : (days[mid - 1] + days[mid]) / 2), min: days[0], max: days[days.length - 1] };
}

export const MIN_CAME_DOWN = 3; // fewer postings than this say too little to show

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The cross-company sentence for "Getting in", or null while there are too few postings to say anything. */
export function cameDownLine(s: CameDown | null): string | null {
  if (!s || s.n < MIN_CAME_DOWN) return null;
  const range = s.min === s.max ? `${plural(s.min, "day")} each` : `${s.min}–${plural(s.max, "day")}`;
  return `Postings without a deadline that came down this cycle stayed up ${plural(s.median, "day")} at the median (${s.n} postings across all companies, ${range}).`;
}
