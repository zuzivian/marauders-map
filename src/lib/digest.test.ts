import { describe, expect, it } from "vitest";
import type { CalendarMarker, Company, Hiring, WindowObs } from "@/data/types";
import { calendar, companies, hiring, meta } from "@/data";
import { digest, type DigestInput } from "./digest";

const w = (cycle: WindowObs["cycle"], from: string, closes?: string): WindowObs => ({ cycle, from, to: from, evidence: "strong", closes, sources: ["x"] });
const co = (id: string, name: string) => ({ id, name }) as Company;
const hire = (windows: WindowObs[], hasProgram = true): Hiring => ({ hasProgram, pattern: "", windows, current: { checked: "2026-10-04", summary: "", postings: [] } });
const mark = (id: string, label: string, from: string, to: string | null = null): CalendarMarker =>
  ({ id, label, from, to, kind: "events", description: "", confidence: "high", sources: ["x"] });

const input = (today: string): DigestInput => ({
  companies: [co("fresh", "Fresh"), co("soon", "Soon"), co("old", "Old"), co("due", "Due"), co("later", "Later"), co("late", "Late"), co("none", "None & Co")],
  hiring: {
    fresh: hire([w("2025", "2025-10-01"), w("2026", "2026-10-01")]),
    soon: hire([w("2025", "2025-09-01"), w("2026", "2026-09-01", "2026-10-10")]),
    old: hire([w("2025", "2025-08-01"), w("2026", "2026-08-01")]),
    due: hire([w("2024", "2024-10-06"), w("2025", "2025-10-08")]),
    later: hire([w("2024", "2025-01-20"), w("2025", "2026-01-22")]),
    late: hire([w("2024", "2024-08-01"), w("2025", "2025-08-03")]),
    none: hire([], false),
  },
  calendar: [mark("aap", "AAP", "2026-09-10", "2026-10-29"), mark("fair", "Career fair", "2026-10-09"), mark("far", "Interviews", "2027-01-04", "2027-01-08")],
  cycle: "2026",
  researched: "2026-10-04",
  today,
});

describe("weekly digest", () => {
  const text = digest(input("2026-10-04"));
  const link = (id: string, name: string) => `<https://marauders-map.natwong.dev/c/${id}/|${name}>`;

  it("sorts companies into open, closing, expected and late", () => {
    expect(text).toContain(`• New this week: ${link("fresh", "Fresh")} (Oct 1)`);
    expect(text).toContain(`• Still open: ${link("old", "Old")}`);
    expect(text).toContain(`• ${link("soon", "Soon")}: Oct 10, in 6 days`);
    expect(text).toContain(`• ${link("due", "Due")}: due any day, usually early Oct`);
    expect(text).toContain(`later than any past cycle: ${link("late", "Late")}`);
    expect(text).not.toContain("Later"); // usually January: not in the next two weeks
    expect(text).not.toContain("None"); // no MBA internship
  });
  it("labels predictions as estimates", () => {
    expect(text).toMatch(/Expected to open in the next two weeks\* _\(estimates from past cycles/);
  });
  it("links each company once, to its own page", () => {
    for (const id of ["fresh", "soon", "old", "due", "late"]) expect(text.split(`/c/${id}/|`).length - 1, id).toBe(1);
  });
  it("lists GSB dates in force or starting within two weeks", () => {
    expect(text).toContain("• AAP (until Oct 29)");
    expect(text).toContain("• Career fair (Oct 9)");
    expect(text).not.toContain("Interviews");
    expect(digest(input("2026-10-20"))).toContain("Next is Interviews (Jan 4–8).");
  });
  it("warns when the postings check is stale", () => {
    expect(text).not.toContain("last checked");
    expect(digest(input("2026-10-30"))).toContain("_Postings were last checked Oct 4, 26 days ago");
  });
  it("escapes Slack's control characters", () => {
    const i = input("2026-10-04");
    i.hiring.none = hire([w("2026", "2026-10-01")]);
    expect(digest(i)).toContain("|None &amp; Co>");
  });
  it("stays short on the real data", () => {
    const real = digest({ companies, hiring, calendar, cycle: meta.currentCycle, researched: meta.researched, today: meta.researched });
    expect(real.split("\n").length).toBeLessThan(30);
  });
});
