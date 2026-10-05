import { describe as group, expect, it } from "vitest";
import type { Company, Hiring } from "@/data/types";
import { companies, hiring, meta } from "@/data";
import { companyUrl, describe, snapshot } from "./share";

const w = (cycle: "2023" | "2024" | "2025" | "2026", from: string, closes?: string) => ({ cycle, from, to: from, evidence: "strong" as const, closes, sources: ["x"] });
const h = (windows: ReturnType<typeof w>[], hasProgram = true): Hiring =>
  ({ hasProgram, pattern: "", windows, current: { checked: "2026-10-04", summary: "", postings: [] } });
const co = { id: "acme", name: "Acme" } as Company;

group("share links", () => {
  it("keeps the /c/<id>/ shape other pages link to", () => {
    expect(companyUrl("google")).toBe("https://marauders-map.natwong.dev/c/google/");
  });
});

group("snapshot", () => {
  it("pins every claim to a date instead of counting days", () => {
    expect(snapshot(h([w("2024", "2024-10-10"), w("2025", "2025-10-12")]), "2026"))
      .toMatchObject({ status: "Not posted as of Oct 4, 2026", usual: "usually opens mid Oct" });
    expect(snapshot(h([w("2025", "2025-10-01"), w("2026", "2026-10-01", "2026-10-20")]), "2026").status).toBe("Opened Oct 1, deadline Oct 20, 2026");
    expect(snapshot(h([w("2025", "2025-08-01"), w("2026", "2026-08-05")]), "2026").status).toBe("Opened Aug 5, 2026, rolling deadline");
    expect(snapshot(h([w("2026", "2026-08-05", "2026-09-01")]), "2026").status).toBe("Closed Sep 1, 2026");
  });
  it("describes a company page without time-relative words", () => {
    expect(describe(co, h([w("2024", "2024-10-10"), w("2025", "2025-10-12")]), "2026"))
      .toBe("Acme MBA internships: usually opens mid Oct; not posted as of Oct 4, 2026. Past cycles, sources and field notes.");
    expect(describe(co, h([], false), "2026")).toBe("Acme had no MBA internship as of Oct 4, 2026. Company facts, sources and field notes.");
  });
  it.each(companies.map((c) => [c.id, c] as const))("%s has a dated description", (_, c) => {
    const d = describe(c, hiring[c.id], meta.currentCycle);
    expect(d).toMatch(/\d{4}/);
    expect(d).not.toMatch(/\b(today|tomorrow|any day|in \d+ days?)\b/);
  });
});
