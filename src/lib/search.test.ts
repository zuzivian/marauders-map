import { describe, expect, it } from "vitest";
import { companies, roles } from "@/data";
import { createSearch, tokenize } from "./search";

const search = createSearch(roles, companies.map((c) => c.name));
const top = (q: string) => search(q)?.matches[0]?.role.id ?? null;

describe("tokenize", () => {
  it("expands abbreviations and symbols", () => {
    expect(tokenize("PM-T")).toEqual(["product", "manag", "techn"]);
    expect(tokenize("S&O")).toEqual(["strateg", "operat"]);
    expect(tokenize("Corp Dev")).toEqual(["corporat", "develop"]);
  });
});

describe("title search", () => {
  // Real titles as pasted from postings, including the ones the old substring search missed.
  it.each([
    ["Product Manager Intern - MBA (Summer 2027)", "pm"],
    ["Associate Product Manager", "pm"],
    ["PM-T", "pm"],
    ["Product Manager Technical (PMT) Intern", "pm"],
    ["Technical Program Manager: MBA", "pm"],
    ["Product Marketing Manager Intern, MBA", "pmm"],
    ["MBA Marketing Manager (MM) Internship", "pmm"],
    ["Business Operations", "ops"],
    ["Strategy & Operations", "ops"],
    ["S&O", "ops"],
    ["MBA Product Strategy & BizOps Intern", "ops"],
    ["Strategy & Planning MBA Intern", "ops"],
    ["Sales Ops", "ops"],
    ["Strategic Finance & Analytics Intern (MBA)", "finance"],
    ["Finance Manager: MBA", "finance"],
    ["MBA Business Value & Strategic Selling Consultant", "sales"],
    ["Corp Dev", "bd"],
    ["Partnerships Manager", "bd"],
    ["Business Development Specialist: MBA", "bd"],
  ])("%s → %s", (q, role) => expect(top(q)).toBe(role));

  it("matches the word being typed as a prefix", () => {
    expect(top("partn")).toBe("bd");
    expect(top("marke")).toBe("pmm");
  });

  it("lists a company's roles for a bare company name", () => {
    const r = search("Amazon")!;
    expect(r.companies).toEqual(["Amazon"]);
    expect(r.matches.length).toBeGreaterThan(1);
  });

  it("ignores noise words instead of matching everything", () => {
    expect(search("MBA intern")).toBeNull();
    expect(search("a")).toBeNull();
    expect(search("   ")).toBeNull();
  });

  it("says when it doesn't know", () => {
    expect(search("Underwater basket weaving")?.confidence).toBe("none");
  });
});
