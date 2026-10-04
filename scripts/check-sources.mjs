#!/usr/bin/env node
// Source health check: fetches every URL in src/data/sources.json, reports dead links, and confirms each
// quote actually appears on the page.
//
//   node scripts/check-sources.mjs                  # report only
//   node scripts/check-sources.mjs --drop-unverified  # also null out quotes that a loaded page doesn't contain
//   node scripts/check-sources.mjs --strict           # null out every quote not verified (also blocked/JS-only pages)
//   node scripts/check-sources.mjs --mark-gone        # stamp dead links with `"gone": date` (the site shows "since removed")
//
// Quotes checked by hand in a real browser carry `"quoteCheck": "browser YYYY-MM-DD"` and are trusted as-is.
//
// A quote that can't be found is dropped rather than "fixed": the link stays, the claim just loses its excerpt.
// Pages that block scripts (403/429) or render with JavaScript can't be verified this way; they're listed for a human check.

import { readFile, writeFile } from "node:fs/promises";

const FILE = new URL("../src/data/sources.json", import.meta.url);
const STRICT = process.argv.includes("--strict");
const MARK_GONE = process.argv.includes("--mark-gone"); // record dead links (usually expired job postings) as `gone`
const DROP = STRICT || process.argv.includes("--drop-unverified");
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "-", mdash: "-", hellip: "..." };
const norm = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m)
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"').replace(/[–—‑]/g, "-").replace(/…/g, "...")
    .replace(/\s+/g, " ")
    .toLowerCase();
const pageText = (html) => norm(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
const hostOf = (u) => new URL(u).host;

function quoteIn(text, quote) {
  const q = norm(quote).replace(/^\.\.\.|\.\.\.$/g, "").trim();
  // Tolerate ellipses inside a quote: every fragment must appear, in order.
  let at = 0;
  for (const part of q.split("...").map((p) => p.trim()).filter(Boolean)) {
    const i = text.indexOf(part, at);
    if (i < 0) return false;
    at = i + part.length;
  }
  return true;
}

/** Fallback for pages that block scripts or render client-side: look for the quote in the newest Wayback snapshot. */
async function viaArchive(s) {
  try {
    const avail = await (await fetch(`https://archive.org/wayback/available?url=${encodeURIComponent(s.url)}`, { signal: AbortSignal.timeout(20_000) })).json();
    const snap = avail?.archived_snapshots?.closest;
    if (!snap?.available) return null;
    const raw = snap.url.replace(/\/web\/(\d+)\//, "/web/$1id_/"); // id_ = original page without the Wayback toolbar
    const res = await fetch(raw, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25_000) });
    if (!res.ok) return null;
    return { found: quoteIn(pageText(await res.text()), s.quote), snapshot: snap.timestamp };
  } catch {
    return null;
  }
}

async function check(id, s) {
  const r = await checkLive(id, s);
  if (s.quote && s.quoteCheck && r.status !== "dead") return { id, status: "ok", note: `quote ${s.quoteCheck}` };
  if (s.quote && ["blocked", "unverifiable", "error"].includes(r.status)) {
    const a = await viaArchive(s);
    if (a?.found) return { id, status: "ok", note: `quote verified in archive ${a.snapshot}` };
    if (a) return { ...r, status: r.status === "error" ? "error" : "quote-missing", note: `not in archive ${a.snapshot} either` };
  }
  return r;
}

async function checkLive(id, s) {
  try {
    const res = await fetch(s.url, { headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml,application/pdf,*/*" }, redirect: "follow", signal: AbortSignal.timeout(25_000) });
    if ([401, 403, 429, 999].includes(res.status)) return { id, status: "blocked", code: res.status };
    if (!res.ok) return { id, status: "dead", code: res.status };
    if (!s.quote) return { id, status: "ok" };
    const type = res.headers.get("content-type") ?? "";
    if (!/html|text|json/.test(type)) return { id, status: "unverifiable", note: type };
    const text = pageText(await res.text());
    if (quoteIn(text, s.quote)) return { id, status: "ok" };
    return text.length < 3000 ? { id, status: "unverifiable", note: "page renders with JavaScript" } : { id, status: "quote-missing" };
  } catch (e) {
    return { id, status: "error", note: String(e.cause?.code ?? e.name) };
  }
}

const sources = JSON.parse(await readFile(FILE, "utf8"));
const results = [];
// A few at a time per host, to be polite.
const queue = Object.entries(sources);
const busy = new Map();
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const idx = queue.findIndex(([, s]) => (busy.get(hostOf(s.url)) ?? 0) < 2);
    if (idx < 0) { await new Promise((r) => setTimeout(r, 100)); continue; }
    const [[id, s]] = queue.splice(idx, 1);
    const h = hostOf(s.url);
    busy.set(h, (busy.get(h) ?? 0) + 1);
    results.push({ ...(await check(id, s)), url: s.url });
    busy.set(h, busy.get(h) - 1);
  }
}));

const by = (st) => results.filter((r) => r.status === st);
for (const st of ["dead", "error", "quote-missing", "blocked", "unverifiable"]) {
  const rs = by(st);
  if (rs.length) console.log(`\n${st} (${rs.length})\n` + rs.map((r) => `  ${r.id}${r.code ? ` [${r.code}]` : ""}${r.note ? ` (${r.note})` : ""}  ${r.url}`).join("\n"));
}
console.log(`\n${by("ok").length}/${results.length} sources ok`);

if (MARK_GONE) {
  const today = new Date().toISOString().slice(0, 10);
  for (const r of by("dead")) sources[r.id].gone ??= today;
  await writeFile(FILE, JSON.stringify(sources, null, 2) + "\n");
  console.log(`marked ${by("dead").length} dead link(s) as gone`);
}
if (DROP) {
  let n = 0;
  const unverified = STRICT ? ["quote-missing", "blocked", "unverifiable", "error"] : ["quote-missing"];
  for (const r of results) if (unverified.includes(r.status) && sources[r.id].quote && !sources[r.id].quoteCheck) { sources[r.id].quote = null; n++; }
  await writeFile(FILE, JSON.stringify(sources, null, 2) + "\n");
  console.log(`dropped ${n} unverified quote(s)`);
}
// Expired postings are expected; only unexplained dead links fail the run.
process.exitCode = by("dead").some((r) => !sources[r.id].gone) && !MARK_GONE ? 1 : 0;
