import type { FirsthandPath, FirsthandReport, TeamMatch } from "@/data/types";

// First-hand notes from GSB second-years: the rules every report must meet, and how a company's reports are summed up.
// scripts/add-firsthand.mjs keeps its own copy of these constants (it runs in plain Node); firsthand.test.ts checks they match.

export const PATHS: FirsthandPath[] = ["oci", "referral", "direct application", "company event", "club or trek", "other"];
export const TEAM_MATCH: TeamMatch[] = ["hired to a team", "matched after offer", "unsure"];
export const LIMITS = { text: 280, stage: 60, stages: 12, displayName: 40, weeks: 52 };
/** Per-report details (advice, what mattered) show only once a company + summer has this many reports. */
export const MIN_FOR_DETAILS = 2;

export const PATH_LABEL: Record<FirsthandPath, string> = {
  oci: "OCI", referral: "referral", "direct application": "direct application", "company event": "company event", "club or trek": "club or trek", other: "other",
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isYear = (n: unknown) => Number.isInteger(n) && (n as number) >= 2000 && (n as number) <= 2100;

/** Everything wrong with a report, as short messages. Empty means it's publishable. */
export function problems(r: FirsthandReport, known: { roles: string[] }): string[] {
  const out: string[] = [];
  if (r.consent !== true) out.push("no consent to publish");
  if (!ISO.test(r.received) || Number.isNaN(Date.parse(r.received))) out.push(`received is not an ISO date: ${r.received}`);
  if (!isYear(r.classOf)) out.push(`classOf is not a year: ${r.classOf}`);
  if (!isYear(r.internshipSummer)) out.push(`internshipSummer is not a year: ${r.internshipSummer}`);
  if (!known.roles.includes(r.roleId)) out.push(`unknown role: ${r.roleId}`);
  if (!PATHS.includes(r.path)) out.push(`unknown path: ${r.path}`);
  if (!TEAM_MATCH.includes(r.teamMatch)) out.push(`unknown teamMatch: ${r.teamMatch}`);
  if (r.firstContactToOffer !== undefined && !(typeof r.firstContactToOffer === "number" && r.firstContactToOffer >= 0 && r.firstContactToOffer <= LIMITS.weeks))
    out.push(`firstContactToOffer out of range: ${r.firstContactToOffer}`);
  if (!Array.isArray(r.stages) || r.stages.length > LIMITS.stages) out.push(`stages: at most ${LIMITS.stages}`);
  else r.stages.forEach((s) => { if (!s.trim() || s.length > LIMITS.stage) out.push(`stage too long or empty: ${s}`); });
  for (const k of ["whatMattered", "advice"] as const)
    if (typeof r[k] !== "string" || !r[k].trim() || r[k].length > LIMITS.text) out.push(`${k} must be 1–${LIMITS.text} characters`);
  if (r.displayName !== undefined && (!r.displayName.trim() || r.displayName.length > LIMITS.displayName)) out.push("displayName empty or too long");
  return out;
}

/** "a GSB '27", or the name the contributor chose to show. */
export const byline = (r: FirsthandReport) => r.displayName ?? `a GSB '${String(r.classOf).slice(-2)}`;

export interface Aggregate {
  n: number;
  paths: [FirsthandPath, number][]; // most common first
  stages: string[]; // stages at least half the reports mention, in their usual order
  weeks: number | null; // median weeks from first contact to offer, when at least two reports give one
  summers: { summer: number; reports: FirsthandReport[] }[]; // only summers with enough reports to show details, newest first
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function aggregate(reports: FirsthandReport[]): Aggregate | null {
  if (!reports.length) return null;
  const n = reports.length;
  const tally = new Map<FirsthandPath, number>();
  reports.forEach((r) => tally.set(r.path, (tally.get(r.path) ?? 0) + 1));
  const paths = [...tally].sort((a, b) => b[1] - a[1] || PATHS.indexOf(a[0]) - PATHS.indexOf(b[0]));

  // Stages match case-insensitively; a stage counts once per report, ordered by where it usually falls.
  const seen = new Map<string, { label: string; count: number; pos: number }>();
  for (const r of reports) {
    const counted = new Set<string>();
    r.stages.forEach((s, i) => {
      const k = s.trim().toLowerCase();
      if (counted.has(k)) return;
      counted.add(k);
      const e = seen.get(k) ?? { label: s.trim(), count: 0, pos: 0 };
      seen.set(k, { ...e, count: e.count + 1, pos: e.pos + i / Math.max(1, r.stages.length - 1) }); // pos: 0 = first stage, 1 = last
    });
  }
  const stages = [...seen.values()].filter((e) => e.count >= n / 2).sort((a, b) => a.pos / a.count - b.pos / b.count).map((e) => e.label);

  const ws = reports.map((r) => r.firstContactToOffer).filter((x): x is number => typeof x === "number");
  const bySummer = new Map<number, FirsthandReport[]>();
  reports.forEach((r) => bySummer.set(r.internshipSummer, [...(bySummer.get(r.internshipSummer) ?? []), r]));
  const summers = [...bySummer].filter(([, rs]) => rs.length >= MIN_FOR_DETAILS).sort((a, b) => b[0] - a[0]).map(([summer, rs]) => ({ summer, reports: rs }));

  return { n, paths, stages, weeks: ws.length >= 2 ? median(ws) : null, summers };
}
