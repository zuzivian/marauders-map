import type { CalendarMarker, Cycle, Hiring, ISODate, WindowObs } from "@/data/types";
import { addDays, dateAtWeek, daysBetween, fmtDate, fmtRange, mid, monthOf, span } from "./season";
import { statusOf } from "./status";

// A backward plan for one company, computed from its past windows (hiring.json) and the GSB calendar.
// The only number that isn't data is the lead time, and it's labeled a rule of thumb wherever it shows.

export const LEAD_DAYS = 14; // rule of thumb: be ready two weeks before the earliest past opening

export interface Plan {
  action: string; // what to do, first
  rule: string | null; // the rule of thumb behind the action, shown labeled as one
  history: string | null; // what past cycles did
  gsb: { text: string; sources: string[] } | null; // the GSB rule that bears on this company's timing
}

const WORDS = ["no", "one", "two", "three", "four"];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const weeks = (days: number) => Math.max(1, Math.round(days / 7));
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** "early to mid Oct", "late Sep to early Oct", "mid Oct". */
function between(a: string, b: string) {
  if (a === b) return a;
  const [pa, ma] = a.split(" "), [pb, mb] = b.split(" ");
  return ma === mb ? `${pa} to ${pb} ${ma}` : `${a} to ${b}`;
}

/** Past windows the plan leans on, by the same rule as typicalOpen: weak evidence only when nothing better exists. */
function pastUsed(h: Hiring, cycle: Cycle) {
  const past = h.windows.filter((w) => w.cycle !== cycle);
  const solid = past.filter((w) => w.evidence !== "weak");
  return { used: solid.length ? solid : past, dropped: solid.length > 0 && solid.length < past.length };
}

/** How long postings stayed up, in weeks from the middle of the opening window to the stated deadline. */
export function openWeeks(windows: WindowObs[]) {
  return windows.filter((w) => w.closes).map((w) => weeks(daysBetween(dateAtWeek(mid(w), w.cycle), w.closes!)));
}

/** The latest stated deadline this cycle, from the window or any of its postings. */
const closesOf = (h: Hiring, now: WindowObs) =>
  [now.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean).sort().at(-1) as ISODate | undefined;

export function planOf(h: Hiring, calendar: CalendarMarker[], today: ISODate, cycle: Cycle): Plan | null {
  if (!h.hasProgram || !h.windows.length) return null;
  const now = h.windows.find((w) => w.cycle === cycle);
  const { used, dropped } = pastUsed(h, cycle);
  const durations = openWeeks(h.windows);

  // What past cycles did, mapped onto this cycle's calendar.
  let history: string | null = null;
  let window: [ISODate, ISODate] | null = null; // when this company's postings are (or are likely to be) up this cycle
  if (used.length) {
    const mids = used.map(mid);
    const n = used.length;
    history = `${cap(WORDS[n] ?? String(n))} past cycle${n === 1 ? "" : "s"}${dropped ? " with solid evidence" : used.every((w) => w.evidence === "weak") ? " (weak evidence only)" : ""} opened ${between(monthOf(Math.min(...mids), cycle), monthOf(Math.max(...mids), cycle))}.`;
    const lo = Math.min(...durations), hi = Math.max(...durations);
    history += durations.length
      ? ` When a deadline was stated (${durations.length} of ${h.windows.length} cycles), postings stayed up about ${lo === hi ? plural(lo, "week") : `${lo} to ${hi} weeks`}.`
      : " No cycle had a stated deadline.";
    const first = dateAtWeek(Math.min(...used.map((w) => span(w)[0])), cycle);
    const last = dateAtWeek(Math.max(...used.map((w) => span(w)[1])), cycle);
    window = [first, durations.length ? addDays(last, hi * 7) : last];
  }

  // The action, led by where things stand today.
  let action: string;
  let rule: string | null = null;
  if (now) {
    const closes = closesOf(h, now);
    window = [now.from, closes ?? window?.[1] ?? now.to];
    if (closes && daysBetween(today, closes) < 0) return { action: `This cycle closed ${fmtDate(closes)}.`, rule, history, gsb: null };
    if (closes) action = `Apply before ${fmtDate(closes)}; it's live now.`;
    else {
      const live = Math.max(0, daysBetween(now.from, today));
      action = live <= 7
        ? `Apply now, in its first week (live since ${fmtDate(now.from)}).`
        : `Apply now: it's been live since ${fmtDate(now.from)}, about ${plural(weeks(live), "week")}.`;
    }
  } else if (window) {
    const readyBy = addDays(window[0], -LEAD_DAYS);
    const late = statusOf(h, today, cycle).state === "late";
    action = late
      ? "Have your resume and stories ready now and keep checking: it's later than any past cycle."
      : daysBetween(today, readyBy) > 0
        ? `Have your resume and stories ready by ${fmtDate(readyBy)}, then apply in its first week.`
        : "Have your resume and stories ready now, then apply in its first week.";
    rule = late ? null : `ready two weeks before the earliest past opening (${fmtDate(window[0])} on this year's calendar)`;
  } else return null;

  return { action, rule, history, gsb: window ? gsbRule(calendar, today, window, !!now) : null };
}

/** The one GSB rule that matters most for this company right now, worded from calendar.json. */
export function gsbRule(calendar: CalendarMarker[], today: ISODate, [a, b]: [ISODate, ISODate], open: boolean) {
  const by = (id: string) => calendar.find((m) => m.id === id);
  const aap = by("mba1-aap"), dead = by("dead-week-finals-break"), oci = by("internship-application-deadline"), offer = by("mba1-offer-deadline");

  // The AAP binds employers, not students, and postings don't wait for it.
  if (aap?.to && today <= aap.to && a <= aap.to)
    return {
      text: `GSB's AAP bars employers from cold-contacting MBA1s until ${fmtDate(aap.to)}. That limits them, not you, and ${open ? "this posting went live" : "past cycles here opened"} before it ends.`,
      sources: aap.sources,
    };
  if (dead?.to && today <= dead.to && a <= dead.to && b >= dead.from)
    return {
      text: `No recruiting events or interviews ${fmtRange(dead.from, dead.to)}, but applications can still be due then${oci ? ` (the last OCI deadline is ${fmtDate(oci.from)})` : ""}.`,
      sources: [...dead.sources, ...(oci?.sources ?? [])],
    };
  if (offer && today <= offer.from) return { text: `GSB policy: ${offer.description}`, sources: offer.sources };
  return null;
}
