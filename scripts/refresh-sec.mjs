#!/usr/bin/env node
// Recompute trailing-twelve-month revenue growth for every public company in src/data/companies.json
// straight from SEC XBRL company facts, so growth figures aren't hand-typed.
//
//   SEC_USER_AGENT="Your Name you@example.com" node scripts/refresh-sec.mjs          # dry run: prints a comparison
//   SEC_USER_AGENT="Your Name you@example.com" node scripts/refresh-sec.mjs --write  # updates companies.json
//
// SEC requires a User-Agent with contact details: https://www.sec.gov/os/accessing-edgar-data
// Review the diff before committing; `npm test` re-validates the data afterwards.

import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../src/data/companies.json", import.meta.url);
const CONCEPTS = ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues"];
const UA = process.env.SEC_USER_AGENT;
const WRITE = process.argv.includes("--write");
const DAY = 86_400_000;

if (!UA || !/@/.test(UA)) {
  console.error('Set SEC_USER_AGENT to "Name email@domain" (SEC policy requires contact details).');
  process.exit(1);
}

const days = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);

/** Quarterly revenue series keyed by period end, deriving fiscal Q4 as (annual − first three quarters). */
function quarters(facts) {
  const byEnd = new Map();
  const annual = [];
  for (const concept of CONCEPTS) {
    for (const f of facts["us-gaap"]?.[concept]?.units?.USD ?? []) {
      if (!/^10-[KQ]/.test(f.form) || !f.start) continue;
      const len = days(f.start, f.end);
      if (len >= 80 && len <= 100) {
        const prev = byEnd.get(f.end);
        // Prefer the most recently filed value for a period (restatements), across both concepts.
        if (!prev || f.filed > prev.filed) byEnd.set(f.end, { start: f.start, end: f.end, val: f.val, filed: f.filed, concept });
      } else if (len >= 350 && len <= 380) annual.push({ ...f, concept });
    }
  }
  for (const y of annual) {
    if (byEnd.has(y.end)) continue;
    const inside = [...byEnd.values()].filter((q) => q.start >= y.start && q.end < y.end);
    if (inside.length === 3) byEnd.set(y.end, { start: inside.sort((a, b) => a.end.localeCompare(b.end))[2].end, end: y.end, val: y.val - inside.reduce((s, q) => s + q.val, 0), filed: y.filed, concept: y.concept, derived: true });
  }
  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
}

function ttm(qs, endIdx) {
  const four = qs.slice(endIdx - 3, endIdx + 1);
  if (four.length !== 4) return null;
  // The four quarters must be contiguous (no gaps from missing filings).
  for (let i = 1; i < 4; i++) if (Math.abs(days(four[i - 1].end, four[i].end) - 91) > 12) return null;
  return { end: four[3].end, sum: four.reduce((s, q) => s + q.val, 0), concepts: [...new Set(four.map((q) => q.concept))] };
}

async function getFacts(cik) {
  const res = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, { headers: { "User-Agent": UA, Accept: "application/json" } });
  if (!res.ok) throw new Error(`SEC ${res.status} for CIK ${cik}`);
  return (await res.json()).facts;
}

const companies = JSON.parse(await readFile(FILE, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const rows = [];
let changed = 0;

for (const c of companies) {
  if (!c.cik) continue;
  const qs = quarters(await getFacts(c.cik));
  const last = qs.length - 1;
  const now = ttm(qs, last);
  const priorIdx = qs.findIndex((q) => now && Math.abs(days(q.end, now.end) - 365) <= 10);
  const prior = priorIdx >= 0 ? ttm(qs, priorIdx) : null;
  if (!now || !prior) {
    rows.push({ company: c.name, note: "could not build two contiguous TTM windows; left unchanged" });
    continue;
  }
  const pct = Math.round((now.sum / prior.sum - 1) * 1000) / 10;
  // A figure taken by hand from a newer filing (XBRL in SEC's API can lag a 10-Q by weeks) wins over older API data.
  if (c.growth.asOf && c.growth.asOf > now.end) {
    rows.push({ company: c.name, ttmEnd: now.end, sec: pct, current: c.growth.value, note: `kept: current figure is through ${c.growth.asOf}` });
    continue;
  }
  rows.push({ company: c.name, ttmEnd: now.end, ttmB: +(now.sum / 1e9).toFixed(2), priorB: +(prior.sum / 1e9).toFixed(2), sec: pct, current: c.growth.value, diff: +(pct - c.growth.value).toFixed(1) });
  if (WRITE) {
    if (pct !== c.growth.value) changed++;
    c.growth.value = pct;
    c.growth.asOf = now.end;
    c.growth.basis = `twelve months to ${now.end} vs the twelve months before`;
  }
  await new Promise((r) => setTimeout(r, 150)); // SEC asks for ≤10 requests/second
}

console.table(rows);
if (WRITE) {
  await writeFile(FILE, JSON.stringify(companies, null, 2) + "\n");
  console.log(`${changed} growth figure(s) updated on ${today}. Run \`npm test\`, review \`git diff\`, then commit.`);
}
