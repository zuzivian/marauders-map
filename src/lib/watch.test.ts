import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hiring } from "@/data";
import watchJson from "@/data/watch.json";
import type { Posting, WatchEntry } from "@/data/types";
import * as W from "./watch";

// Fixtures are real responses recorded on 2026-10-04, trimmed (see __fixtures__/watch). No test touches the network.
const raw = (f: string) => readFileSync(new URL(`./__fixtures__/watch/${f}`, import.meta.url), "utf8");
const fx = (f: string) => JSON.parse(raw(f));
const watch = watchJson as unknown as Record<string, WatchEntry>;
const CYCLE = "2026" as const;
const verdict = (j: W.Job) => {
  const v = W.classify(j, CYCLE);
  return v.match ? `match:${v.basis}` : v.reason;
};
const job = (over: Partial<W.Job>): W.Job => ({ key: "1", title: "", url: "https://example.com/1", posted: null, closes: null, countries: ["US"], location: "", ...over });
const byTitle = (jobs: W.Job[], re: RegExp) => jobs.find((j) => re.test(j.title))!;

describe("parsers on recorded responses", () => {
  it("Greenhouse (Waymo): posted date from first_published, Job Level intern flag", () => {
    const jobs = W.parseGreenhouse(fx("greenhouse-waymo.json"));
    const ops = byTitle(jobs, /MBA, Operations Planning/);
    expect(ops).toMatchObject({ key: "8165014", posted: "2026-09-01", url: "https://careers.withwaymo.com/jobs?gh_jid=8165014", intern: true });
    expect(jobs.filter((j) => W.classify(j, CYCLE).match).map((j) => j.key).sort()).toEqual(["8165014", "8197014", "8198582"]);
    expect(W.inUS(byTitle(jobs, /RO Performance/))).toBe(false); // Warsaw
  });

  it("Workday (Salesforce): list, intern facet, detail with stated end date and country", () => {
    const ep = watch.salesforce.endpoints[0];
    expect(W.workdayInternFacets(fx("workday-salesforce-first.json"))).toEqual({ workerSubType: ["3a910852b2c31010f48d2cefdccd0000"] });
    const list = W.parseWorkdayList(fx("workday-salesforce-interns.json"), ep);
    expect(list).toHaveLength(4);
    expect(list[0].key).toBe("JR362509");
    expect(list[0].url).toBe(hiring.salesforce.current.postings[0].url);
    const d = W.parseWorkdayDetail(fx("workday-salesforce-detail.json"), list[0]);
    expect(d).toMatchObject({ posted: "2026-10-01", closes: "2026-10-20", countries: ["US"] });
    const de = W.parseWorkdayDetail(fx("workday-salesforce-detail-de.json"), byTitle(list, /Sales Intern \(North\)/));
    expect(de.countries).toEqual(["DE"]);
    expect(verdict(de)).toBe("no MBA"); // "Bachelor/Master - not MBA"
  });

  it("Workday intern facets ignore look-alikes and prefer workerSubType", () => {
    const facets = (values: [string, string][]) => ({ facets: values.map(([p, d]) => ({ facetParameter: p, values: [{ descriptor: d, id: `${p}-${d}` }] })) });
    expect(W.workdayInternFacets(facets([["jobFamilies", "Internal Controls"]]))).toBeNull();
    expect(W.workdayInternFacets(facets([["jobFamilyGroup", "Apprentice & Intern"], ["workerSubType", "Intern (Fixed Term) (Seasonal) (Trainee)"]]))).toEqual({ workerSubType: ["workerSubType-Intern (Fixed Term) (Seasonal) (Trainee)"] });
    expect(W.workdayInternFacets(facets([["jobFamily", "Intern"]]))).toEqual({ jobFamily: ["jobFamily-Intern"] });
  });

  it("amazon.jobs: MBA internships in, full-time MBA programs out", () => {
    const jobs = W.parseAmazon(fx("amazon.json"));
    const known = hiring.amazon.current.postings.map((p) => W.keyFromUrl("amazon", p.url));
    const matched = jobs.filter((j) => W.classify(j, CYCLE).match).map((j) => j.key);
    expect(verdict(byTitle(jobs, /MLDP\) Full-Time/))).toBe("full-time MBA role");
    expect(verdict(byTitle(jobs, /ALA\) - Product Manager Full Time/))).toBe("not an internship");
    expect(verdict(byTitle(jobs, /PMT\) Intern/))).toBe("match:requirement"); // "Currently enrolled in MBA program"
    expect(byTitle(jobs, /PMT\) Intern/).posted).toBe("2026-08-20");
    // Every matched job is one the site already lists; the AWS HR LDP role says MBA only loosely, and is a known posting.
    expect(matched.every((k) => known.includes(k))).toBe(true);
  });

  it("Eightfold (Microsoft): search and detail", () => {
    const jobs = W.parseEightfoldSearch(fx("eightfold-microsoft-search.json"), "https://apply.careers.microsoft.com");
    const bpm = byTitle(jobs, /Business Program Management INTERN/);
    expect(bpm).toMatchObject({ key: "1970393557019360", ref: "200058904", posted: "2026-09-30", countries: ["US"] });
    expect(W.needsDetail(bpm)).toBe(true);
    expect(verdict(bpm)).toBe("no MBA");
    const d = W.parseEightfoldDetail(fx("eightfold-microsoft-detail.json"), bpm);
    expect(d.intern).toBe(true);
    expect(verdict(d)).toBe("match:requirement");
    expect(verdict(byTitle(jobs, /PhD Internship/))).toBe("other degree");
  });

  it("Apple: embedded search results", () => {
    const jobs = W.parseApple(raw("apple-search.html"));
    expect(jobs[0]).toMatchObject({ key: "200676091", ref: "200676091-3810", title: "MBA Internships", posted: "2026-08-05", countries: ["US"] });
    expect(W.keyFromUrl("apple", hiring.apple.current.postings[0].url)).toBe("200676091");
    expect(verdict(byTitle(jobs, /Masters Internships/))).toBe("other degree");
    expect(() => W.parseApple("<html></html>")).toThrow(/hydration/);
  });

  it("Google: embedded results; EMEA-only postings are found, dropped as non-US, and labelled", () => {
    const jobs = W.parseGoogle(raw("google-results.html"));
    expect(jobs).toHaveLength(3);
    for (const j of jobs) {
      expect(verdict(j)).toBe("match:title");
      expect(W.inUS(j)).toBe(false);
      expect(W.regionOnly(j)).toBe("EMEA");
    }
    expect(byTitle(jobs, /Finance MBA Intern/)).toMatchObject({ key: "93402210922046150", countries: ["IE"], posted: "2026-10-02", closes: "2026-11-13" });
    expect(() => W.parseGoogle("<html></html>")).toThrow(/ds:1/);
  });

  it("TikTok: subject labels, off-cycle project interns and full-time graduates", () => {
    const jobs = W.parseTikTok(fx("tiktok.json"));
    expect(verdict(byTitle(jobs, /Content and Service Ads/))).toBe("match:title");
    expect(verdict(byTitle(jobs, /Project Intern \(Advertisement/))).toBe("other cycle"); // "2026 Start"
    expect(verdict(byTitle(jobs, /Associate Graduate/))).toBe("full-time MBA role");
    expect(W.inUS(byTitle(jobs, /Creative-GMPT/))).toBe(false); // Singapore
    expect(byTitle(jobs, /Content and Service Ads/).url).toBe("https://lifeattiktok.com/search/7676283436713593093");
  });

  it("SmartRecruiters (ServiceNow): undergrad interns out; closed postings report active: false", () => {
    const jobs = W.parseSmartRecruiters(fx("smartrecruiters-servicenow.json"), "ServiceNow");
    const fin = byTitle(jobs, /Finance Intern - Undergrad/);
    expect(fin).toMatchObject({ intern: true, countries: ["US"], posted: "2026-09-28" });
    expect(verdict(fin)).toBe("other degree");
    expect(W.parseSmartRecruitersDetail(fx("smartrecruiters-closed.json"), fin).active).toBe(false);
  });

  it("Oracle Recruiting (Dell): list and detail with the stated end date", () => {
    const base = watch.dell.params!.jobBase;
    const jobs = W.parseOracle(fx("oracle-dell.json"), base);
    expect(verdict(byTitle(jobs, /Finance Undergraduate Intern/))).toBe("other degree");
    expect(jobs.filter((j) => W.inUS(j)).length).toBeLessThan(jobs.length);
    const d = W.parseOracleDetail(fx("oracle-dell-detail.json"), { ...jobs[0], key: "298518", title: "Global Operations Supply Chain Graduate Intern" });
    expect(d).toMatchObject({ closes: "2026-10-31", intern: true });
    expect(verdict(d)).toBe("no MBA");
    expect(W.keyFromUrl("oracle-hcm", `${base}/job/298518`)).toBe("298518");
  });

  it("IBM: MBA required in the body, spelled out, or mentioned in passing", () => {
    const jobs = [...W.parseIbm(fx("ibm.json")), ...W.parseIbm(fx("ibm-spelled-out.json"))];
    expect(verdict(byTitle(jobs, /FLDP/))).toBe("match:requirement");
    expect(verdict(byTitle(jobs, /Corporate Strategy Summer Consultant/))).toBe("match:requirement"); // "Pursuing Master of Business Administration"
    expect(verdict(byTitle(jobs, /Finance Specialist \(SAP\)/))).toBe("MBA mentioned only in passing");
    const known = hiring.ibm.current.postings;
    expect(known.every((p) => jobs.some((j) => W.sameJob("ibm", p, j)))).toBe(true);
  });

  it("Radancy (Intuit): list from HTML-in-JSON, then JSON-LD on the job page", () => {
    const jobs = W.parseRadancy(fx("radancy-intuit.json"), "https://jobs.intuit.com");
    const pm = byTitle(jobs, /^Summer 2027: Product Manager Intern$/);
    expect(pm.key).toBe("100620927632");
    expect(verdict(byTitle(jobs, /MBA Finance Strategy/))).toBe("match:title");
    expect(W.inUS(byTitle(jobs, /QuickBooks/))).toBe(false); // London
    const d = W.parseJobPostingLd(raw("radancy-intuit-job.html"), pm);
    expect(d).toMatchObject({ posted: "2026-09-11", countries: ["US", "US"] });
    expect(verdict(d)).toBe("MBA mentioned only in passing"); // "bachelor's, master's, MBA, PhD"
  });

  it("Ashby (OpenAI): 'Internal' is not 'intern'", () => {
    const jobs = W.parseAshby(fx("ashby-openai.json"));
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) expect(verdict(j)).toBe("not an internship");
    expect(jobs[0].countries).toContain("US");
  });
});

