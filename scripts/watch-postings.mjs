#!/usr/bin/env node
// Posting watcher: asks each company's careers API (src/data/watch.json) for MBA internships this cycle, diffs them
// against `current.postings` in src/data/hiring.json, and prints a markdown report.
//
//   node scripts/watch-postings.mjs                       # dry run: report only
//   node scripts/watch-postings.mjs --write               # also update hiring.json, sources.json, changes.json, meta.json
//   node scripts/watch-postings.mjs --write --mark-gone   # also stamp `gone` on the sources of postings confirmed removed
//   node scripts/watch-postings.mjs --only=google,nvidia  # just these companies
//   node scripts/watch-postings.mjs --report=report.md    # also save the report (the GitHub Action uses it as the PR body)
//
// With --write, for every company it checked successfully it:
//   - adds new postings (title, posted/closes when the API states them, url), each with a new primary source
//   - sets `current.checked` to today
//   - on a company's first posting this cycle, adds the window: the posted date if the API gives one (strong),
//     otherwise from the last check that found nothing to today, with evidence by the gap (README definitions)
//   - logs postings that appear or disappear in changes.json; past postings are never deleted
//   - rewrites `current.summary` from a template whenever the postings change, and lists it under "Needs a human"
//     (a hand-written sentence would otherwise contradict the new state)
// and moves `meta.researched` to today when no automatic check failed.
//
// The parsing, filtering, diffing and window logic is in src/lib/watch.ts (unit-tested against recorded responses).
// It's polite: one request at a time, at most one a second per host (three for Microsoft), with a descriptive User-Agent.

import { readFile, writeFile } from "node:fs/promises";
import * as W from "../src/lib/watch.ts";

const DATA = new URL("../src/data/", import.meta.url);
const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WRITE = process.argv.includes("--write");
const MARK_GONE = process.argv.includes("--mark-gone");
const ONLY = arg("only")?.split(",");
const REPORT = arg("report");
const UA = "marauders-map-watcher/1.0 (+https://marauders-map.natwong.dev; daily check of MBA internship postings)";
const MAX_DETAILS = 25; // per company, so a broad search can't turn into hundreds of requests

