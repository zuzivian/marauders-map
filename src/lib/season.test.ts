import { describe, expect, it } from "vitest";
import type { Hiring } from "@/data/types";
import { fmtRange, monthOf, steadiness, typicalOpen, waveOf, weekOf } from "./season";
import { statusOf } from "./status";

const w = (cycle: "2023" | "2024" | "2025" | "2026", from: string, to = from, evidence: "strong" | "medium" | "weak" = "strong", closes?: string) =>
  ({ cycle, from, to, evidence, closes, sources: ["x"] });
const h = (windows: ReturnType<typeof w>[], postings: Hiring["current"]["postings"] = []): Hiring =>
  ({ hasProgram: true, pattern: "", windows, current: { checked: "2026-10-04", summary: "", postings } });

describe("season math", () => {
  it("places dates relative to their own cycle", () => {
    expect(weekOf("2026-05-01", "2026")).toBe(0);
    expect(weekOf("2025-10-01", "2025")).toBeCloseTo(weekOf("2026-10-01", "2026"), 0);
    expect(weekOf("2027-01-15", "2026")).toBeGreaterThan(weekOf("2026-12-15", "2026")); // Jan belongs to the same season
  });
  it("formats ranges", () => {
    expect(fmtRange("2026-10-07", "2026-10-07")).toBe("Oct 7");
    expect(fmtRange("2026-10-07", "2026-10-14")).toBe("Oct 7–14");
    expect(fmtRange("2026-09-25", "2026-10-02")).toBe("Sep 25 – Oct 2");
  });
  it("names the part of the month", () => {
    expect(monthOf(weekOf("2026-10-05", "2026"))).toBe("early Oct");
    expect(monthOf(weekOf("2026-10-16", "2026"))).toBe("mid Oct");
  });
});

describe("derived timing", () => {
  const google = h([w("2023", "2023-10-15", "2023-11-01", "weak"), w("2024", "2024-10-16"), w("2025", "2025-10-07", "2025-10-14", "medium")]);
  it("ignores weak evidence when better exists", () => {
    const t = typicalOpen(google, "2026")!;
    expect(t.n).toBe(2);
    expect(monthOf(t.week)).toBe("mid Oct");
  });
  it("derives the wave from history instead of a hand-set label", () => {
    expect(waveOf(google, "2026")).toBe("fall");
    expect(waveOf(h([w("2024", "2025-01-23"), w("2025", "2026-01-23")]), "2026")).toBe("winter");
    expect(waveOf({ ...google, hasProgram: false, windows: [] }, "2026")).toBe("none");
  });
  it("flags a cycle that opened earlier than ever", () => {
    expect(steadiness(h([w("2024", "2024-10-10"), w("2025", "2025-10-12"), w("2026", "2026-08-05")]), "2026")).toMatchObject({ steady: true, earlier: true });
  });
});

describe("status relative to today", () => {
  const open = h([w("2025", "2025-10-01"), w("2026", "2026-10-01", "2026-10-01", "strong", "2026-10-20")]);
  it("counts down to a deadline", () => {
    expect(statusOf(open, "2026-10-04", "2026")).toMatchObject({ state: "open", headline: "Closes Oct 20 · in 16 days" });
    expect(statusOf(open, "2026-10-15", "2026").state).toBe("closing");
    expect(statusOf(open, "2026-10-21", "2026")).toMatchObject({ state: "closed", headline: "Closed Oct 20" });
  });
  it("predicts from history when nothing is posted, and says so", () => {
    const uber = h([w("2023", "2024-01-06"), w("2024", "2025-01-23"), w("2025", "2026-01-23")]);
    const s = statusOf(uber, "2026-10-04", "2026");
    expect(s.state).toBe("expected");
    expect(s.detail).toMatch(/Not posted as of Oct 4/);
    expect(statusOf(uber, "2027-01-20", "2026").state).toBe("due");
  });
  it("calls a company late once it's past every prior opening", () => {
    const cisco = h([w("2024", "2024-07-23", "2024-08-01"), w("2025", "2025-08-01", "2025-08-15")]);
    expect(statusOf(cisco, "2026-08-05", "2026").state).toBe("due");
    expect(statusOf(cisco, "2026-10-04", "2026")).toMatchObject({ state: "late", headline: "Not posted yet · usually by early Aug" });
  });
});
