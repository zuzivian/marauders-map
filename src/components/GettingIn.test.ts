import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { FirsthandReport } from "@/data/types";

// Test fixtures only; nothing here is a real report. firsthand.json is swapped for these per test.
const r = (over: Partial<FirsthandReport>): FirsthandReport => ({
  received: "2026-10-10", classOf: 2027, internshipSummer: 2026, roleId: "pm", path: "referral", stages: ["Screen", "Loop"],
  teamMatch: "unsure", whatMattered: "FIXTURE-MATTERED", advice: "FIXTURE-ADVICE", consent: true, ...over,
});
const fixtures: Record<string, FirsthandReport[]> = {};
vi.mock("@/data", async (orig) => ({ ...(await orig<typeof import("@/data")>()), firsthand: fixtures }));

const render = async (id: string) => {
  const { companyById } = await import("@/data");
  const { GuideProvider } = await import("./Guide");
  const GettingIn = (await import("./GettingIn")).default;
  return renderToStaticMarkup(createElement(GuideProvider, null, createElement(GettingIn, { company: companyById[id] })));
};

describe("getting in block", () => {
  it("invites a first note when there are none", async () => {
    const html = await render("google");
    expect(html).toContain("No first-hand notes yet.");
    expect(html).toContain("rule of thumb:");
  });

  it("shows only the aggregate for a single report", async () => {
    fixtures.google = [r({ advice: "FIXTURE-SOLO" })];
    const html = await render("google");
    expect(html).toContain("first-hand · n=1 · not verified by the company");
    expect(html).not.toContain("FIXTURE-SOLO");
  });

  it("shows advice once a company and summer has two reports", async () => {
    fixtures.google = [r({ advice: "FIXTURE-A" }), r({ advice: "FIXTURE-B", displayName: "Fixture Name" }), r({ advice: "FIXTURE-OLD", internshipSummer: 2025 })];
    const html = await render("google");
    expect(html).toContain("n=3");
    expect(html).toContain("FIXTURE-A");
    expect(html).toContain("Fixture Name");
    expect(html).toContain("a GSB &#x27;27");
    expect(html).not.toContain("FIXTURE-OLD"); // its summer has only one report
  });

  it("skips the plan for companies with no program", async () => {
    expect(await render("openai")).not.toContain("gi-plan");
  });
});
