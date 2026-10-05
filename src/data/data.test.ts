import { describe, expect, it } from "vitest";
import { calendar, companies, hiring, interviews, meta, prep, roles, sources } from ".";
import { seasonEnd, seasonStart } from "@/lib/season";

// Data health checks. These run in CI-free `npm test` and before every build (see package.json "prebuild").

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isISO = (s: unknown) => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(s));
const CYCLES = ["2023", "2024", "2025", "2026"];

/** Every `sources: [...]` array anywhere in the data. */
function citedIds(x: unknown, out: string[] = []): string[] {
  if (Array.isArray(x)) x.forEach((v) => citedIds(v, out));
  else if (x && typeof x === "object")
    for (const [k, v] of Object.entries(x)) {
      if (k === "sources" && Array.isArray(v) && v.every((s) => typeof s === "string")) out.push(...(v as string[]));
      else citedIds(v, out);
    }
  return out;
}
const allData = { companies, hiring, interviews, roles, calendar, prepNotes: prep.notes };

describe("sources", () => {
  it.each(Object.entries(sources))("%s is well-formed", (_, s) => {
    expect(s.url).toMatch(/^https:\/\//);
    expect(s.title.length).toBeGreaterThan(0);
    expect(s.publisher.length).toBeGreaterThan(0);
    expect(isISO(s.accessed)).toBe(true);
    if (s.published !== null) expect(isISO(s.published)).toBe(true);
    expect(["primary", "archive", "secondary", "forum"]).toContain(s.kind);
    if (s.quote) expect(s.quote.split(/\s+/).length).toBeLessThan(15); // short quotes only
  });

  it("every cited source exists", () => {
    const missing = citedIds(allData).filter((id) => !sources[id]);
    expect([...new Set(missing)]).toEqual([]);
  });

  it("every source is cited somewhere", () => {
    const cited = new Set(citedIds(allData));
    expect(Object.keys(sources).filter((id) => !cited.has(id))).toEqual([]);
  });
});

describe("companies", () => {
  it("have unique ids and a hiring record each", () => {
    const ids = companies.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(hiring).sort()).toEqual([...ids].sort());
  });

  it.each(companies.map((c) => [c.id, c] as const))("%s metrics are coherent", (_, c) => {
    for (const m of [c.marketCap, c.growth, c.headcount, c.b2bPayer, c.b2bUser]) {
      expect(m.sources.length, "every metric is sourced").toBeGreaterThan(0);
      if (m.low !== undefined) expect(m.low).toBeLessThanOrEqual(m.value);
      if (m.high !== undefined) expect(m.high).toBeGreaterThanOrEqual(m.value);
      if (m.asOf !== undefined) expect(isISO(m.asOf)).toBe(true);
    }
    for (const m of [c.b2bPayer, c.b2bUser]) {
      expect(m.value).toBeGreaterThanOrEqual(0);
      expect(m.value).toBeLessThanOrEqual(100);
      expect(m.reasoning.length).toBeGreaterThan(20);
    }
    expect(c.marketCap.value).toBeGreaterThan(0);
    expect(c.marketCap.asOf && isISO(c.marketCap.asOf)).toBe(true);
    expect(c.headcount.value).toBeGreaterThan(0);
  });

  it.each(companies.map((c) => [c.id, c.office] as const))("%s office policy matches its category", (_, o) => {
    expect(o.sources.length).toBeGreaterThan(0);
    if (o.category === "fixed") expect(typeof o.days).toBe("number");
    if (o.category === "team" && (o.low !== undefined || o.high !== undefined)) expect(o.low! < o.high!).toBe(true); // a team policy may have no published band
    if (o.category === "flexible" || o.category === "remote") expect(o.days).toBeNull();
    if (o.days !== null) expect(o.days).toBeGreaterThan(0);
  });
});

