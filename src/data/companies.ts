// Public metrics: market caps as of 2026-10-02 close (stockanalysis.com), growth = trailing-twelve-month
// revenue YoY unless noted. B2B shares are our estimates from segment reporting — no company discloses them.
// Application windows: dated postings, Wayback snapshots, and recruiter posts (researched 2026-10-03).
// Interview routes and mixes are placeholders until 2Y interns fill in the intake form.

export type Model = "Ads" | "Commerce" | "Enterprise software" | "Hardware and chips" | "AI models";
export type Wave = "early" | "fall" | "winter" | "none";
export type StopType = "behavioral" | "product" | "analytical" | "technical" | "case" | "milestone";

export interface WindowObs {
  cycle: "2023" | "2024" | "2025" | "2026"; // recruiting cycle; "2025" = postings for summer 2026
  from: string; // earliest plausible open date, MM-DD (Jan–Apr dates fall in the following calendar year)
  to?: string; // latest plausible open date, if uncertain
  evidence: "strong" | "medium" | "weak";
  note?: string;
}

export interface Company {
  id: string;
  name: string;
  marketCapB: number;
  capNote?: string;
  growthPct: number;
  growthNote?: string;
  b2bUser: number;
  b2bPayer: number;
  model: Model;
  hq: string;
  rto: string;
  rtoDays: number | null;
  headcount: number;
  ai: "Builds frontier models" | "Builds AI infrastructure" | "Applies AI in products";
  wave: Wave;
  roles: string[];
  pattern: string;
  status: string; // where this cycle stands as of the last update
  windows: WindowObs[];
  route?: { label: string; type: StopType }[];
  mix?: Partial<Record<Exclude<StopType, "milestone">, number>>;
}

export const UPDATED = "Oct 3, 2026";

