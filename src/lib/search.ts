import type { Role } from "@/data/types";

// Title search: turns whatever a student pastes from a posting ("Product Manager Intern - MBA (Summer 2027)",
// "PM-T", "S&O") into the role it really is. Pipeline: expand abbreviations → tokenize → light stemming →
// drop noise words and company names → greedy weighted phrase matching per role, plus similarity to every
// title we've seen posted.

const SYMBOL_ABBREV: [RegExp, string][] = [
  [/\bs\s*&\s*o\b/g, " strategy operations "],
  [/\bfp\s*&\s*a\b/g, " financial planning analysis "],
  [/\bm\s*&\s*a\b/g, " mergers acquisitions "],
  [/\bp\.?\s*m\.?\s*-\s*t\b/g, " product manager technical "],
];
const WORD_ABBREV: Record<string, string> = {
  pm: "product manager", pmt: "product manager technical", pmm: "product marketing manager", tpm: "technical program manager",
  apm: "associate product manager", fldp: "finance leadership development program", mldp: "leadership development program", bizops: "business operations", bd: "business development", corpdev: "corporate development",
  corp: "corporate", dev: "development", gtm: "go to market", fpa: "financial planning analysis", ops: "operations",
  mktg: "marketing", mgr: "manager", mgmt: "management", strat: "strategy", tech: "technical", sr: "senior", ae: "account executive",
};
// First matching prefix wins, so longer/more specific prefixes come first.
const STEMS: [string, string][] = [
  ["accounting", "accounting"], ["account", "account"], ["sale", "sell"], ["sell", "sell"], ["manag", "manag"], ["market", "market"],
  ["operat", "operat"], ["strateg", "strateg"], ["develop", "develop"], ["partner", "partner"], ["analy", "analy"], ["program", "program"],
  ["product", "product"], ["techn", "techn"], ["financ", "financ"], ["corporat", "corporat"], ["busines", "busines"], ["consult", "consult"],
  ["planning", "plan"], ["planner", "plan"], ["monetiz", "monetiz"], ["pricing", "pric"], ["acquisit", "acquisit"], ["merger", "merger"],
  ["allianc", "allianc"], ["deal", "deal"], ["solution", "solution"], ["customer", "customer"], ["success", "success"], ["valu", "valu"],
  ["positio", "positio"], ["communicat", "communicat"], ["leader", "leader"], ["design", "design"], ["engineer", "engineer"],
  ["invest", "invest"], ["venture", "venture"], ["licens", "licens"], ["treasur", "treasur"], ["intern", "intern"], ["role", "role"],
];
const STOP = new Set(["intern", "mba", "mbas", "summer", "the", "of", "and", "a", "an", "for", "in", "to", "at", "on", "us", "usa", "team",
  "role", "level", "i", "ii", "new", "remote", "hybrid", "full", "time", "fulltime", "ms", "phd", "student", "students", "position", "job", "with"]);

const stem = (t: string) => STEMS.find(([p]) => t.startsWith(p))?.[1] ?? t;

/** Lowercase, expand abbreviations, tokenize, stem. Words in `keep` (company names) pass through untouched. Keeps stop words. */
export function tokenize(s: string, keep: ReadonlySet<string> = new Set()): string[] {
  let x = ` ${s.toLowerCase()} `;
  for (const [re, rep] of SYMBOL_ABBREV) x = x.replace(re, rep);
  x = x.replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ");
  return x.trim().split(/\s+/).filter(Boolean).flatMap((t) => (keep.has(t) ? [t] : (WORD_ABBREV[t] ?? t).split(" ").map(stem)));
}
/** A company's lookup word: the first word of its name, unstemmed ("Salesforce" must not become "sell"). */
const companyWord = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ")[0];
const content = (tokens: string[]) => tokens.filter((t) => !STOP.has(t) && !/^\d+$/.test(t));

export interface Match {
  role: Role;
  score: number;
  phrases: string[]; // keyword phrases that matched, as written in roles.json
  closest: { company: string; title: string; similarity: number } | null;
}
export interface SearchResult {
  query: string;
  companies: string[]; // company names mentioned in the query
  matches: Match[]; // best first; empty if nothing matched
  confidence: "strong" | "likely" | "ambiguous" | "none";
}

