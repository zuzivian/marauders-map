import { describe, expect, it } from "vitest";
import type { Hiring, Posting, Source, WatchEntry } from "@/data/types";
import { LIMITS, normalize, onBoard, parseInput } from "./spotted";

// Inline fixtures only: nothing here reads hiring.json, so the checks hold whatever the live data says.
const ctx = {
  companies: [{ id: "meta", name: "Meta" }, { id: "google", name: "Google" }, { id: "openai", name: "OpenAI" }],
  hiring: { meta: { hasProgram: true }, google: { hasProgram: true }, openai: { hasProgram: false } },
  watch: {
    meta: { kind: "manual", board: "https://www.metacareers.com/jobsearch/?q=MBA" },
    google: { kind: "google", board: "https://www.google.com/about/careers/applications/jobs/results/?q=MBA" },
  } as Record<string, Pick<WatchEntry, "kind" | "board">>,
};
// What the form sends, as Formspree stores it.
const sub = { kind: "spotted", company: "meta", url: "https://www.metacareers.com/profile/job_details/1234567890123", title: "  Product Marketing   Intern, MBA ", email: "" };

describe("reading a submission", () => {
  it("takes Formspree JSON: one, an array, or { submissions }", () => {
    expect(parseInput(JSON.stringify(sub))).toEqual([sub]);
    expect(parseInput(JSON.stringify([sub, sub]))).toHaveLength(2);
    expect(parseInput(JSON.stringify({ submissions: [sub] }))).toEqual([sub]);
  });
  it("takes fields pasted from the dashboard or email, with the backend's names", () => {
    const [raw] = parseInput("kind: spotted\ncompany: Meta\nlink\thttps://www.metacareers.com/jobs/1\ntitle: MBA Intern\nSummer 2027\nemail: a@b.co", { url: "link" });
    expect(raw).toEqual({ kind: "spotted", company: "Meta", url: "https://www.metacareers.com/jobs/1", title: "MBA Intern\nSummer 2027", email: "a@b.co" });
    expect(normalize(raw, { ...ctx, fieldMap: { url: "link" } }).title).toBe("MBA Intern Summer 2027");
  });
});

describe("normalize", () => {
  it("tidies a good report", () => {
    expect(normalize(sub, ctx)).toEqual({
      companyId: "meta", url: sub.url, title: "Product Marketing Intern, MBA", email: null, warnings: [],
    });
  });
  it("finds the company by name, maps field names, and keeps the email for the moderator only", () => {
    const out = normalize({ kind: "spotted", co: "META", link: sub.url, name: "MBA Intern", mail: "a@b.co" }, { ...ctx, fieldMap: { company: "co", url: "link", title: "name", email: "mail" } });
    expect(out).toMatchObject({ companyId: "meta", title: "MBA Intern", email: "a@b.co" });
  });
  it("refuses other kinds of submission and the spam trap", () => {
    expect(() => normalize({ ...sub, kind: "firsthand" }, ctx)).toThrow(/not an "it's live" report/);
    expect(() => normalize({ ...sub, _gotcha: "buy now" }, ctx)).toThrow(/spam trap/);
  });
  it("refuses an unknown company, or one with no MBA program, and says every reason", () => {
    expect(() => normalize({ ...sub, company: "Initech" }, ctx)).toThrow(/unknown company: "Initech"/);
    expect(() => normalize({ ...sub, company: "openai" }, ctx)).toThrow(/OpenAI has no MBA program/);
    expect(() => normalize({ ...sub, company: "initech", url: "ftp://x", title: "" }, ctx)).toThrow(/unknown company[\s\S]*not https[\s\S]*no title/);
  });
  it("needs an https link with no login in it", () => {
    for (const url of ["", "metacareers.com/jobs/1", "http://www.metacareers.com/jobs/1", "https://me:pw@www.metacareers.com/jobs/1", `https://www.metacareers.com/${"a".repeat(LIMITS.url)}`])
      expect(() => normalize({ ...sub, url }, ctx), url).toThrow();
  });
  it("needs a title from the report or --title, and --title wins", () => {
    expect(() => normalize({ ...sub, title: " " }, ctx)).toThrow(/no title/);
    expect(normalize({ ...sub, title: " " }, { ...ctx, title: "MBA Intern, Summer 2027" }).title).toBe("MBA Intern, Summer 2027");
    expect(normalize(sub, { ...ctx, title: "MBA Intern, Summer 2027" }).title).toBe("MBA Intern, Summer 2027");
  });
  it("trims a long title and flags links in it", () => {
    const { title, warnings } = normalize({ ...sub, title: `${"word ".repeat(60)}see https://x.example` }, ctx);
    expect(title.length).toBeLessThanOrEqual(LIMITS.title);
    expect(warnings.join("\n")).toMatch(/trimmed the title/);
    expect(normalize({ ...sub, title: "Apply at www.x.example" }, ctx).warnings.join()).toMatch(/title contains a link/);
  });
  it("warns, but doesn't refuse, when the link is off the careers site or the watcher covers the company", () => {
    expect(normalize({ ...sub, url: "https://example.com/meta-job" }, ctx).warnings).toEqual(["CHECK: the link is not on www.metacareers.com, the board in watch.json"]);
    const g = normalize({ ...sub, company: "google", url: "https://www.google.com/about/careers/applications/jobs/results/1" }, ctx);
    expect(g.warnings).toEqual(["the watcher checks Google itself (google); it will likely find this posting on its own"]);
  });
});