describe("classify", () => {
  it.each([
    ["2027 MBA Intern – Product Manager", null, "match:title"],
    ["Summer 2027 Intern - MBA Business Value & Strategic Selling Consultant", null, "match:title"],
    ["MBA Intern, Summer 2027", null, "match:title"],
    ["MBA Internships", "2026-08-05", "match:title"],
    ["MBA Intern, Summer 2026", null, "other cycle"],
    ["MBA Internships", "2026-03-01", "other cycle"], // undated title, posted before this season
    ["2027 MBA Leadership Development Program (MLDP) Full-Time", null, "full-time MBA role"],
    ["Finance Intern - Undergrad Summer 2027", null, "other degree"],
    ["2027 Summer Intern, BS/MS, Global Supply Management (GSM)", null, "other degree"],
    ["Advanced Analytics Intern (MS/MBA)", null, "match:title"],
    ["Software Engineering Intern", null, "no MBA"],
    ["Senior Manager, Internal Controls", null, "not an internship"],
  ])("%s → %s", (title, posted, want) => expect(verdict(job({ title, posted }))).toBe(want));

  it("reads the description only when the title doesn't decide", () => {
    expect(verdict(job({ title: "Business Program Management INTERN", text: "Currently pursuing an MBA with an expected graduation in 2028." }))).toBe("match:requirement");
    expect(verdict(job({ title: "Strategy Intern", text: "Open to bachelor's, master's, MBA or PhD students." }))).toBe("MBA mentioned only in passing");
    expect(verdict(job({ title: "Sales Intern", text: "You are enrolled in a University degree (Bachelor/Master - not MBA)" }))).toBe("no MBA");
    expect(verdict(job({ title: "Strategy Intern", text: "MBA required." }))).toBe("match:requirement");
    expect(verdict(job({ title: "PhD Research Intern", text: "Currently pursuing an MBA" }))).toBe("other degree");
  });

  it("uses the ATS intern flag and labels", () => {
    expect(verdict(job({ title: "Strategy Associate (MBA)", intern: true }))).toBe("match:title");
    expect(verdict(job({ title: "Strategy (TikTok Shop) - 2027 Summer", tags: ["MBA Intern - 2027 Start"], intern: true }))).toBe("match:title");
  });
});

