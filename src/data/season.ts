import type { Company, WindowObs } from "./companies";

// The recruiting season runs May 1 → Mar 31; Jan–Apr dates belong to the following calendar year.
export const SEASON_WEEKS = 48;
export const SEASON_MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];

const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]; // day-of-year at start of each month

export function week(mmdd: string): number {
  const [m, d] = mmdd.split("-").map(Number);
  let doy = DAYS_BEFORE[m - 1] + d;
  if (m < 5) doy += 365;
  return (doy - (DAYS_BEFORE[4] + 1)) / 7;
}

export const monthStartWeek = (i: number) => week(`${String(((i + 4) % 12) + 1).padStart(2, "0")}-01`);

export const span = (w: WindowObs) => [week(w.from), week(w.to ?? w.from)] as const;
export const mid = (w: WindowObs) => (span(w)[0] + span(w)[1]) / 2;

export const TODAY = week("10-03");

// GSB-facilitated recruiting milestones for the 2026–27 season.
export const GSB_MARKERS = [
  { label: "Employer events open", from: "10-29" },
  { label: "Blackout", from: "11-23", to: "01-06" },
  { label: "Interviews", from: "01-04", to: "01-21" },
  { label: "Offer deadline", from: "01-29" },
];

export function typicalOpen(c: Company): number | null {
  const prior = c.windows.filter((w) => w.cycle !== "2026" && w.evidence !== "weak");
  const use = prior.length ? prior : c.windows;
  if (!use.length) return null;
  return use.reduce((s, w) => s + mid(w), 0) / use.length;
}

export function monthOf(wk: number): string {
  let i = 0;
  while (i < SEASON_MONTHS.length - 1 && monthStartWeek(i + 1) <= wk) i++;
  const into = wk - monthStartWeek(i);
  return `${into < 1.5 ? "early" : into < 3 ? "mid" : "late"} ${SEASON_MONTHS[i]}`;
}

export function verdict(c: Company) {
  const prior = c.windows.filter((w) => w.cycle !== "2026");
  const now = c.windows.find((w) => w.cycle === "2026");
  if (prior.length < 2) return { text: "not enough history", tone: "var(--ink-3)", earlier: false };
  const mids = prior.map(mid);
  const spread = Math.max(...mids) - Math.min(...mids);
  const earlier = !!now && mid(now) < Math.min(...mids) - 2;
  const text = spread <= 3 ? "steady" : spread <= 8 ? "shifts a few weeks" : "moves around";
  return { text, tone: spread <= 3 ? "var(--cardinal)" : "var(--ink-2)", earlier };
}