export function createSearch(roles: Role[], companyNames: string[]) {
  const companyTokens = new Map(companyNames.map((n) => [companyWord(n), n]));
  const keep = new Set(companyTokens.keys());
  const phrases = roles
    .flatMap((role) => role.keywords.map(([phrase, weight]) => ({ role, phrase, weight, tokens: content(tokenize(phrase)) })))
    .filter((p) => p.tokens.length)
    .sort((a, b) => b.tokens.length - a.tokens.length || b.weight - a.weight);
  const titles = roles.flatMap((role) =>
    role.titles.map((t) => ({ role, ...t, tokens: new Set(content(tokenize(t.title, keep)).filter((x) => !companyTokens.has(x))) })),
  );
  const vocab = [...new Set([...phrases.flatMap((p) => p.tokens), ...titles.flatMap((t) => [...t.tokens])])].sort((a, b) => a.length - b.length);

  return function search(query: string): SearchResult | null {
    const raw = tokenize(query, keep);
    if (!raw.length) return null;
    // Let the word being typed match as a prefix ("prod" → product) once it has 3+ letters.
    if (!/\s$/.test(query) && raw.length) {
      const last = raw[raw.length - 1];
      if (last.length >= 3 && !vocab.includes(last)) raw[raw.length - 1] = vocab.find((v) => v.startsWith(last)) ?? last;
    }
    const mentioned = raw.filter((t) => companyTokens.has(t)).map((t) => companyTokens.get(t)!);
    const tokens = content(raw).filter((t) => !companyTokens.has(t));
    if (!tokens.length && !mentioned.length) return null; // only noise words ("MBA intern") so far

    const byRole = new Map<string, Match>(roles.map((role) => [role.id, { role, score: 0, phrases: [], closest: null }]));
    const used = tokens.map(() => false);
    for (const p of phrases) {
      for (let i = 0; i + p.tokens.length <= tokens.length; i++) {
        if (p.tokens.every((t, j) => !used[i + j] && tokens[i + j] === t)) {
          p.tokens.forEach((_, j) => (used[i + j] = true));
          const m = byRole.get(p.role.id)!;
          m.score += p.weight;
          if (p.weight > 0) m.phrases.push(p.phrase); // weight-0 phrases just absorb words like "mid market"
          break;
        }
      }
    }
    const q = new Set(tokens);
    for (const t of titles) {
      if (mentioned.length && !mentioned.includes(t.company)) continue;
      const inter = [...q].filter((x) => t.tokens.has(x)).length;
      const union = new Set([...q, ...t.tokens]).size;
      const similarity = union ? inter / union : 0;
      const m = byRole.get(t.role.id)!;
      if (similarity > (m.closest?.similarity ?? 0)) m.closest = { company: t.company, title: t.title, similarity };
    }
    for (const m of byRole.values()) if ((m.closest?.similarity ?? 0) >= 0.6) m.score += 2;

    let matches = [...byRole.values()].filter((m) => m.score > 0).sort((a, b) => b.score - a.score);
    // A bare company name ("Amazon") lists the roles that company posts.
    if (!tokens.length && mentioned.length) {
      matches = roles
        .filter((r) => r.titles.some((t) => mentioned.includes(t.company)))
        .map((role) => ({ role, score: 1, phrases: [], closest: null }));
      return { query, companies: mentioned, matches, confidence: matches.length ? "strong" : "none" };
    }
    const [a, b] = matches;
    const confidence = !a ? "none" : b && b.score >= a.score - 1 ? "ambiguous" : a.score >= 3 || (a.closest?.similarity ?? 0) >= 0.75 ? "strong" : "likely";
    return { query, companies: mentioned, matches, confidence };
  };
}

/** Whether a posted title should be highlighted for this result. */
export function titleHits(result: SearchResult, roleId: string, title: { company: string; title: string }) {
  const m = result.matches.find((x) => x.role.id === roleId);
  if (!m) return false;
  if (result.companies.length && !result.companies.includes(title.company)) return false;
  if (!m.phrases.length && !m.closest) return result.companies.includes(title.company);
  return m.closest?.title === title.title || m.phrases.some((p) => content(tokenize(title.title)).join(" ").includes(content(tokenize(p)).join(" ")));
}
