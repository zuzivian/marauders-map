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
  office: OfficePolicy;
  intern?: Intern; // what the MBA intern postings themselves say; every part is optional
}

/** Pay exactly as the postings state it. The page converts it to a month (40-hour weeks) so companies compare. */
export interface InternPay {
  low: number; // USD
  high: number; // equal to `low` when the postings give a single rate
  per: "hour" | "month" | "year";
  where: string; // the location the range applies to, in the postings' words
  cycle: Cycle;
  postings: number; // how many MBA postings the range spans
  note?: string;
  sources: string[];
}

export interface Intern {
  pay?: InternPay;
  locations?: { places: string[]; cycle: Cycle; sources: string[] };
  /** Only when a posting says it outright; the first source carries the posting's words as its quote. */
  sponsorship?: { stance: "sponsors" | "no sponsorship" | "authorization required"; scope: string; cycle: Cycle; sources: string[] };
  /** hired to a team = you apply to one team's posting; matched after offer = the team is chosen once you have an offer;
   *  pooled, then placed = you join a program or pool and the company assigns the team. */
  teamModel?: { model: "hired to a team" | "matched after offer" | "pooled, then placed"; note?: string; sources: string[] };
  /** Layoffs or hiring freezes in the 12 months before the last check; `low`/`high` = roles affected, when reported. */
  pulse?: { date: ISODate; what: string; low?: number; high?: number; sources: string[] }[];
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
  current: { checked: ISODate; summary: string; postings: Posting[]; sources?: string[] }; // sources: what backs the summary (live job board, careers page)
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
  key?: string; // short label when this is one of the handful of dates shown on the GSB strip
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

export type FirsthandPath = "oci" | "referral" | "direct application" | "company event" | "club or trek" | "other";
export type TeamMatch = "hired to a team" | "matched after offer" | "unsure";

/** A GSB second-year's own account of getting an internship. Self-reported and unverified; added by scripts/add-firsthand.mjs. */
export interface FirsthandReport {
  received: ISODate;
  classOf: number; // e.g. 2027
  internshipSummer: number; // e.g. 2026, the summer of the internship (cycle 2025)
  roleId: string; // id in roles.json
  path: FirsthandPath;
  firstContactToOffer?: number; // weeks
  stages: string[]; // short, in order
  teamMatch: TeamMatch;
  whatMattered: string; // ≤ 280 chars
  advice: string; // ≤ 280 chars
  displayName?: string; // omitted = anonymous ("a GSB '27")
  consent: true;
}

export interface Meta {
  currentCycle: Cycle;
  researched: ISODate; // the date the data was last checked end to end
  /** Where the corrections form posts; null hides the form. Field names map our fields onto the backend's. */
  corrections: {
    kind: "formspree" | "google" | "formsubmit";
    action: string;
    fields: { about: string; correction: string; source: string; email: string };
  } | null;
  /** Where the first-hand notes form posts (Formspree only for now); null hides the form. Same field mapping idea as corrections. */
  firsthand?: {
    kind: "formspree";
    action: string;
    fields: Record<"company" | "roleId" | "classOf" | "internshipSummer" | "path" | "firstContactToOffer" | "stages" | "teamMatch" | "whatMattered" | "advice" | "displayName" | "consent" | "email", string>;
  } | null;
  /** Opt-in, cookie-free counts (see src/lib/analytics.ts); null loads nothing. `code` is the GoatCounter site code. */
  analytics: { kind: "goatcounter"; code: string } | null;
}

/**
 * How scripts/watch-postings.mjs queries one company's careers site for MBA intern postings (src/data/watch.json).
 * `manual` means no reliable machine-readable endpoint exists; `reason` says why, and a person checks by hand.
 */
export type WatchKind =
  | "greenhouse" | "ashby" | "workday" | "smartrecruiters" | "eightfold" | "oracle-hcm" | "radancy"
  | "amazon" | "apple" | "google" | "tiktok" | "ibm" | "manual";

export interface WatchQuery {
  q: string; // search terms
  params?: Record<string, string>; // extra query-string or body filters for this search only
}

export interface WatchEntry {
  kind: WatchKind;
  endpoints: string[]; // the API URLs queried (empty for manual)
  queries: WatchQuery[];
  params?: Record<string, string>; // filters sent with every query (country, job level, sort)
  filters: string; // plain-English summary of what's filtered server-side; US / intern / MBA / cycle are also checked client-side
  board: string; // the careers page a person would use
  publisher: string; // `publisher` for the sources.json entries this company's postings get
  verified: ISODate; // last date the endpoint was confirmed with a real request
  reason?: string; // manual only: why it isn't automatic
  note?: string;
}

/** One line of src/data/changes.json, the watcher's machine-readable log of postings appearing and disappearing. */
export interface Change {
  date: ISODate;
  company: string; // company id
  kind: "posted" | "removed";
  title: string;
  url: string;
}
