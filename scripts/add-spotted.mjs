#!/usr/bin/env node
// Turns an "it's live" report from the site's form (via Formspree) into a posting in src/data/hiring.json.
// For companies the watcher can't check (watch.json kind "manual", today Meta and Uber); a student says they see a posting.
//
//   pbpaste | npm run add:spotted                           # dry run: what it would add, plus anything to check
//   pbpaste | npm run add:spotted -- --write                # apply it to hiring.json, sources.json, changes.json
//   npm run add:spotted -- submission.json --title="MBA Intern, Summer 2027"   # from a file; title when the form had none
//
// Input can be a Formspree JSON export (one submission, an array, or { "submissions": [...] }), or the submission's
// fields pasted from the Formspree dashboard or notification email, one "field: value" (or field<TAB>value) per line.
//
// Moderation is the one manual step: open the link and check it is a real, live MBA internship posting, then --write.
// Anything not marked kind=spotted is refused. --title, when given, replaces the title the student typed.
//
// With --write it does what the watcher does for a posting it finds (src/lib/watch.ts): adds the posting with a new
// primary source, sets `current.checked` to today, rewrites `current.summary` from the template, logs it in
// changes.json, and, if it's the company's first posting this cycle, adds the window by the same gap rule (no posted
// date, so from the last check that found nothing to today, with evidence by the gap).

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import * as W from "../src/lib/watch.ts";
import { normalize, parseInput } from "../src/lib/spotted.ts";

const DATA = new URL("../src/data/", import.meta.url);
const load = async (f) => JSON.parse(await readFile(new URL(f, DATA), "utf8"));
const save = (f, d) => writeFile(new URL(f, DATA), JSON.stringify(d, null, 2) + "\n");
const sameUrl = (a, b) => a.replace(/[#?].*$/, "").replace(/\/+$/, "") === b.replace(/[#?].*$/, "").replace(/\/+$/, "");

/**
 * Add one reported posting to `data` ({ hiring, sources, changes }, changed in place). Returns what it did, or null
 * if the posting is already listed.
 */
export function addSpotted(data, watch, cycle, today, { companyId, url, title }) {
  const h = data.hiring[companyId];
  if (h.current.postings.some((p) => sameUrl(p.url, url))) return null;
  // No ATS id here, so take a long number from the URL (Meta's job_details/<id>), else the title.
  const num = /\d{6,}/.exec(url)?.[0];
  const job = { key: num ?? W.slug(title), title, url, posted: null, closes: null, countries: ["US"], location: "" };
  const sid = W.sourceId(companyId, job, data.sources);
  const source = W.sourceFor(job, watch[companyId], today);
  if (!num) source.title = title; // sourceFor() would append the key, which here is just the title again
  data.sources = W.insertSorted(data.sources, sid, source);

  const hadPostings = h.current.postings.length > 0;
  const prevChecked = h.current.checked;
  h.current.postings.push({ title, posted: null, closes: null, url, sources: [sid] });
  data.changes.push({ date: today, company: companyId, kind: "posted", title, url });
  let window = null;
  if (!W.windowFor(h, cycle) && !hadPostings) {
    window = W.inferWindow({ cycle, prevChecked, today, added: [{ job, sourceId: sid }] });
    window.note = window.note.replace("found by the posting watcher", "reported by a student and checked by hand");
    h.windows.push(window);
  }
  const removed = W.removedUrls(data.changes, companyId);
  const live = h.current.postings.filter((p) => !removed.has(p.url));
  const summary = { before: h.current.summary, after: W.summarize({ today, live, removed: h.current.postings.length - live.length }) };
  h.current.summary = summary.after;
  h.current.checked = today;
  return { sourceId: sid, window, summary, sameTitle: h.current.postings.slice(0, -1).some((p) => W.normTitle(p.title) === W.normTitle(title)) };
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const title = args.find((a) => a.startsWith("--title="))?.slice("--title=".length);
  const file = args.find((a) => !a.startsWith("--"));

  const [hiring, companies, meta, watch, changes] = await Promise.all(["hiring", "companies", "meta", "watch", "changes"].map((f) => load(`${f}.json`)));
  const data = { hiring, sources: await load("sources.json"), changes };
  const today = W.pacificDate(new Date());

  let text = "";
  if (file) text = await readFile(file, "utf8");
  else if (!process.stdin.isTTY) for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) throw new Error("No submission given. Pass a file, or pipe one in (e.g. pbpaste | npm run add:spotted).");

  const fieldMap = meta.spotted?.fields ?? {};
  let added = 0, refused = 0;
  for (const sub of parseInput(text, fieldMap)) {
    let out;
    try {
      out = normalize(sub, { companies, hiring, watch, fieldMap, title });
    } catch (e) {
      refused++;
      console.error(`\nREFUSED:\n  ${e.message.split("\n").join("\n  ")}`);
      continue;
    }
    const { companyId, url, title: t, email, warnings } = out;
    const name = companies.find((c) => c.id === companyId).name;
    console.log(`\n${name}: ${t}\n  ${url}`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
    if (email) console.log(`  (the student left an email for a reply, not stored: ${email})`);
    const done = addSpotted(data, watch, meta.currentCycle, today, { companyId, url, title: t });
    if (!done) { console.log("  already in hiring.json; skipped"); continue; }
    added++;
    if (done.sameTitle) console.log("  ! CHECK: another posting here has the same title; make sure this is a different one");
    console.log(`  + posting, with source ${done.sourceId} (${watch[companyId].publisher}, accessed ${today})`);
    console.log(`  + changes.json: posted ${today}`);
    if (done.window) console.log(`  + window for ${meta.currentCycle}: ${done.window.from} to ${done.window.to}, ${done.window.evidence} evidence (first posting this cycle)`);
    console.log(`  + checked ${today}; summary now: ${done.summary.after}`);
    if (done.summary.before !== done.summary.after) console.log(`    (was: ${done.summary.before})\n    The template drops context; add it back by hand if it mattered.`);
  }
  if (write && added) {
    await Promise.all([save("hiring.json", data.hiring), save("sources.json", data.sources), save("changes.json", data.changes)]);
    console.log(`\nWrote ${added} posting${added === 1 ? "" : "s"} to src/data. Run npm test, then commit.`);
  } else if (added) console.log("\nDry run. Open the link to check it's real, then rerun with --write, then run npm test.");
  if (refused) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => { console.error(e.message); process.exit(1); });