describe("locations", () => {
  it.each([
    [{ countries: ["US"], location: "" }, true],
    [{ countries: ["IE"], location: "Dublin, Ireland" }, false],
    [{ countries: [], location: "Mountain View, California" }, true],
    [{ countries: [], location: "Germany - Munich" }, false],
    [{ countries: [], location: "London, United Kingdom" }, false],
    [{ countries: [], location: "Multiple Locations" }, true],
    [{ countries: [], location: "2 Locations" }, true],
    [{ countries: [], location: "" }, true],
  ])("%j → %s", (j, want) => expect(W.inUS(j)).toBe(want));
});

describe("posting ids", () => {
  it("every posting on the site has an id the watcher can match (or a title, for Waymo's slug URLs)", () => {
    for (const [id, e] of Object.entries(watch)) {
      if (e.kind === "manual") continue;
      for (const p of hiring[id].current.postings) {
        const key = W.keyFromUrl(e.kind, p.url);
        if (!key) expect([id, p.url]).toEqual(["waymo", "https://careers.withwaymo.com/jobs/2027-summer-intern-mba-operations-planning-san-francisco-california-united-states"]);
      }
    }
  });

  it.each([
    ["workday", "https://nvidia.wd5.myworkdayjobs.com/en-US/nvidiaexternalcareersite/job/Financial-Analyst-MBA-Intern_JR2010483-1/apply/applyManually", "JR2010483"],
    ["workday", "https://workday.wd5.myworkdayjobs.com/en-US/Workday_Early_Career/job/Enterprise-Planning--MBA-Intern_JR-0101956", "JR-0101956"],
    ["workday", "https://visa.wd5.myworkdayjobs.com/en-US/Visa_Early_Careers/job/US---Foster-City-CA/Staff-Research-Scientist--Intern---PhD-Quantum_REF088578W-1", "REF088578W"],
    ["greenhouse", "https://careers.withwaymo.com/jobs/2027-summer-intern-mba-operations-planning-san-francisco-california-united-states", null],
    ["greenhouse", "https://careers.airbnb.com/positions/8184174?gh_jid=8184174", "8184174"],
    ["ibm", "https://careers.ibm.com/en_US/careers/JobDetail/Corporate-Strategy-Summer-Consultant-Internship/130063", "130063"],
    ["smartrecruiters", "https://jobs.smartrecruiters.com/ServiceNow/744000083356169-finance-intern-mba-summer-2026", "744000083356169"],
    ["radancy", "https://jobs.intuit.com/job/mountain-view/summer-2027-product-manager-intern/27595/100620927632", "100620927632"],
  ] as const)("%s %s", (kind, url, want) => expect(W.keyFromUrl(kind, url)).toBe(want));
});

