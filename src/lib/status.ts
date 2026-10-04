import type { Cycle, Hiring, ISODate } from "@/data/types";
import { daysBetween, fmtDate, fmtRange, monthOf, typicalOpen, weekOf } from "./season";

export type State = "open" | "closing" | "closed" | "due" | "late" | "expected" | "none";

export interface Status {
  state: State;
  headline: string; // short, for chips and lists
  detail: string; // one sentence, for the company panel
  sortKey: number; // for ordering "right now" lists
}

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const relDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${plural(n, "day")}`);

/**
 * Where a company stands this cycle, relative to `today`. Postings are facts as of `current.checked`;
 * anything after that date is a prediction from past cycles and is worded as one.
 */
export function statusOf(h: Hiring, today: ISODate, cycle: Cycle): Status {
  if (!h.hasProgram) return { state: "none", headline: "No MBA internship", detail: h.current.summary, sortKey: 999 };

  const now = h.windows.find((w) => w.cycle === cycle);
  const checked = fmtDate(h.current.checked);
  if (now) {
    const closes = [now.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean).sort().at(-1) as ISODate | undefined;
    const opened = fmtRange(now.from, now.to);
    if (closes && daysBetween(today, closes) < 0)
      return { state: "closed", headline: `Closed ${fmtDate(closes)}`, detail: `Opened ${opened}; the stated deadline was ${fmtDate(closes)}.`, sortKey: 500 + daysBetween(closes, today) };
    if (closes) {
      const left = daysBetween(today, closes);
      return {
        state: left <= 14 ? "closing" : "open",
        headline: `Closes ${fmtDate(closes)} · ${relDays(left)}`,
        detail: `Opened ${opened}. Stated deadline ${fmtDate(closes)}.`,
        sortKey: left,
      };
    }
    return { state: "open", headline: `Opened ${opened}`, detail: `Opened ${opened}, no stated deadline (rolling). Last checked ${checked}.`, sortKey: 100 };
  }

  const t = typicalOpen(h, cycle);
  if (!t) return { state: "expected", headline: "Timing unknown", detail: `Nothing posted as of ${checked}, and too little history to predict.`, sortKey: 400 };
  const todayWk = weekOf(today, cycle);
  const usual = monthOf(t.week, cycle);
  // Past the latest opening in any prior cycle (plus two weeks' grace): say so, don't keep calling it "due".
  if (todayWk > t.max + 2)
    return {
      state: "late",
      headline: `Not posted yet · usually by ${monthOf(t.max, cycle)}`,
      detail: `Not posted as of ${checked}, later than any past cycle (they opened by ${monthOf(t.max, cycle)}). It may be delayed, smaller this year, or posted only to schools; keep checking.`,
      sortKey: 250 + t.week,
    };
  if (todayWk >= t.min - 1)
    return {
      state: "due",
      headline: `Due now · usually ${usual}`,
      detail: `Not posted as of ${checked}. It usually opens ${usual}, so check the careers site.`,
      sortKey: 200 + t.week,
    };
  return {
    state: "expected",
    headline: `Usually ${usual}`,
    detail: `Not posted as of ${checked}. Past cycles opened around ${usual}.`,
    sortKey: 300 + t.week,
  };
}
