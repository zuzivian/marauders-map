import { describe, expect, it } from "vitest";
import type { CalendarMarker, Hiring, WindowObs } from "@/data/types";
import { gsbRule, openWeeks, planOf } from "./plan";

const w = (cycle: "2023" | "2024" | "2025" | "2026", from: string, to = from, evidence: "strong" | "medium" | "weak" = "strong", closes?: string): WindowObs =>
  ({ cycle, from, to, evidence, closes, sources: ["x"] });
const h = (windows: WindowObs[], postings: Hiring["current"]["postings"] = []): Hiring =>
  ({ hasProgram: true, pattern: "", windows, current: { checked: "2026-10-04", summary: "", postings } });
const m = (id: string, from: string, to: string | null, description = ""): CalendarMarker =>
  ({ id, label: id, from, to, kind: "quiet", description, confidence: "high", sources: [`src-${id}`] });
const cal = [
  m("mba1-aap", "2026-09-10", "2026-10-29"),
  m("dead-week-finals-break", "2026-11-30", "2026-12-31"),
  m("internship-application-deadline", "2026-12-04", null),
  m("mba1-offer-deadline", "2027-01-29", null, "Offers must stay open until Jan 29."),
];

describe("backward plan", () => {
  // Opened mid-Oct twice, with deadlines about three and five weeks out.
  const fall = h([w("2023", "2023-09-01", "2023-10-31", "weak"), w("2024", "2024-10-14", "2024-10-14", "strong", "2024-11-04"), w("2025", "2025-10-15", "2025-10-17", "medium", "2025-11-21")]);

  it("summarizes past openings and how long postings stayed up", () => {
    const p = planOf(fall, cal, "2026-08-01", "2026")!;
    expect(p.history).toBe("Two past cycles with solid evidence opened mid Oct. When a deadline was stated (2 of 3 cycles), postings stayed up about 3 to 5 weeks.");
  });

  it("works back from the earliest past opening, and labels the lead time a rule of thumb", () => {
    const p = planOf(fall, cal, "2026-08-01", "2026")!;
    expect(p.action).toBe("Have your resume and stories ready by Sep 30, then apply in its first week.");
    expect(p.rule).toMatch(/^ready two weeks before the earliest past opening \(Oct 14/);
    expect(planOf(fall, cal, "2026-10-04", "2026")!.action).toMatch(/^Have your resume and stories ready now/);
  });

  it("says apply now once this cycle is live", () => {
    const open = h([...fall.windows, w("2026", "2026-10-01")]);
    expect(planOf(open, cal, "2026-10-04", "2026")!.action).toBe("Apply now, in its first week (live since Oct 1).");
    expect(planOf(open, cal, "2026-10-29", "2026")!.action).toBe("Apply now: it's been live since Oct 1, about 4 weeks.");
    const deadline = h([...fall.windows, w("2026", "2026-10-01", "2026-10-01", "strong", "2026-10-20")]);
    expect(planOf(deadline, cal, "2026-10-04", "2026")!.action).toBe("Apply before Oct 20; it's live now.");
    expect(planOf(deadline, cal, "2026-10-21", "2026")).toMatchObject({ action: "This cycle closed Oct 20.", gsb: null });
  });

  it("stops promising a date once it's later than any past cycle", () => {
    const p = planOf(h([w("2024", "2024-08-01"), w("2025", "2025-08-05")]), cal, "2026-10-04", "2026")!;
    expect(p.action).toMatch(/later than any past cycle/);
    expect(p.rule).toBeNull();
  });

  it("says when the history is weak evidence only", () => {
    expect(planOf(h([w("2023", "2023-11-25", "2023-12-12", "weak"), w("2024", "2024-10-20", "2024-11-07", "weak")]), cal, "2026-08-01", "2026")!.history).toMatch(/^Two past cycles \(weak evidence only\) opened/);
  });

  it("notes when no deadline was ever stated", () => {
    expect(planOf(h([w("2024", "2024-07-28"), w("2025", "2025-07-30")]), cal, "2026-05-10", "2026")!.history).toMatch(/No cycle had a stated deadline\.$/);
  });

  it("skips companies with no program", () => {
    expect(planOf({ ...fall, hasProgram: false, windows: [] }, cal, "2026-10-04", "2026")).toBeNull();
  });

  it("measures time open from the middle of the opening window", () => {
    expect(openWeeks([w("2025", "2025-10-01", "2025-10-15", "medium", "2025-11-05")])).toEqual([4]);
  });
});

describe("gsb rule", () => {
  it("cites the AAP while it's on and the company opens inside it", () => {
    const r = gsbRule(cal, "2026-10-04", ["2026-10-14", "2026-11-20"], false)!;
    expect(r.text).toBe("GSB's AAP bars employers from cold-contacting MBA1s until Oct 29. That limits them, not you, and past cycles here opened before it ends.");
    expect(r.sources).toEqual(["src-mba1-aap"]);
  });
  it("flags the December blackout for companies whose window runs into it", () => {
    expect(gsbRule(cal, "2026-10-04", ["2026-11-20", "2026-12-10"], false)!.text).toBe(
      "No recruiting events or interviews Nov 30 – Dec 31, but applications can still be due then (the last OCI deadline is Dec 4).");
  });
  it("falls back to the offer deadline, then nothing", () => {
    expect(gsbRule(cal, "2026-11-10", ["2026-10-01", "2026-10-20"], true)!.text).toBe("GSB policy: Offers must stay open until Jan 29.");
    expect(gsbRule(cal, "2027-02-01", ["2027-01-10", "2027-01-30"], false)).toBeNull();
  });
});