describe("diffPostings", () => {
  const known: Posting[] = hiring.salesforce.current.postings;
  const list = W.parseWorkdayList(fx("workday-salesforce-interns.json"), watch.salesforce.endpoints[0]);
  const matches = list.filter((j) => W.classify(j, CYCLE).match);

  it("finds nothing new when the site is up to date", () => {
    const d = W.diffPostings("workday", known, list, matches);
    expect(d.added).toEqual([]);
    expect(d.present).toHaveLength(3);
    expect(d.missing).toEqual([]);
  });

  it("reports a new posting, and a known one that left the results", () => {
    const fresh = job({ key: "JR999999", title: "Summer 2027 Intern - MBA Product Manager", url: "https://x/job/y/Z_JR999999" });
    const d = W.diffPostings("workday", known, [...list.slice(1), fresh], [...matches.slice(1), fresh]);
    expect(d.added.map((j) => j.key)).toEqual(["JR999999"]);
    expect(d.missing.map((p) => p.title)).toEqual([known[0].title]);
  });

  it("counts a known posting as present even if its title changed", () => {
    const renamed = list.map((j, i) => (i === 0 ? { ...j, title: "Retitled" } : j));
    expect(W.diffPostings("workday", known, renamed, []).present).toHaveLength(3);
  });

  it("doesn't re-report logged removals, and notices a posting that came back", () => {
    const changes = [{ date: "2026-10-05", company: "salesforce", kind: "removed" as const, title: known[0].title, url: known[0].url }];
    const removed = W.removedUrls(changes, "salesforce");
    expect(W.diffPostings("workday", known, list.slice(1), [], removed).missing).toEqual([]);
    expect(W.diffPostings("workday", known, list, [], removed).reappeared).toHaveLength(1);
    expect(W.removedUrls([...changes, { ...changes[0], kind: "posted" as const, date: "2026-10-06" }], "salesforce").size).toBe(0);
  });

  it("matches Waymo's slug-URL posting by title", () => {
    const jobs = W.parseGreenhouse(fx("greenhouse-waymo.json"));
    const d = W.diffPostings("greenhouse", hiring.waymo.current.postings, jobs, jobs.filter((j) => W.classify(j, CYCLE).match));
    expect(d.added).toEqual([]);
    expect(d.present).toHaveLength(3);
  });
});

