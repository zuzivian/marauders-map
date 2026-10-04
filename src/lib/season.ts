import type { Cycle, Hiring, ISODate, WindowObs } from "@/data/types";

// A recruiting season runs May 1 of the cycle year through Mar 31 of the next. Positions are in weeks
// from the season start so different cycles can be overlaid on one axis.
export const SEASON_WEEKS = 48;
export const SEASON_MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
const DAY = 86_400_000;

export const toUTC = (iso: ISODate) => {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((toUTC(b) - toUTC(a)) / DAY);
export const addDays = (iso: ISODate, n: number) => new Date(toUTC(iso) + n * DAY).toISOString().slice(0, 10);
export const seasonStart = (cycle: Cycle | string) => `${cycle}-05-01`;
export const seasonEnd = (cycle: Cycle | string) => `${Number(cycle) + 1}-03-31`;

/** Weeks from the start of `cycle`'s season. */
export const weekOf = (iso: ISODate, cycle: Cycle | string) => daysBetween(seasonStart(cycle), iso) / 7;
export const span = (w: WindowObs) => [weekOf(w.from, w.cycle), weekOf(w.to, w.cycle)] as const;
export const mid = (w: WindowObs) => (span(w)[0] + span(w)[1]) / 2;

/** Week at which month i of SEASON_MONTHS starts in `cycle`'s season. */
export const monthStartWeek = (i: number, cycle: Cycle | string = "2026") => {
  const m = ((i + 4) % 12) + 1;
  return weekOf(`${m < 5 ? Number(cycle) + 1 : cycle}-${String(m).padStart(2, "0")}-01`, cycle);
};

/** Inverse of weekOf for the given cycle. */
export const dateAtWeek = (wk: number, cycle: Cycle | string) => addDays(seasonStart(cycle), Math.round(wk * 7));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function fmtDate(iso: ISODate, opts: { year?: boolean } = {}) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}${opts.year ? `, ${y}` : ""}`;
}
export function fmtRange(from: ISODate, to: ISODate) {
  if (from === to) return fmtDate(from);
  const [, m1] = from.split("-");
  const [, m2, d2] = to.split("-");
  return m1 === m2 ? `${fmtDate(from)}–${Number(d2)}` : `${fmtDate(from)} – ${fmtDate(to)}`;
}

/** "early Oct", "mid Dec" … for a season-relative week. */
export function monthOf(wk: number, cycle: Cycle | string = "2026") {
  const [, m, d] = dateAtWeek(wk, cycle).split("-").map(Number);
  return `${d <= 10 ? "early" : d <= 20 ? "mid" : "late"} ${MONTHS[m - 1]}`;
}

export interface Typical {
  week: number; // average midpoint of past windows
  min: number; // earliest past midpoint
  max: number; // latest past midpoint
  n: number; // cycles used
}

/** When a company's postings usually go live, from past cycles. Weak-evidence cycles count only if nothing better exists. */
export function typicalOpen(h: Hiring, currentCycle: Cycle): Typical | null {
  const past = h.windows.filter((w) => w.cycle !== currentCycle);
  const solid = past.filter((w) => w.evidence !== "weak");
  const use = solid.length ? solid : past.length ? past : h.windows;
  if (!use.length) return null;
  const mids = use.map(mid);
  return { week: mids.reduce((s, x) => s + x, 0) / mids.length, min: Math.min(...mids), max: Math.max(...mids), n: mids.length };
}

export type Wave = "summer" | "fall" | "winter" | "none";
export const WAVE_BOUNDS = { fall: monthStartWeek(4), winter: monthStartWeek(6) }; // Sep 1, Nov 1
export const waveLabel: Record<Wave, string> = {
  summer: "Usually opens by August",
  fall: "Usually opens Sep–Oct",
  winter: "Usually opens Nov or later",
  none: "No MBA internship",
};

export function waveOf(h: Hiring, currentCycle: Cycle): Wave {
  const t = h.hasProgram ? typicalOpen(h, currentCycle) : null;
  if (!t) return "none";
  return t.week < WAVE_BOUNDS.fall ? "summer" : t.week < WAVE_BOUNDS.winter ? "fall" : "winter";
}

/** How predictable the timing has been across past cycles. */
export function steadiness(h: Hiring, currentCycle: Cycle) {
  const past = h.windows.filter((w) => w.cycle !== currentCycle);
  const now = h.windows.find((w) => w.cycle === currentCycle);
  if (past.length < 2) return { text: "not enough history", steady: false, earlier: false, later: false };
  const mids = past.map(mid);
  const spread = Math.max(...mids) - Math.min(...mids);
  return {
    text: spread <= 3 ? "steady" : spread <= 8 ? "shifts a few weeks" : "moves around",
    steady: spread <= 3,
    earlier: !!now && mid(now) < Math.min(...mids) - 2,
    later: !!now && mid(now) > Math.max(...mids) + 2,
  };
}
