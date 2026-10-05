import type { Company, Cycle, Hiring, Role } from "@/data/types";
import { dateAtWeek, daysBetween, typicalOpen, weekOf } from "./season";
import { statusOf, type Status } from "./status";

// One visual vocabulary for "where things stand", shared by the trail and the who-hires-what grid.
export type Mark = "closing" | "open" | "due" | "late" | "later" | "closed";
export const MARK: Record<Mark, { glyph: string; label: string }> = {
  closing: { glyph: "◉", label: "closing soon" },
  open: { glyph: "●", label: "open now" },
  due: { glyph: "◐", label: "due any day" },
  late: { glyph: "◷", label: "running late" },
  later: { glyph: "○", label: "not posted yet" },
  closed: { glyph: "×", label: "closed" },
};
export const MARK_ORDER: Mark[] = ["closing", "open", "due", "late", "later", "closed"];

const fromState: Partial<Record<Status["state"], Mark>> = {
  closing: "closing", open: "open", due: "due", late: "late", expected: "later", closed: "closed",
};

export interface TrailItem {
  company: Company;
  status: Status;
  mark: Mark;
  week: number; // where it sits on the season: this cycle's open date, or when it usually opens
  posted: boolean; // has postings this cycle (drawn above the path), or not yet (below)
  daysLeft: number | null;
}

/** Every company with an MBA program, placed on the season. */
export function trailItems(companies: Company[], hiring: Record<string, Hiring>, today: string, cycle: Cycle): TrailItem[] {
  return companies
    .flatMap((company) => {
      const h = hiring[company.id];
      const status = statusOf(h, today, cycle);
      const mark = fromState[status.state];
      if (!mark || !h.hasProgram) return [];
      const now = h.windows.find((w) => w.cycle === cycle);
      const t = typicalOpen(h, cycle);
      const week = now ? weekOf(now.from, cycle) : t ? weekOf(dateAtWeek(t.week, cycle), cycle) : null;
      if (week === null) return [];
      const closes = [now?.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean).sort().at(-1);
      const daysLeft = closes && (mark === "closing" || mark === "open") ? daysBetween(today, closes) : null;
      return [{ company, status, mark, week, posted: !!now, daysLeft }];
    })
    .sort((a, b) => a.week - b.week);
}

/**
 * A role's mark at one company. Roles posted this cycle take the company's live status; roles the company
 * has posted before but not yet this cycle take its "not yet" status (due, late, later). Null = doesn't hire for it.
 */
export function roleMark(role: Role, company: Company, item: TrailItem | undefined, cycle: Cycle): Mark | null {
  const titles = role.titles.filter((t) => t.company === company.name);
  if (!titles.length || !item) return null;
  const postedNow = item.posted && titles.some((t) => t.cycles.includes(cycle));
  if (postedNow) return item.mark;
  if (item.mark === "open" || item.mark === "closing" || item.mark === "closed") return "later";
  return item.mark;
}