describe("inferWindow", () => {
  const added = (posted: string | null) => [{ job: job({ title: "MBA Intern, Summer 2027", posted }), sourceId: "google-1" }];
  it("uses a stated posting date (strong)", () => {
    expect(W.inferWindow({ cycle: CYCLE, prevChecked: "2026-10-04", today: "2026-10-06", added: added("2026-10-05") })).toMatchObject({ cycle: "2026", from: "2026-10-05", to: "2026-10-05", evidence: "strong", sources: ["google-1"] });
  });
  it.each([
    ["2026-10-04", "2026-10-05", "strong"],
    ["2026-09-28", "2026-10-05", "strong"],
    ["2026-09-20", "2026-10-05", "medium"],
    ["2026-08-01", "2026-10-05", "weak"],
  ] as const)("brackets an undated posting between checks %s and %s → %s", (prevChecked, today, evidence) => {
    expect(W.inferWindow({ cycle: CYCLE, prevChecked, today, added: added(null) })).toMatchObject({ from: prevChecked, to: today, evidence });
  });
  it("stays inside the season", () => {
    expect(W.inferWindow({ cycle: CYCLE, prevChecked: "2026-04-01", today: "2026-05-03", added: added(null) }).from).toBe("2026-05-01");
    expect(W.inferWindow({ cycle: CYCLE, prevChecked: "2026-10-04", today: "2026-10-05", added: added("2026-10-06") }).from).toBe("2026-10-05");
  });
});