export const companies: Company[] = [
  {
    id: "apple", name: "Apple", marketCapB: 4870, growthPct: 14.2, b2bUser: 11, b2bPayer: 18,
    model: "Hardware and chips", hq: "Cupertino", rto: "3 days a week", rtoDays: 3, headcount: 166000,
    ai: "Applies AI in products", wave: "early",
    roles: ["MBA Internships (one talent-pool posting across AI/ML EPM, AppleCare, Services, Marketing, Product Operations, Supply Chain, and more)"],
    pattern: "One posting, reviewed on a rolling basis by teams", status: "Open since Aug 5",
    windows: [
      { cycle: "2023", from: "07-28", evidence: "strong" },
      { cycle: "2024", from: "06-07", evidence: "strong" },
      { cycle: "2025", from: "05-29", evidence: "strong" },
      { cycle: "2026", from: "08-05", evidence: "strong" },
    ],
    route: [
      { label: "Apply", type: "milestone" }, { label: "Screen", type: "behavioral" }, { label: "Team round", type: "product" },
      { label: "Team round", type: "analytical" }, { label: "Offer", type: "milestone" },
    ],
    mix: { behavioral: 35, product: 30, analytical: 15, technical: 10, case: 10 },
  },
  {
    id: "amazon", name: "Amazon", marketCapB: 2710, growthPct: 15.8, b2bUser: 20, b2bPayer: 52,
    model: "Commerce", hq: "Seattle", rto: "5 days a week since Jan 2025", rtoDays: 5, headcount: 1576000,
    ai: "Builds AI infrastructure", wave: "early",
    roles: ["Amazon Leadership Accelerator (ALA) Product Manager", "Product Manager Technical (PMT)", "MBA Marketing Manager (MM)", "MBA Leadership Development Program (MLDP)", "Pathways Operations Manager"],
    pattern: "Posted by program, reviewed on a rolling basis; interviews from January", status: "Open since Aug 3–20",
    windows: [
      { cycle: "2023", from: "10-03", to: "10-11", evidence: "medium" },
      { cycle: "2024", from: "09-25", to: "10-02", evidence: "weak", note: "inferred from neighboring job IDs" },
      { cycle: "2025", from: "10-09", to: "10-16", evidence: "medium" },
      { cycle: "2026", from: "08-03", to: "08-20", evidence: "strong", note: "PMT posted Aug 20" },
    ],
    route: [
      { label: "Apply", type: "milestone" }, { label: "Screen", type: "behavioral" }, { label: "Screen", type: "product" },
      { label: "Loop", type: "behavioral" }, { label: "Bar raiser", type: "behavioral" }, { label: "Offer", type: "milestone" },
    ],
    mix: { behavioral: 55, product: 25, analytical: 10, technical: 10 },
  },
  {
    id: "intuit", name: "Intuit", marketCapB: 75.1, growthPct: 13.9, growthNote: "FY ended Jul 2026",
    b2bUser: 63, b2bPayer: 75, model: "Enterprise software", hq: "Mountain View", rto: "Hybrid, 2–3 days set by team",
    rtoDays: 2.5, headcount: 18600, ai: "Applies AI in products", wave: "early",
    roles: ["Product Manager Intern (incl. rotational PM)", "MBA Product Marketing", "MBA Product Strategy & BizOps", "MBA Corp Strategy & Dev", "MBA Pricing & Monetization", "MBA Strategic Finance"],
    pattern: "Rolling, no stated deadlines", status: "Open since Aug 17 (PM since Sep 11)",
    windows: [
      { cycle: "2023", from: "09-26", to: "12-15", evidence: "weak", note: "rotational PM by Sep 26; MBA PM around December" },
      { cycle: "2024", from: "12-20", to: "01-15", evidence: "weak" },
      { cycle: "2025", from: "10-25", to: "11-18", evidence: "strong" },
      { cycle: "2026", from: "08-17", to: "09-11", evidence: "strong" },
    ],
  },
  {
    id: "adobe", name: "Adobe", marketCapB: 92.5, growthPct: 12.0, b2bUser: 75, b2bPayer: 75,
    model: "Enterprise software", hq: "San Jose", rto: "Hybrid, about half the week", rtoDays: 2.5, headcount: 31360,
    ai: "Applies AI in products", wave: "fall",
    roles: ["MBA Intern – Product Manager", "MBA Intern – Product Marketing Manager", "Team roles later: Strategy & Ops, Corp Strategy, Corp Dev, GTM"],
    pattern: "Rolling; team roles keep appearing through Feb", status: "Open since Sep 30",
    windows: [
      { cycle: "2023", from: "09-11", evidence: "strong" },
      { cycle: "2024", from: "09-17", evidence: "strong" },
      { cycle: "2025", from: "09-23", evidence: "strong" },
      { cycle: "2026", from: "09-30", evidence: "strong" },
    ],
  },
  {
    id: "microsoft", name: "Microsoft", marketCapB: 3840, growthPct: 17.8, growthNote: "FY ended Jun 2026",
    b2bUser: 83, b2bPayer: 87, model: "Enterprise software", hq: "Redmond", rto: "3 days a week, phasing in through 2026",
    rtoDays: 3, headcount: 223000, ai: "Builds AI infrastructure", wave: "fall",
    roles: ["Product Manager: MBA Internship", "Technical Program Manager: MBA", "Marketing: MBA", "Business Development Specialist: MBA", "Finance Manager: MBA", "Sales: MBA"],
    pattern: "Mostly rolling; some functions close mid-to-late October", status: "Finance open since Sep 21; PM not yet posted",
    windows: [
      { cycle: "2023", from: "08-01", to: "08-31", evidence: "weak", note: "PM" },
      { cycle: "2024", from: "08-15", to: "09-06", evidence: "medium", note: "HR and marketing postings; PM date unknown" },
      { cycle: "2025", from: "09-15", evidence: "strong", note: "PM; finance and marketing Sep 1" },
      { cycle: "2026", from: "09-21", evidence: "strong", note: "finance and treasury; PM not yet live" },
    ],
    route: [
      { label: "Apply", type: "milestone" }, { label: "Round 1", type: "behavioral" }, { label: "Round 1", type: "product" },
      { label: "Final", type: "product" }, { label: "Final", type: "technical" }, { label: "Offer", type: "milestone" },
    ],
    mix: { behavioral: 30, product: 40, analytical: 15, technical: 10, case: 5 },
  },
  {
    id: "salesforce", name: "Salesforce", marketCapB: 193.2, growthPct: 11.2, b2bUser: 100, b2bPayer: 100,
    model: "Enterprise software", hq: "San Francisco", rto: "3–5 days depending on team", rtoDays: 4, headcount: 83334,
    ai: "Applies AI in products", wave: "fall",
    roles: ["MBA Business Value & Strategic Selling Consultant (plus Financial Services and Healthcare variants)"],
    pattern: "Fixed ~3-week window", status: "Open since Oct 1 — closes Oct 20",
    windows: [
      { cycle: "2023", from: "10-07", evidence: "medium" },
      { cycle: "2024", from: "10-29", evidence: "strong" },
      { cycle: "2025", from: "10-01", to: "10-08", evidence: "medium", note: "closed Oct 22–27" },
      { cycle: "2026", from: "10-01", evidence: "strong", note: "closes Oct 20" },
    ],
  },
  {
    id: "google", name: "Google", marketCapB: 4200, capNote: "Alphabet", growthPct: 20.1, b2bUser: 15, b2bPayer: 88,
    model: "Ads", hq: "Mountain View", rto: "3 days a week", rtoDays: 3, headcount: 190820,
    ai: "Builds frontier models", wave: "fall",
    roles: ["MBA Intern (one posting, team-matched across PM, BizOps / Strategy & Ops, Finance, Sales, People Ops, Program Management)", "Finance MBA Intern"],
    pattern: "Fixed short window (2–5 weeks), then team match", status: "US posting not live yet; usually mid-October",
    windows: [
      { cycle: "2023", from: "10-15", to: "11-01", evidence: "weak" },
      { cycle: "2024", from: "10-16", evidence: "strong", note: "applications through mid-November" },
      { cycle: "2025", from: "10-07", to: "10-14", evidence: "medium", note: "closed Oct 31" },
    ],
    route: [
      { label: "Apply", type: "milestone" }, { label: "Round 1", type: "product" }, { label: "Round 1", type: "analytical" },
      { label: "Final", type: "product" }, { label: "Final", type: "case" }, { label: "Committee", type: "milestone" },
      { label: "Team match", type: "milestone" }, { label: "Offer", type: "milestone" },
    ],
    mix: { behavioral: 15, product: 40, analytical: 25, technical: 10, case: 10 },
  },
  {
    id: "nvidia", name: "Nvidia", marketCapB: 5650, growthPct: 83.4, b2bUser: 94, b2bPayer: 94,
    model: "Hardware and chips", hq: "Santa Clara", rto: "No mandate; teams decide", rtoDays: null, headcount: 42000,
    ai: "Builds AI infrastructure", wave: "fall",
    roles: ["Product Management MBA Intern (by team, e.g. Data Center GPU)", "Product Marketing MBA Intern", "Corp Dev MBA Intern"],
    pattern: "Team by team; postings close quickly", status: "One PM posting went up ~Sep 15, since removed",
    windows: [
      { cycle: "2023", from: "10-20", to: "10-31", evidence: "medium" },
      { cycle: "2024", from: "10-14", evidence: "strong" },
      { cycle: "2025", from: "10-23", evidence: "strong", note: "team roles through Feb" },
      { cycle: "2026", from: "09-15", evidence: "strong" },
    ],
  },
  {
    id: "meta", name: "Meta", marketCapB: 1850, growthPct: 27.7, b2bUser: 1, b2bPayer: 98,
    model: "Ads", hq: "Menlo Park", rto: "3 days a week (Instagram US: 5)", rtoDays: 3, headcount: 78865,
    ai: "Builds frontier models", wave: "winter",
    roles: ["Product Marketing Manager Intern, MBA (no MBA PM internship found)"],
    pattern: "Individual postings; some years skipped", status: "Nothing posted yet",
    windows: [
      { cycle: "2023", from: "12-01", to: "12-15", evidence: "medium" },
      { cycle: "2024", from: "10-31", evidence: "strong", note: "reposted Jan 12, closed Jan 24" },
    ],
    route: [
      { label: "Apply", type: "milestone" }, { label: "Screen", type: "behavioral" }, { label: "Case", type: "case" },
      { label: "Final", type: "case" }, { label: "Final", type: "analytical" }, { label: "Offer", type: "milestone" },
    ],
    mix: { behavioral: 25, product: 20, analytical: 15, case: 40 },
  },
  {
    id: "airbnb", name: "Airbnb", marketCapB: 95.8, growthPct: 13.6, b2bUser: 5, b2bPayer: 10,
    model: "Commerce", hq: "San Francisco", rto: "Work from anywhere", rtoDays: 0, headcount: 8200,
    ai: "Applies AI in products", wave: "winter",
    roles: ["Strategic Finance & Analytics Intern (MBA)", "Business Growth Intern, Experiences (MBA)", "Advanced Analytics Intern (MS/MBA)", "Sourcing Operations & Innovation Intern (MBA)"],
    pattern: "Team by team, each open about 3 weeks", status: "Nothing posted yet",
    windows: [
      { cycle: "2023", from: "12-10", to: "12-20", evidence: "medium" },
      { cycle: "2024", from: "01-26", evidence: "strong" },
      { cycle: "2025", from: "12-19", evidence: "strong" },
    ],
  },
  {
    id: "uber", name: "Uber", marketCapB: 139.1, growthPct: 16.7, b2bUser: 13, b2bPayer: 17,
    model: "Commerce", hq: "San Francisco", rto: "3 days a week", rtoDays: 3, headcount: 34000,
    ai: "Applies AI in products", wave: "winter",
    roles: ["Strategy & Planning MBA Intern", "Team roles: Program Manager, Product Ops, Safety Ops, Sales Ops, Performance Strategy"],
    pattern: "Late and consistent: January", status: "Expected late January",
    windows: [
      { cycle: "2023", from: "01-06", evidence: "strong" },
      { cycle: "2024", from: "01-23", evidence: "strong" },
      { cycle: "2025", from: "01-23", evidence: "strong" },
    ],
  },
  {
    id: "openai", name: "OpenAI", marketCapB: 852, capNote: "Private valuation, Mar 2026", growthPct: 250,
    growthNote: "Annualized revenue, ~9 months — not a true YoY figure", b2bUser: 55, b2bPayer: 55,
    model: "AI models", hq: "San Francisco", rto: "3 days a week", rtoDays: 3, headcount: 4500,
    ai: "Builds frontier models", wave: "none",
    roles: ["No MBA internship program. Its one business internship (GTM Strategy, Apr 2026) wasn't MBA-specific. Anthropic has no internships."],
    pattern: "No structured MBA hiring", status: "No MBA internship", windows: [],
  },
];

export const waveLabel: Record<Wave, string> = {
  early: "Opens by August", fall: "Opens Sep–Oct", winter: "Opens Dec–Jan", none: "No MBA internship",
};
