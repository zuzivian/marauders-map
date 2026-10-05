// Shapes of the JSON files in this folder. Every factual claim points at one or more ids in sources.json;
// src/data/data.test.ts enforces that and the rest of the invariants, so `npm test` fails on broken data.

export type ISODate = string; // YYYY-MM-DD
export type Cycle = "2023" | "2024" | "2025" | "2026"; // "2025" = postings in fall 2025 for summer 2026 internships
export type Evidence = "strong" | "medium" | "weak";
export type Confidence = "high" | "medium" | "low";

export interface Source {
  url: string;
  title: string;
  publisher: string;
  published: ISODate | null;
  accessed: ISODate;
  kind: "primary" | "archive" | "secondary" | "forum";
  quote: string | null; // verbatim, under 15 words; verified by scripts/check-sources.mjs
  quoteCheck?: string; // set when a quote was verified by hand in a browser, e.g. "browser 2026-10-04"
  gone?: string; // date the link was found dead (usually an expired job posting); it was live when researched
}

/** A number with honest uncertainty. `low`/`high` bound the plausible range when the value is an estimate. */
export interface Metric {
  value: number;
  low?: number;
  high?: number;
  asOf?: ISODate;
  note?: string;
  sources: string[];
}

export type Model = "Ads" | "Commerce" | "Enterprise software" | "Hardware and chips" | "AI models" | "Payments" | "Media and entertainment";
export type AIPosture = "Builds frontier models" | "Builds AI infrastructure" | "Applies AI in products";

export interface OfficePolicy {
  /** fixed = company-wide minimum; team = band set by team; flexible = office-based, no minimum; remote = remote-first */
  category: "fixed" | "team" | "flexible" | "remote";
  days: number | null;
  low?: number;
  high?: number;
  summary: string;
  effective?: string | null;
  interns?: string | null;
  confidence: Confidence;
  sources: string[];
}

export interface Company {
  id: string;
  name: string;
  ticker: string | null;
  cik?: string; // SEC id, used by scripts/refresh-sec.mjs
  hq: string;
  model: Model;
  ai: AIPosture;
  marketCap: Metric & { kind: "market cap" | "private valuation" }; // $B
  growth: Metric & { basis: string }; // % revenue growth
  headcount: Metric;
  b2bPayer: Metric & { reasoning: string }; // % of revenue paid by businesses
  b2bUser: Metric & { reasoning: string }; // % of revenue from products mainly used by businesses
  office: OfficePolicy;
}

export interface WindowObs {
  cycle: Cycle;
  from: ISODate; // earliest plausible date postings went live
  to: ISODate; // latest plausible date (equal to `from` when exact)
  closes?: ISODate | null;
  evidence: Evidence;
  scope?: string | null; // which roles the evidence covers
  note?: string | null;
  sources: string[];
}

export interface Posting {
  title: string;
  posted: ISODate | null;
  closes: ISODate | null;
  url: string;
  sources: string[];
}

export interface Hiring {
  hasProgram: boolean;
  pattern: string; // how postings behave, in plain English
  windows: WindowObs[];
  current: { checked: ISODate; summary: string; postings: Posting[] };
  note?: string | null;
}

export type StageType = "behavioral" | "product" | "analytical" | "technical" | "case" | "milestone";

export interface Interview {
  confidence: Confidence;
  roleScope: string; // short: which roles/stage of the process this describes
  stages: { label: string; types: StageType[]; detail: string | null; sources: string[] }[];
  distinctive: string | null;
  caveat: string | null;
  sources: string[];
}

export interface Role {
  id: string;
  name: string;
  short: string; // column label, e.g. "PMM"
  epithet: string;
  definition: string;
  technical: "low" | "some" | "high"; // editorial judgment
  leadsTo: string;
  prepKey: string | null; // key into prep.json roles, when the prep section covers this role
  /** Phrases that point at this role in a posted title, with weights. Used by the title search. */
  keywords: [phrase: string, weight: number][];
  titles: { company: string; title: string; cycles: Cycle[]; sources: string[] }[];
}

export interface CalendarMarker {
  id: string;
  label: string;
  from: ISODate;
  to: ISODate | null;
  kind: "blackout" | "quiet" | "events" | "interviews" | "deadline" | "academic"; // blackout = no recruiting at all; quiet = some activity barred
  description: string;
  confidence: Confidence;
  timeline?: boolean; // drawn on the application-windows chart (the rest are listed below it)
  sources: string[];
}

export interface PrepCell {
  score: 0 | 1 | 2 | 3;
  items: string[];
  url: string | null;
  note?: string | null;
}

export interface Prep {
  checked: ISODate;
  roles: string[];
  skills: string[];
  columns: string[]; // prep providers, e.g. "Aced (Exponent)"
  matrix: Record<string, Record<string, Record<string, PrepCell>>>;
  notes: { text: string; sources: string[]; highlight?: boolean }[]; // highlighted notes show above the table
}

export interface Meta {
  currentCycle: Cycle;
  researched: ISODate; // the date the data was last checked end to end
  correctionsEndpoint: string | null; // FormSubmit form action; null hides the corrections form
}