describe("writing helpers", () => {
  it("summarize", () => {
    expect(W.summarize({ today: "2026-10-05", live: [], removed: 2 })).toBe("As of 2026-10-05, no US MBA intern posting is live. 2 earlier postings have been taken down.");
    expect(W.summarize({ today: "2026-10-05", live: [{ title: "MBA Intern, Summer 2027", posted: "2026-10-05", closes: "2026-11-07" }], removed: 0 })).toBe(
      "As of 2026-10-05, 1 US MBA intern posting is live, posted 2026-10-05: 'MBA Intern, Summer 2027'. Stated deadline 2026-11-07.",
    );
    const many = ["A", "B", "C", "D"].map((t, i) => ({ title: t, posted: `2026-09-0${i + 1}`, closes: null }));
    expect(W.summarize({ today: "2026-10-05", live: many, removed: 1 })).toBe(
      "As of 2026-10-05, 4 US MBA intern postings are live, posted 2026-09-01 to 2026-09-04: 'A', 'B' and 'C' and 1 more. No stated deadline. 1 earlier posting has been taken down.",
    );
  });

  it("insertSorted keeps the file's order", () => {
    const o = { "a-1": 1, "c-1": 3, "z-tail": 9, "b-tail": 8 };
    expect(Object.keys(W.insertSorted(o, "b-1", 2))).toEqual(["a-1", "b-1", "c-1", "z-tail", "b-tail"]);
    expect(Object.keys(W.insertSorted({ a: 1 }, "b", 2))).toEqual(["a", "b"]);
  });

  it("sourceId and sourceFor", () => {
    const j = job({ key: "R172263", title: "2027 MBA Intern – Strategy", posted: "2026-10-05", url: "https://adobe.example/job/R172263" });
    expect(W.sourceId("adobe", j, { "adobe-R172263": {} })).toBe("adobe-R172263-2");
    expect(W.sourceFor(j, { publisher: "Adobe Workday" }, "2026-10-05")).toEqual({ url: j.url, title: "2027 MBA Intern – Strategy (R172263)", publisher: "Adobe Workday", published: "2026-10-05", accessed: "2026-10-05", kind: "primary", quote: null });
  });

  it("dates", () => {
    expect(W.parseDate("August  4, 2026")).toBe("2026-08-04");
    expect(W.parseDate("Oct 02, 2026")).toBe("2026-10-02");
    expect(W.parseDate("2026-9-11")).toBe("2026-09-11");
    expect(W.parseDate("soon")).toBeNull();
    expect(W.pacificDate("2025-05-29T00:34:00Z")).toBe("2025-05-28"); // Apple's evening-of-May-28 posting
    expect(W.pacificDate(1790946563)).toBe("2026-10-02");
  });
});

describe("renderReport", () => {
  it("lists new, gone, region-only and manual companies", () => {
    const g = W.parseGoogle(raw("google-results.html"));
    const posting = hiring.salesforce.current.postings[0];
    const md = W.renderReport({
      today: "2026-10-05",
      cycle: CYCLE,
      write: true,
      researched: { from: "2026-10-04", to: "2026-10-05" },
      results: [
        { id: "google", name: "Google", status: "ok", hasProgram: true, diff: { added: [job({ title: "MBA Intern, Summer 2027", posted: "2026-10-05" })], present: [], missing: [], reappeared: [] }, gone: [], nonUS: g.map((j) => ({ job: j, region: W.regionOnly(j) })), window: { cycle: "2026", from: "2026-10-05", to: "2026-10-05", evidence: "strong", sources: ["x"] }, summary: { before: "old", after: "new" } },
        { id: "salesforce", name: "Salesforce", status: "ok", hasProgram: true, diff: { added: [], present: [], missing: [posting], reappeared: [] }, gone: [{ posting, confirmed: true }], stamped: ["sf-JR362509"] },
        { id: "nvidia", name: "Nvidia", status: "ok", hasProgram: true, diff: { added: [], present: [], missing: [], reappeared: [] }, gone: [] },
        { id: "meta", name: "Meta", status: "manual", hasProgram: true, reason: "no API" },
        { id: "uber", name: "Uber", status: "failed", hasProgram: true, reason: "HTTP 403" },
      ],
    });
    expect(md).toContain("## New postings (1)");
    expect(md).toContain("window 2026-10-05 (strong evidence) added");
    expect(md).toContain("## Disappeared, probably closed (1)");
    expect(md).toContain("`sf-JR362509`");
    expect(md).toContain("status sentence rewritten");
    expect(md).toContain("only for students at EMEA schools");
    expect(md).toContain("- Nvidia: no US MBA internship posted");
    expect(md).toContain("- Meta (manual): no API");
    expect(md).toContain("- Uber (failed): HTTP 403");
    expect(md).toContain("`meta.researched` moved from 2026-10-04 to 2026-10-05");
  });
});