describe("onBoard", () => {
  it("matches the board's host or a subdomain of it, ignoring www", () => {
    expect(onBoard("https://metacareers.com/jobs/1", "https://www.metacareers.com/jobsearch/")).toBe(true);
    expect(onBoard("https://careers.google.com/a", "https://www.google.com/about/careers/")).toBe(true);
    expect(onBoard("https://notmetacareers.com/a", "https://www.metacareers.com/")).toBe(false);
    expect(onBoard("https://www.uber.com/careers/1", "https://jobs.uber.com/en/search/")).toBe(false);
  });
});

describe("add script", async () => {
  const { addSpotted } = await import("../../scripts/add-spotted.mjs");
  const today = "2026-10-18";
  const watch = { meta: { kind: "manual", publisher: "Meta Careers" } };
  const fresh = () => ({
    hiring: {
      meta: {
        hasProgram: true, pattern: "", windows: [],
        current: { checked: "2026-10-04", summary: "Nothing found.", postings: [] as Posting[] },
      } as Hiring,
    },
    sources: { "meta-10k": { url: "https://example.com/10k", title: "10-K", publisher: "SEC EDGAR", published: null, accessed: today, kind: "primary", quote: null } } as Record<string, Source>,
    changes: [] as { date: string; company: string; kind: string; title: string; url: string }[],
  });
  const first = { companyId: "meta", url: "https://www.metacareers.com/profile/job_details/1234567890123", title: "MBA Intern, Summer 2027" };

  it("adds the posting, its source, a log entry, a rewritten summary and the window", () => {
    const d = fresh();
    const done = addSpotted(d, watch, "2026", today, first)!;
    expect(done.sourceId).toBe("meta-1234567890123");
    expect(d.hiring.meta.current.postings).toEqual([{ title: first.title, posted: null, closes: null, url: first.url, sources: ["meta-1234567890123"] }]);
    expect(d.sources["meta-1234567890123"]).toEqual({ url: first.url, title: "MBA Intern, Summer 2027 (1234567890123)", publisher: "Meta Careers", published: null, accessed: today, kind: "primary", quote: null });
    expect(Object.keys(d.sources)).toEqual(["meta-10k", "meta-1234567890123"]);
    expect(d.changes).toEqual([{ date: today, company: "meta", kind: "posted", title: first.title, url: first.url }]);
    expect(d.hiring.meta.current.checked).toBe(today);
    expect(d.hiring.meta.current.summary).toBe("As of 2026-10-18, 1 US MBA intern posting is live: 'MBA Intern, Summer 2027'. No stated deadline.");
    // No posted date, so the window runs from the last check that found nothing (2 weeks back: medium).
    expect(d.hiring.meta.windows).toEqual([{
      cycle: "2026", from: "2026-10-04", to: today, evidence: "medium", scope: first.title,
      note: "No posted date in the API. Not listed at the check on 2026-10-04; reported by a student and checked by hand on 2026-10-18.",
      sources: ["meta-1234567890123"],
    }]);
  });
  it("names the source from the title when the link has no job number", () => {
    const d = fresh();
    addSpotted(d, watch, "2026", today, { ...first, url: "https://www.metacareers.com/jobs/mba-intern" });
    expect(d.sources["meta-mba-intern-summer-2027"]).toMatchObject({ title: first.title, published: null });
  });
  it("adds the window for the first posting only, and never twice for the same link", () => {
    const d = fresh();
    addSpotted(d, watch, "2026", today, first);
    const second = addSpotted(d, watch, "2026", today, { ...first, url: `${first.url}9`, title: "MBA Intern, Strategy" })!;
    expect(second.window).toBeNull();
    expect(d.hiring.meta.windows).toHaveLength(1);
    expect(d.hiring.meta.current.postings).toHaveLength(2);
    expect(d.hiring.meta.current.summary).toMatch(/2 US MBA intern postings are live/);
    expect(addSpotted(d, watch, "2026", today, { ...first, url: `${first.url}/#share` })).toBeNull();
    expect(d.changes).toHaveLength(2);
  });
  it("keeps an existing window for the cycle", () => {
    const d = fresh();
    d.hiring.meta.windows.push({ cycle: "2026", from: "2026-09-01", to: "2026-09-01", evidence: "strong", sources: ["meta-10k"] });
    expect(addSpotted(d, watch, "2026", today, first)!.window).toBeNull();
    expect(d.hiring.meta.windows).toHaveLength(1);
  });
});
