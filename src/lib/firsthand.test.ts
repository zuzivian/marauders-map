import { describe, expect, it } from "vitest";
import type { FirsthandReport } from "@/data/types";
import { LIMITS, MIN_FOR_DETAILS, PATHS, TEAM_MATCH, aggregate, byline, problems } from "./firsthand";

// Test fixtures only. firsthand.json ships empty; nothing here is a real report.
const r = (over: Partial<FirsthandReport> = {}): FirsthandReport => ({
  received: "2026-10-10", classOf: 2027, internshipSummer: 2026, roleId: "pm", path: "referral",
  stages: ["Recruiter screen", "Product sense", "Final loop"], teamMatch: "hired to a team",
  whatMattered: "Fixture text.", advice: "Fixture advice.", consent: true, ...over,
});
const known = { roles: ["pm", "pmm"] };

describe("first-hand report rules", () => {
  it("accepts a complete report", () => expect(problems(r(), known)).toEqual([]));
  it("requires consent", () => expect(problems(r({ consent: false as unknown as true }), known)).toContain("no consent to publish"));
  it("checks enums, roles, dates and lengths", () => {
    expect(problems(r({ path: "cold email" as never }), known)).toEqual(["unknown path: cold email"]);
    expect(problems(r({ teamMatch: "maybe" as never }), known)).toEqual(["unknown teamMatch: maybe"]);
    expect(problems(r({ roleId: "ceo" }), known)).toEqual(["unknown role: ceo"]);
    expect(problems(r({ received: "10/10/2026" }), known)).toHaveLength(1);
    expect(problems(r({ advice: "x".repeat(LIMITS.text + 1) }), known)).toEqual([`advice must be 1–${LIMITS.text} characters`]);
    expect(problems(r({ whatMattered: "  " }), known)).toHaveLength(1);
    expect(problems(r({ stages: ["x".repeat(LIMITS.stage + 1)] }), known)).toHaveLength(1);
    expect(problems(r({ firstContactToOffer: -1 }), known)).toHaveLength(1);
    expect(problems(r({ displayName: "" }), known)).toHaveLength(1);
  });
  it("stays in step with the import script", async () => {
    const script = await import("../../scripts/add-firsthand.mjs");
    expect(script.PATHS).toEqual(PATHS);
    expect(script.TEAM_MATCH).toEqual(TEAM_MATCH);
    expect(script.LIMITS).toEqual(LIMITS);
  });
});

describe("aggregate", () => {
  it("counts paths and keeps the stages most reports share, in order", () => {
    const a = aggregate([
      r({ path: "oci", stages: ["Recruiter screen", "Case", "Final loop"], firstContactToOffer: 6 }),
      r({ path: "referral", stages: ["recruiter screen", "Final loop"], firstContactToOffer: 10 }),
      r({ path: "referral", stages: ["Take-home", "Final loop"], internshipSummer: 2025, classOf: 2026 }),
    ])!;
    expect(a.n).toBe(3);
    expect(a.paths).toEqual([["referral", 2], ["oci", 1]]);
    expect(a.stages).toEqual(["Recruiter screen", "Final loop"]);
    expect(a.weeks).toBe(8);
  });
  it(`shows per-report details only for a summer with ${MIN_FOR_DETAILS}+ reports`, () => {
    expect(aggregate([r()])!.summers).toEqual([]);
    expect(aggregate([r(), r({ internshipSummer: 2025 })])!.summers).toEqual([]);
    expect(aggregate([r(), r(), r({ internshipSummer: 2025 })])!.summers.map((s) => [s.summer, s.reports.length])).toEqual([[2026, 2]]);
  });
  it("needs two reports before giving a typical time to offer", () => expect(aggregate([r({ firstContactToOffer: 5 })])!.weeks).toBeNull());
  it("is empty with no reports", () => expect(aggregate([])).toBeNull());
  it("is anonymous unless a name was given", () => {
    expect(byline(r())).toBe("a GSB '27");
    expect(byline(r({ displayName: "Sam" }))).toBe("Sam");
  });
});