describe("hiring windows", () => {
  it.each(Object.entries(hiring))("%s", (id, h) => {
    expect(isISO(h.current.checked)).toBe(true);
    expect(h.pattern.length).toBeGreaterThan(0);
    if (!h.hasProgram) expect(h.windows).toEqual([]);
    expect(new Set(h.windows.map((w) => w.cycle)).size, `${id}: one window per cycle`).toBe(h.windows.length);
    for (const w of h.windows) {
      expect(CYCLES).toContain(w.cycle);
      expect(isISO(w.from) && isISO(w.to)).toBe(true);
      expect(w.from <= w.to, `${id} ${w.cycle}: from ≤ to`).toBe(true);
      expect(w.from >= seasonStart(w.cycle) && w.to <= seasonEnd(w.cycle), `${id} ${w.cycle}: inside its season`).toBe(true);
      if (w.closes) expect(w.closes >= w.from).toBe(true);
      expect(["strong", "medium", "weak"]).toContain(w.evidence);
      expect(w.sources.length, `${id} ${w.cycle}: sourced`).toBeGreaterThan(0);
      if (w.cycle === meta.currentCycle) expect(w.from <= h.current.checked, `${id}: this cycle's window can't be in the future`).toBe(true);
    }
    for (const p of h.current.postings) {
      expect(p.url).toMatch(/^https:\/\//);
      if (p.posted) expect(isISO(p.posted)).toBe(true);
      if (p.closes) expect(isISO(p.closes)).toBe(true);
    }
  });
});

describe("roles", () => {
  const names = new Set(companies.map((c) => c.name));
  it.each(roles.map((r) => [r.id, r] as const))("%s", (_, r) => {
    expect(r.keywords.length).toBeGreaterThan(0);
    expect(["low", "some", "high"]).toContain(r.technical);
    if (r.prepKey) expect(prep.roles).toContain(r.prepKey);
    for (const t of r.titles) {
      expect(names.has(t.company), `unknown company ${t.company}`).toBe(true);
      expect(t.sources.length, `${t.title} is sourced`).toBeGreaterThan(0);
      t.cycles.forEach((c) => expect(CYCLES).toContain(c));
    }
  });
  it("have unique ids", () => expect(new Set(roles.map((r) => r.id)).size).toBe(roles.length));
});

describe("interviews", () => {
  it.each(Object.entries(interviews))("%s", (id, iv) => {
    expect(companies.some((c) => c.id === id)).toBe(true);
    expect(["high", "medium"], "low-confidence processes are left off the site").toContain(iv.confidence);
    expect(iv.stages.length).toBeGreaterThan(1);
    for (const s of iv.stages) s.types.forEach((t) => expect(["behavioral", "product", "analytical", "technical", "case", "milestone"]).toContain(t));
    expect(iv.sources.length).toBeGreaterThan(0);
  });
});

describe("gsb calendar", () => {
  it.each(calendar.map((m) => [m.id, m] as const))("%s", (_, m) => {
    expect(isISO(m.from)).toBe(true);
    if (m.to) expect(isISO(m.to) && m.from <= m.to).toBe(true);
    expect(["blackout", "quiet", "events", "interviews", "deadline", "academic"]).toContain(m.kind);
    expect(m.sources.length).toBeGreaterThan(0);
  });
});

describe("prep matrix", () => {
  it("is complete and well-formed", () => {
    for (const r of prep.roles)
      for (const sk of prep.skills)
        for (const src of prep.columns) {
          const c = prep.matrix[r]?.[sk]?.[src];
          expect(c, `${r} / ${sk} / ${src}`).toBeDefined();
          expect([0, 1, 2, 3]).toContain(c.score);
          if (c.url) expect(c.url).toMatch(/^https:\/\//);
          if (c.score > 0) expect(c.items.length, `${r} / ${sk} / ${src} has items`).toBeGreaterThan(0);
        }
    expect(isISO(prep.checked)).toBe(true);
  });
});

describe("meta", () => {
  it("is valid", () => {
    expect(CYCLES).toContain(meta.currentCycle);
    expect(isISO(meta.researched)).toBe(true);
    if (meta.corrections) {
      expect(meta.corrections.action).toMatch(/^https:\/\//);
      if (meta.corrections.kind === "google") expect(meta.corrections.action).toMatch(/\/formResponse$/);
    }
    expect(meta.analytics === null || meta.analytics.kind === "goatcounter", "analytics is off (null) or GoatCounter").toBe(true);
    if (meta.analytics) expect(meta.analytics.code, "a GoatCounter site code, not a URL").toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });
});
