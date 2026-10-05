import { describe, expect, it } from "vitest";
import { calendar, companies, hiring, meta } from "@/data";
import { allFeed, companyEvents, companyFeed, companyGuideUrl, feedIds, gsbEvents, inOpeningOrder, myListFeed, toCsv, toTsv, trackerRows, webcalUrl } from "./export";
import { statusOf } from "./status";

const cycle = meta.currentCycle;
const unfold = (s: string) => s.replace(/\r\n /g, "");
const uids = (ics: string) => unfold(ics).split("\r\n").filter((l) => l.startsWith("UID:"));

describe("tracker export", () => {
  it("quotes CSV fields per RFC 4180, with CRLF rows", () => {
    expect(toCsv([["a", "b,c", 'say "hi"', "two\nlines"], ["1", "", "x", "y"]])).toBe('a,"b,c","say ""hi""","two\nlines"\r\n1,,x,y\r\n');
  });

  it("keeps cells from running as spreadsheet formulas", () => {
    expect(toCsv([["=1+1", "-x", "@a", "+b", "ok"]])).toBe("'=1+1,'-x,'@a,'+b,ok\r\n");
    expect(toTsv([["=HYPERLINK(1)"]])).toBe("'=HYPERLINK(1)");
  });

  it("writes tab-separated rows with no stray tabs or line breaks inside a cell", () => {
    expect(toTsv([["a\tb", "c\nd"], ["e", "f"]])).toBe("a b\tc d\ne\tf");
  });

  it("has one row per company with the site's own status wording and a guide link", () => {
    const ids = companies.map((c) => c.id);
    const [head, ...rows] = trackerRows(ids, "2026-10-04");
    expect(head).toHaveLength(8);
    expect(head[1]).toBe("Status (as of Oct 4, 2026)");
    expect(rows).toHaveLength(companies.length);
    rows.forEach((r, i) => {
      expect(r).toHaveLength(head.length);
      expect(r[1]).toBe(statusOf(hiring[ids[i]], "2026-10-04", cycle).headline);
      expect(r[7]).toBe(companyGuideUrl(ids[i]));
    });
  });

  it("orders companies by when they usually open, and drops unknown ids", () => {
    const order = inOpeningOrder(["uber", "apple", "nope"]);
    expect(order).toEqual(["apple", "uber"]);
  });
});

describe("calendar feeds", () => {
  it("cover every company with an MBA program, and none without", () => {
    expect(feedIds.length).toBe(companies.filter((c) => hiring[c.id].hasProgram).length);
    expect(feedIds).not.toContain("all"); // would collide with /cal/all.ics
    companies.filter((c) => !hiring[c.id].hasProgram).forEach((c) => expect(companyEvents(c.id)).toEqual([]));
  });

  it("label estimates as estimates, and only for companies that haven't posted", () => {
    for (const id of feedIds) {
      const posted = hiring[id].windows.some((w) => w.cycle === cycle);
      const est = companyEvents(id).filter((e) => e.uid.includes("-expected@"));
      expect(est.length, id).toBe(posted ? 0 : 1);
      for (const e of est) {
        expect(e.summary).toMatch(/\(estimate\)$/);
        expect(e.description).toMatch(/not a posted date/);
      }
    }
  });

  it("include every stated deadline this cycle", () => {
    for (const id of feedIds) {
      const h = hiring[id], now = h.windows.find((w) => w.cycle === cycle);
      if (!now) continue;
      const closes = new Set([now.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean));
      const events = companyEvents(id).filter((e) => e.uid.includes("-closes-"));
      expect(new Set(events.map((e) => e.date)), id).toEqual(closes);
    }
  });

  it("put the GSB calendar in all.ics only", () => {
    const gsb = gsbEvents();
    expect(gsb.length).toBe(calendar.filter((m) => m.kind !== "academic").length);
    const all = allFeed();
    gsb.forEach((e) => expect(all).toContain(`UID:${e.uid}`));
    feedIds.forEach((id) => expect(companyFeed(id)).not.toMatch(/-gsb-/));
  });

  it("use unique, date-free UIDs for openings and estimates, so updates replace events", () => {
    const all = uids(allFeed());
    expect(new Set(all).size).toBe(all.length);
    all.filter((u) => /-(opened|expected)@/.test(u)).forEach((u) => expect(u).not.toMatch(/\d{8}/));
  });

  it("are reproducible build to build", () => expect(allFeed()).toBe(allFeed()));

  it("builds a one-time file for a reader's list from the same events", () => {
    const mine = myListFeed(["apple", "uber", "openai"]);
    expect(uids(mine).sort()).toEqual([...companyEvents("apple"), ...companyEvents("uber")].map((e) => `UID:${e.uid}`).sort());
  });

  it("links to subscribe with webcal://", () => expect(webcalUrl("/cal/all.ics")).toBe("webcal://marauders-map.natwong.dev/cal/all.ics"));
});