describe("import script", async () => {
  const { addReport, normalize, parseInput } = await import("../../scripts/add-firsthand.mjs");
  const ctx = { companies: [{ id: "google", name: "Google" }], roles: [{ id: "pm", name: "Product manager", short: "PM" }] };
  // What the form sends, as Formspree stores it.
  const sub = {
    kind: "firsthand", company: "google", roleId: "pm", classOf: "2027", internshipSummer: "2026", path: "referral",
    firstContactToOffer: "7", stages: "Recruiter screen\nProduct sense\n\nFinal loop", teamMatch: "matched after offer",
    whatMattered: "  Fixture   text. ", advice: "Fixture advice.", displayName: "", consent: "yes", email: "", _date: "2026-10-12T18:04:00Z",
  };

  it("normalizes a submission into a publishable report", () => {
    const { companyId, report } = normalize(sub, ctx);
    expect(companyId).toBe("google");
    expect(report).toEqual({
      received: "2026-10-12", classOf: 2027, internshipSummer: 2026, roleId: "pm", path: "referral", firstContactToOffer: 7,
      stages: ["Recruiter screen", "Product sense", "Final loop"], teamMatch: "matched after offer",
      whatMattered: "Fixture text.", advice: "Fixture advice.", consent: true,
    });
    expect(problems(report as FirsthandReport, { roles: ["pm"] })).toEqual([]);
  });

  it("refuses anything without consent, or that isn't a first-hand note", () => {
    expect(() => normalize({ ...sub, consent: "" }, ctx)).toThrow(/no consent/);
    expect(() => normalize({ ...sub, consent: undefined }, ctx)).toThrow(/no consent/);
    expect(() => normalize({ ...sub, kind: "correction" }, ctx)).toThrow(/not a first-hand note/);
    expect(() => normalize({ ...sub, company: "Initech", path: "carrier pigeon" }, ctx)).toThrow(/unknown company[\s\S]*unknown path/);
  });

  it("trims to the length limits and flags contact details for the moderator", () => {
    const long = `${"word ".repeat(80)}mail me at someone@example.com`;
    const { report, warnings } = normalize({ ...sub, advice: long, stages: "a; b; c; d; e; f; g; h; i; j; k; l; m; n" }, ctx);
    expect(report.advice.length).toBeLessThanOrEqual(LIMITS.text);
    expect(report.advice.endsWith("…")).toBe(true);
    expect(report.stages).toHaveLength(LIMITS.stages);
    expect(warnings.join("\n")).toMatch(/kept the first 12[\s\S]*trimmed advice/);
    expect(normalize({ ...sub, whatMattered: "Call +1 (650) 555-0100" }, ctx).warnings.join()).toMatch(/phone/);
    expect(normalize({ ...sub, whatMattered: "Summer 2025-2026 was fine" }, ctx).warnings.join()).not.toMatch(/phone/);
  });

  it("reads fields pasted from the dashboard or email", () => {
    const [raw] = parseInput("kind: firsthand\ncompany: Google\nroleId\tPM\nclassOf: '27\ninternshipSummer: 2026\npath: referral\nstages: Screen\nCase\nteamMatch: unsure\nwhatMattered: Fixture.\nadvice: Fixture.\nconsent: on");
    const { report } = normalize(raw, { ...ctx, received: "2026-10-12" });
    expect(report).toMatchObject({ classOf: 2027, roleId: "pm", stages: ["Screen", "Case"], teamMatch: "unsure" });
    expect(parseInput(JSON.stringify({ submissions: [sub, sub] }))).toHaveLength(2);
  });

  it("adds each report once, in date order", () => {
    const data: Record<string, unknown[]> = {};
    const { report } = normalize(sub, ctx);
    expect(addReport(data, "google", report, ["google"])).toBe(true);
    expect(addReport(data, "google", report, ["google"])).toBe(false);
    expect(data.google).toHaveLength(1);
  });
});