const load = async (f) => JSON.parse(await readFile(new URL(f, DATA), "utf8"));
const save = (f, d) => writeFile(new URL(f, DATA), JSON.stringify(d, null, 2) + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── http: one request at a time, spaced per host, one retry on 429/5xx ─────────────────────────────────────

const lastAt = new Map();
const GAP = { "apply.careers.microsoft.com": 3000 };
async function request(url, { method = "GET", body, headers = {}, accept = "application/json" } = {}) {
  const host = new URL(url).host;
  for (let attempt = 0; ; attempt++) {
    const wait = (lastAt.get(host) ?? 0) + (GAP[host] ?? 1000) - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt.set(host, Date.now());
    const res = await fetch(url, {
      method,
      headers: { "User-Agent": UA, Accept: accept, ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
      body: body ? JSON.stringify(body) : undefined,
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep((Number(res.headers.get("retry-after")) || 20) * 1000);
      continue;
    }
    return { status: res.status, url: res.url, text: await res.text() };
  }
}
async function json(url, opts) {
  const r = await request(url, opts);
  if (r.status !== 200) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  try {
    return JSON.parse(r.text);
  } catch {
    throw new Error(`non-JSON answer from ${new URL(url).host}`);
  }
}
async function html(url) {
  const r = await request(url, { accept: "text/html" });
  if (r.status !== 200) throw new Error(`HTTP ${r.status} from ${new URL(url).host}`);
  return r.text;
}
const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined)).toString();
const queries = (e) => (e.queries.length ? e.queries : [{ q: "" }]);

// ── adapters: search(entry) → every job the queries return; detail(entry, job) → job with text/dates;
//    exists(entry, posting) → true / false / null (can't tell) for a known posting missing from the search ──────

const adapters = {
  greenhouse: {
    async search(e) {
      return W.parseGreenhouse(await json(e.endpoints[0]));
    },
    async detail(e, j) {
      const raw = await json(`${e.endpoints[0]}/${j.key}`);
      return { ...j, text: W.plain(W.decode(raw.content ?? "")) };
    },
    async exists(e, p) {
      const key = W.keyFromUrl("greenhouse", p.url);
      if (!key) return null; // matched by title only, so a retitled posting could look gone
      const { status } = await request(`${e.endpoints[0]}/${key}`);
      return status === 404 ? false : status === 200 ? true : null;
    },
  },

  ashby: {
    async search(e) {
      return W.parseAshby(await json(e.endpoints[0]));
    },
    exists: async (e, p) => (W.keyFromUrl("ashby", p.url) ? false : null), // the whole board was listed and its id isn't on it
  },

  workday: {
    async search(e) {
      const out = [];
      for (const ep of e.endpoints)
        for (const { q } of queries(e)) {
          const page = (offset, appliedFacets = {}) => json(ep, { method: "POST", body: { appliedFacets, limit: 20, offset, searchText: q } });
          const first = await page(0);
          out.push(...W.parseWorkdayList(first, ep));
          const facets = W.workdayInternFacets(first);
          if (facets) {
            // List every internship that matches the search (interns are usually a short list).
            let r = await page(0, facets);
            out.push(...W.parseWorkdayList(r, ep));
            for (let off = 20; off < Math.min(r.total ?? 0, 100); off += 20) out.push(...W.parseWorkdayList(await page(off, facets), ep));
          } else {
            // No intern worker type among the matches; still scan the top of the list for intern titles.
            for (let off = 20; off < Math.min(first.total ?? 0, 60); off += 20) out.push(...W.parseWorkdayList(await page(off), ep));
          }
        }
      return out;
    },
    async detail(e, j) {
      const ep = e.endpoints.find((x) => j.url.startsWith(W.workdayPublicBase(x))) ?? e.endpoints[0];
      return W.parseWorkdayDetail(await json(ep.replace(/\/jobs$/, "") + j.url.slice(W.workdayPublicBase(ep).length)), j);
    },
    async exists(e, p) {
      const path = /\/job\/.+$/.exec(p.url.replace(/\/apply.*$/, ""))?.[0];
      if (!path) return null;
      const site = (u) => /\/cxs\/[^/]+\/([^/]+)\/jobs$/.exec(u)?.[1]?.toLowerCase();
      const ep = e.endpoints.find((x) => p.url.toLowerCase().includes(`/${site(x)}/`)) ?? e.endpoints[0];
      const r = await request(ep.replace(/\/jobs$/, "") + path);
      if (r.status === 404) return false;
      if (r.status !== 200) return null;
      return JSON.parse(r.text)?.jobPostingInfo?.posted !== false;
    },
  },

  amazon: {
    async search(e) {
      const out = [];
      for (const { q, params } of queries(e))
        for (let offset = 0; offset < 300; offset += 100) {
          const raw = await json(`${e.endpoints[0]}?${qs({ base_query: q, offset, ...e.params, ...params })}`);
          out.push(...W.parseAmazon(raw));
          if (offset + 100 >= (raw.hits ?? 0)) break;
        }
      return out;
    },
  },

  eightfold: {
    async search(e) {
      const out = [];
      const origin = new URL(e.endpoints[0]).origin;
      for (const { q, params } of queries(e))
        for (let start = 0; start < 100; start += 10) {
          const raw = await json(`${e.endpoints[0]}?${qs({ ...e.params, ...params, query: q, start })}`);
          out.push(...W.parseEightfoldSearch(raw, origin));
          if (start + 10 >= (raw.data?.count ?? 0)) break;
        }
      return out;
    },
    async detail(e, j) {
      return W.parseEightfoldDetail(await json(`${e.endpoints[0].replace(/\/search$/, "/position_details")}?${qs({ position_id: j.key, domain: e.params?.domain, hl: "en" })}`), j);
    },
    async exists(e, p) {
      const key = W.keyFromUrl("eightfold", p.url);
      if (!key) return null;
      const r = await request(`${e.endpoints[0].replace(/\/search$/, "/position_details")}?${qs({ position_id: key, domain: e.params?.domain, hl: "en" })}`);
      return r.status === 404 ? false : r.status === 200 ? true : null;
    },
  },

  apple: {
    async search(e) {
      const out = [];
      for (const { q, params } of queries(e))
        for (let page = 1; page <= 5; page++) {
          const jobs = W.parseApple(await html(`${e.endpoints[0]}?${qs({ search: q, ...e.params, ...params, page: page > 1 ? page : undefined })}`));
          out.push(...jobs);
          if (jobs.length < 20) break;
        }
      return out;
    },
  },

  google: {
    async search(e) {
      const out = [];
      for (const { q, params } of queries(e))
        for (let page = 1; page <= 5; page++) {
          const jobs = W.parseGoogle(await html(`${e.endpoints[0]}?${qs({ q, ...e.params, ...params, page: page > 1 ? page : undefined })}`));
          out.push(...jobs);
          if (jobs.length < 20) break;
        }
      return out;
    },
  },

  tiktok: {
    async search(e) {
      const out = [];
      const limit = Number(e.params?.limit ?? 100);
      const headers = { "website-path": "tiktok", Origin: "https://lifeattiktok.com", Referer: "https://lifeattiktok.com/", "Accept-Language": "en-US" };
      for (const { q } of queries(e))
        for (let offset = 0; offset < 500; offset += limit) {
          const raw = await json(e.endpoints[0], { method: "POST", headers, body: { keyword: q, limit, offset, job_category_id_list: [], location_code_list: [], subject_id_list: [], recruitment_id_list: [] } });
          if (raw.code !== 0) throw new Error(`TikTok API code ${raw.code}`);
          out.push(...W.parseTikTok(raw));
          if (offset + limit >= (raw.data?.count ?? 0)) break;
        }
      return out;
    },
  },

  smartrecruiters: {
    async search(e) {
      const out = [];
      const company = /\/companies\/([^/]+)\//.exec(e.endpoints[0])[1];
      for (const { q, params } of queries(e))
        for (let offset = 0; offset < 300; offset += 100) {
          const raw = await json(`${e.endpoints[0]}?${qs({ q, ...e.params, ...params, offset })}`);
          out.push(...W.parseSmartRecruiters(raw, company));
          if (offset + 100 >= (raw.totalFound ?? 0)) break;
        }
      return out;
    },
    async detail(e, j) {
      return W.parseSmartRecruitersDetail(await json(`${e.endpoints[0]}/${j.key}`), j);
    },
    async exists(e, p) {
      const key = W.keyFromUrl("smartrecruiters", p.url);
      if (!key) return null;
      const r = await request(`${e.endpoints[0]}/${key}`);
      if (r.status === 404) return false;
      return r.status === 200 ? JSON.parse(r.text).active !== false : null;
    },
  },

  "oracle-hcm": {
    async search(e) {
      const { jobBase, siteNumber, ...p } = e.params;
      const out = [];
      for (const { q } of queries(e)) {
        const finder = `findReqs;siteNumber=${siteNumber},keyword="${q}",limit=${p.limit ?? 100},sortBy=${p.sortBy ?? "POSTING_DATES_DESC"}`;
        out.push(...W.parseOracle(await json(`${e.endpoints[0]}?onlyData=true&expand=requisitionList.secondaryLocations&finder=${encodeURIComponent(finder)}`), jobBase));
      }
      return out;
    },
    async detail(e, j) {
      return W.parseOracleDetail(await json(this.detailUrl(e, j.key)), j);
    },
    async exists(e, p) {
      const key = W.keyFromUrl("oracle-hcm", p.url);
      if (!key) return null;
      const raw = await json(this.detailUrl(e, key));
      return (raw.items ?? []).length > 0;
    },
    detailUrl(e, key) {
      return `${e.endpoints[0].replace(/recruitingCEJobRequisitions$/, "recruitingCEJobRequisitionDetails")}?expand=all&onlyData=true&finder=${encodeURIComponent(`ById;Id="${key}",siteNumber=${e.params.siteNumber}`)}`;
    },
  },

  ibm: {
    body(e, must) {
      const filter = Object.entries(e.params ?? {}).map(([k, v]) => ({ term: { [k]: v } }));
      return { appId: "careers", scopes: ["careers2"], query: { bool: { must, filter } }, size: 100, lang: "zz", localeSelector: {}, _source: ["title", "url", "body", "field_keyword_05", "field_keyword_18", "field_keyword_19", "field_text_01"] };
    },
    async search(e) {
      const out = [];
      for (const { q } of queries(e)) out.push(...W.parseIbm(await json(e.endpoints[0], { method: "POST", body: { ...this.body(e, [{ simple_query_string: { query: q, fields: ["title^3", "body", "description^2"] } }]), sm: { query: q, lang: "zz" } } })));
      return out;
    },
    async exists(e, p) {
      const key = W.keyFromUrl("ibm", p.url);
      if (!key) return null;
      const raw = await json(e.endpoints[0], { method: "POST", body: { ...this.body({ params: {} }, [{ terms: { field_text_01: [Number(key)] } }]), size: 1 } });
      return (raw.hits?.hits ?? []).length > 0;
    },
  },

  radancy: {
    async search(e) {
      const origin = new URL(e.endpoints[0]).origin;
      const out = [];
      for (const { q } of queries(e)) {
        const p = { ActiveFacetID: 0, CurrentPage: 1, RecordsPerPage: 100, Distance: 50, RadiusUnitType: 0, Keywords: q, Location: "", ShowRadius: "False", IsPagination: "False", FacetType: 0, SearchResultsModuleName: "Search Results", SearchFiltersModuleName: "Search Filters", SortCriteria: 0, SortDirection: 0, SearchType: 5, ResultsType: 0, ...e.params };
        out.push(...W.parseRadancy(await json(`${e.endpoints[0]}?${qs(p)}`, { headers: { "X-Requested-With": "XMLHttpRequest" } }), origin));
      }
      return out;
    },
    async detail(e, j) {
      return W.parseJobPostingLd(await html(j.url), j);
    },
    async exists(e, p) {
      const r = await request(p.url, { accept: "text/html" });
      if ([404, 410].includes(r.status)) return false;
      return r.status === 200 && /"@type":"JobPosting"/.test(r.text) ? true : null;
    },
  },
};

// ── one company ──────────────────────────────────────────────────────────────────────────────────────────

async function watchCompany(id, name, entry, h, changes, cycle) {
  const base = { id, name, hasProgram: h.hasProgram };
  if (entry.kind === "manual") return { ...base, status: "manual", reason: entry.reason };
  const a = adapters[entry.kind];
  if (!a) return { ...base, status: "failed", reason: `no adapter for kind "${entry.kind}"` };
  try {
    const byKey = new Map();
    for (const j of await a.search(entry)) if (!byKey.has(j.key)) byKey.set(j.key, j);
    const known = (j) => h.current.postings.some((p) => W.sameJob(entry.kind, p, j));
    // Fetch details only for new internship candidates: to read the description, or the dates and country of a match.
    let details = 0;
    for (const [k, j] of byKey) {
      if (!a.detail || known(j) || !W.looksLikeIntern(j) || details >= MAX_DETAILS) continue;
      const v = W.classify(j, cycle);
      const wanted = W.needsDetail(j) || (v.match && (!j.posted || !j.countries.length || j.text === undefined));
      if (!wanted) continue;
      details++;
      try {
        byKey.set(k, await a.detail(entry, j));
      } catch (e) {
        console.error(`  ${name}: detail for ${j.key} failed (${e.message}); classifying from the list entry`);
      }
    }
    const seen = [...byKey.values()].filter((j) => j.active !== false);
    const verdicts = seen.map((j) => ({ j, v: W.classify(j, cycle) }));
    const matches = verdicts.filter((x) => x.v.match && W.inUS(x.j)).map((x) => x.j);
    const nonUS = verdicts.filter((x) => x.v.match && !W.inUS(x.j)).map((x) => ({ job: x.j, region: W.regionOnly(x.j) }));
    const passing = verdicts.filter((x) => !x.v.match && x.v.reason === "MBA mentioned only in passing" && W.inUS(x.j) && !known(x.j) && !W.technicalRole(x.j.title)).map((x) => x.j);
    const diff = W.diffPostings(entry.kind, h.current.postings, seen, matches, W.removedUrls(changes, id));
    // A known posting that the search no longer returns: ask the ATS directly where it can say.
    const gone = [];
    for (const p of [...diff.missing]) {
      const still = a.exists ? await a.exists(entry, p).catch(() => null) : null;
      if (still) {
        diff.missing.splice(diff.missing.indexOf(p), 1);
        diff.present.push(p);
      } else gone.push({ posting: p, confirmed: still === false });
    }
    return { ...base, status: "ok", diff, gone, nonUS, passing };
  } catch (e) {
    return { ...base, status: "failed", reason: e.message };
  }
}

// ── main ─────────────────────────────────────────────────────────────────────────────────────────────────

const [watch, hiring, companies, meta] = await Promise.all([load("watch.json"), load("hiring.json"), load("companies.json"), load("meta.json")]);
let sources = await load("sources.json");
const changes = await load("changes.json");
const cycle = meta.currentCycle;
const today = W.pacificDate(new Date());
const nameOf = Object.fromEntries(companies.map((c) => [c.id, c.name]));

const results = [];
for (const id of Object.keys(hiring)) {
  if (ONLY && !ONLY.includes(id)) continue;
  if (!watch[id]) {
    results.push({ id, name: nameOf[id] ?? id, hasProgram: hiring[id].hasProgram, status: "failed", reason: "not in watch.json" });
    continue;
  }
  console.error(`checking ${nameOf[id] ?? id} (${watch[id].kind})`);
  results.push(await watchCompany(id, nameOf[id] ?? id, watch[id], hiring[id], changes, cycle));
}

let researched = null;
if (WRITE) {
  const citations = new Map(); // source id → number of postings citing it (shared sources are never stamped gone)
  for (const h of Object.values(hiring)) for (const p of h.current.postings) for (const s of p.sources) citations.set(s, (citations.get(s) ?? 0) + 1);

  for (const r of results.filter((x) => x.status === "ok")) {
    const h = hiring[r.id];
    const entry = watch[r.id];
    const hadPostings = h.current.postings.length > 0;
    const added = [];
    if (h.hasProgram)
      for (const job of r.diff.added) {
        const sid = W.sourceId(r.id, job, sources);
        sources = W.insertSorted(sources, sid, W.sourceFor(job, entry, today));
        h.current.postings.push({ title: job.title, posted: job.posted, closes: job.closes, url: job.url, sources: [sid] });
        changes.push({ date: today, company: r.id, kind: "posted", title: job.title, url: job.url });
        added.push({ job, sourceId: sid });
      }
    if (added.length && !W.windowFor(h, cycle) && !hadPostings) {
      r.window = W.inferWindow({ cycle, prevChecked: h.current.checked, today, added });
      h.windows.push(r.window);
    }
    for (const p of r.diff.reappeared) changes.push({ date: today, company: r.id, kind: "posted", title: p.title, url: p.url });
    for (const g of r.gone) {
      changes.push({ date: today, company: r.id, kind: "removed", title: g.posting.title, url: g.posting.url });
      if (!MARK_GONE || !g.confirmed) continue;
      const own = g.posting.sources.filter((s) => citations.get(s) === 1 && sources[s]);
      if (!own.length) (r.unstampable ??= []).push(g.posting);
      for (const s of own) sources[s].gone ??= today;
      if (own.length) (r.stamped ??= []).push(...own);
    }
    if (h.hasProgram && (added.length || r.gone.length || r.diff.reappeared.length)) {
      const removed = W.removedUrls(changes, r.id);
      const live = h.current.postings.filter((p) => !removed.has(p.url));
      const after = W.summarize({ today, live, removed: h.current.postings.length - live.length });
      r.summary = { before: h.current.summary, after };
      h.current.summary = after;
    }
    h.current.checked = today;
  }

  const failed = results.some((r) => r.status === "failed");
  if (!failed && !ONLY && meta.researched < today) {
    researched = { from: meta.researched, to: today };
    meta.researched = today;
  }
  await Promise.all([save("hiring.json", hiring), save("sources.json", sources), save("changes.json", changes), save("meta.json", meta)]);
}

const report = W.renderReport({ today, cycle, results, write: WRITE, researched });
process.stdout.write(report);
if (REPORT) await writeFile(REPORT, report);
if (WRITE) console.error("\nWrote src/data. Run `npm test`, review `git diff`, then commit.");
