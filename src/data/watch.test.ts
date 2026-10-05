import { describe, expect, it } from "vitest";
import { hiring } from ".";
import type { Change, WatchEntry } from "./types";
import watchJson from "./watch.json";
import changesJson from "./changes.json";

// Shape checks for the posting watcher's config (watch.json) and its log (changes.json).

const watch = watchJson as unknown as Record<string, WatchEntry>;
const changes = changesJson as unknown as Change[];
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["greenhouse", "ashby", "workday", "smartrecruiters", "eightfold", "oracle-hcm", "radancy", "amazon", "apple", "google", "tiktok", "ibm", "manual"];

describe("watch.json", () => {
  it("covers every company", () => expect(Object.keys(watch).sort()).toEqual(Object.keys(hiring).sort()));

  it.each(Object.entries(watch))("%s", (id, w) => {
    expect(KINDS).toContain(w.kind);
    expect(w.board).toMatch(/^https:\/\//);
    expect(w.publisher.length).toBeGreaterThan(0);
    expect(w.verified).toMatch(ISO);
    if (w.kind === "manual") {
      expect(w.reason, `${id}: say why it's manual`).toBeTruthy();
      expect(w.endpoints).toEqual([]);
      return;
    }
    expect(w.endpoints.length, `${id}: an endpoint`).toBeGreaterThan(0);
    w.endpoints.forEach((u) => expect(u).toMatch(/^https:\/\//));
    if (w.kind === "workday") w.endpoints.forEach((u) => expect(u).toMatch(/\/wday\/cxs\/[^/]+\/[^/]+\/jobs$/));
    if (!["greenhouse", "ashby"].includes(w.kind)) expect(w.queries.length, `${id}: search terms`).toBeGreaterThan(0); // full boards need none
    w.queries.forEach((q) => expect(typeof q.q).toBe("string"));
    expect(w.filters.length).toBeGreaterThan(0);
  });
});

describe("changes.json", () => {
  it.each(changes.map((c, i) => [i, c] as const))("entry %i is well-formed", (_, c) => {
    expect(c.date).toMatch(ISO);
    expect(Object.keys(hiring)).toContain(c.company);
    expect(["posted", "removed"]).toContain(c.kind);
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.url).toMatch(/^https:\/\//);
  });

  it("is in date order", () => {
    const dates = changes.map((c) => c.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("only logs postings the site lists", () => {
    for (const c of changes) expect(hiring[c.company].current.postings.map((p) => p.url), `${c.company}: ${c.title}`).toContain(c.url);
  });
});
