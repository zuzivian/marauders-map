import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine, icsDate } from "./ics";

const bytes = (s: string) => new TextEncoder().encode(s).length;
const unfold = (s: string) => s.replace(/\r\n /g, "");

describe("ics text", () => {
  it("escapes backslashes, semicolons, commas and newlines (RFC 5545 §3.3.11)", () => {
    expect(escapeText("a\\b; c, d\ne\r\nf")).toBe("a\\\\b\\; c\\, d\\ne\\nf");
  });

  it("folds long lines at 75 octets with a leading space, and unfolds to the original", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = foldLine(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(2);
    parts.forEach((p, i) => {
      expect(bytes(p)).toBeLessThanOrEqual(75);
      if (i > 0) expect(p[0]).toBe(" ");
    });
    expect(unfold(folded)).toBe(line);
  });

  it("counts octets, not characters, and never splits a multi-byte character", () => {
    const line = `SUMMARY:${"–·é".repeat(40)}`;
    const parts = foldLine(line).split("\r\n");
    parts.forEach((p) => {
      expect(bytes(p)).toBeLessThanOrEqual(75);
      expect(p).not.toMatch(/�/);
    });
    expect(unfold(parts.join("\r\n"))).toBe(line);
  });

  it("leaves short lines alone", () => expect(foldLine("VERSION:2.0")).toBe("VERSION:2.0"));
});

describe("ics calendar", () => {
  const ics = buildIcs({
    name: "Test, calendar",
    description: "About it",
    stamp: "2026-10-04",
    events: [
      { uid: "one@example.com", date: "2026-10-20", summary: "Closes; today", description: "Line one\nLine two", url: "https://example.com/a,b" },
      { uid: "two@example.com", date: "2026-11-30", end: "2026-12-31", summary: "A long one" },
    ],
  });
  const lines = unfold(ics).split("\r\n");

  it("uses CRLF everywhere and ends with one", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
  });

  it("has the required calendar and event properties", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines.some((l) => l.startsWith("PRODID:"))).toBe(true);
    expect(lines).toContain("X-WR-CALNAME:Test\\, calendar");
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((l) => l === "DTSTAMP:20261004T000000Z")).toHaveLength(2);
  });

  it("writes all-day events as DATE values with an exclusive end", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20261020");
    expect(lines).toContain("DTEND;VALUE=DATE:20261021");
    expect(lines).toContain("DTSTART;VALUE=DATE:20261130");
    expect(lines).toContain("DTEND;VALUE=DATE:20270101"); // inclusive Dec 31 → exclusive Jan 1
  });

  it("escapes text values but not URIs", () => {
    expect(lines).toContain("SUMMARY:Closes\\; today");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
    expect(lines).toContain("URL:https://example.com/a,b");
  });

  it("formats dates", () => expect(icsDate("2027-01-04")).toBe("20270104"));
});
