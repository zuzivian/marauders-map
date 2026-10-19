import { describe, expect, it } from "vitest";
import type { Change, Hiring, Posting } from "@/data/types";
import { cameDownLine, cameDownStats, lifetimes } from "./lifetime";

const post = (n: number, posted: string | null = null, closes: string | null = null): Posting =>
  ({ title: `Intern ${n}`, posted, closes, url: `https://x.test/${n}`, sources: ["x"] });
const ch = (date: string, kind: Change["kind"], n: number, company = "a"): Change => ({ date, company, kind, title: `Intern ${n}`, url: `https://x.test/${n}` });
const co = (postings: Posting[]): Hiring => ({ hasProgram: true, pattern: "", windows: [], current: { checked: "2026-10-18", summary: "", postings } });

describe("lifetimes", () => {
  it("counts a removed posting from its own date to the check that missed it", () => {
    const [l] = lifetimes("a", [post(1, "2026-08-02")], [ch("2026-10-10", "removed", 1)], "2026-10-18");
    expect(l).toEqual({ state: "removed", start: "2026-08-02", startIsPosted: true, removed: "2026-10-10", days: 69 });
  });

  it("ages a live posting to today", () => {
    const [l] = lifetimes("a", [post(1, "2026-09-11")], [], "2026-10-18");
    expect(l).toMatchObject({ state: "live", start: "2026-09-11", startIsPosted: true, days: 37 });
    expect(l.removed).toBeUndefined();
  });

  it("falls back to the first logged sighting, marked approximate", () => {
    const [l] = lifetimes("a", [post(1)], [ch("2026-10-06", "posted", 1), ch("2026-10-12", "posted", 1)], "2026-10-18");
    expect(l).toMatchObject({ state: "live", start: "2026-10-06", startIsPosted: false, days: 12 });
  });

  it("has no lifetime without any start, but still knows it came down", () => {
    const [l] = lifetimes("a", [post(1)], [ch("2026-10-07", "removed", 1)], "2026-10-18");
    expect(l).toEqual({ state: "removed", start: null, startIsPosted: false, removed: "2026-10-07", days: null });
  });

  it("goes by the last change: a posting that came back is live again", () => {
    const log = [ch("2026-09-20", "removed", 1), ch("2026-09-25", "posted", 1)];
    expect(lifetimes("a", [post(1, "2026-09-01")], log, "2026-10-18")[0]).toMatchObject({ state: "live", days: 47 });
    // and one that came down twice is dated by the last removal
    expect(lifetimes("a", [post(1, "2026-09-01")], [...log, ch("2026-10-01", "removed", 1)], "2026-10-18")[0]).toMatchObject({ state: "removed", removed: "2026-10-01", days: 30 });
  });

  it("ignores other companies and changes after today", () => {
    const log = [ch("2026-10-10", "removed", 1, "b"), ch("2026-10-20", "removed", 1)];
    expect(lifetimes("a", [post(1, "2026-10-01")], log, "2026-10-18")[0]).toMatchObject({ state: "live", days: 17 });
  });

  it("never goes negative when the posting's date is after the removal", () => {
    expect(lifetimes("a", [post(1, "2026-10-12")], [ch("2026-10-10", "removed", 1)], "2026-10-18")[0].days).toBe(0);
  });
});

describe("postings that came down with no deadline", () => {
  const all = {
    a: co([post(1, "2026-10-01"), post(2, "2026-10-01"), post(3, "2026-10-01", "2026-11-01"), post(4, "2026-10-01"), post(5)]),
    b: co([post(1, "2026-09-01")]),
  };
  const log = [
    ch("2026-10-04", "removed", 1), // 3 days
    ch("2026-10-11", "removed", 2), // 10 days
    ch("2026-10-09", "removed", 3), // has a deadline: left out
    // 4 is still live; 5 has no start
    ch("2026-10-12", "removed", 5),
    ch("2026-10-15", "removed", 1, "b"), // 44 days
  ];

  it("counts only removed, no-deadline postings with a known start", () => {
    expect(cameDownStats(all, log, "2026-10-18")).toEqual({ n: 3, median: 10, min: 3, max: 44 });
  });

  it("takes the middle of the two middle values for an even count", () => {
    expect(cameDownStats(all, log.slice(0, 2), "2026-10-18")).toEqual({ n: 2, median: 7, min: 3, max: 10 });
  });

  it("is null when nothing came down", () => {
    expect(cameDownStats(all, [], "2026-10-18")).toBeNull();
  });

  it("words the line, and says nothing below three postings", () => {
    expect(cameDownLine({ n: 3, median: 10, min: 3, max: 44 })).toBe(
      "Postings without a deadline that came down this cycle stayed up 10 days at the median (3 postings across all companies, 3–44 days).",
    );
    expect(cameDownLine({ n: 3, median: 1, min: 1, max: 1 })).toContain("stayed up 1 day at the median (3 postings across all companies, 1 day each)");
    expect(cameDownLine({ n: 2, median: 7, min: 3, max: 10 })).toBeNull();
    expect(cameDownLine(null)).toBeNull();
  });
});
