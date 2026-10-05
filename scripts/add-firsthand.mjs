#!/usr/bin/env node
// Turns a first-hand note from the site's form (via Formspree) into an entry in src/data/firsthand.json.
//
//   npm run add:firsthand -- submission.json           # dry run: validate, normalize, show the entry and anything to check
//   pbpaste | npm run add:firsthand                     # same, from the clipboard
//   npm run add:firsthand -- submission.json --write    # add it to firsthand.json
//   npm run add:firsthand -- submission.json --received 2026-10-12   # date to use when the submission has none
//
// Input can be a Formspree JSON export (one submission, an array, or { "submissions": [...] }), or the submission's
// fields pasted from the Formspree dashboard or notification email, one "field: value" (or field<TAB>value) per line.
//
// Moderation is the one manual step: read the dry run, which flags emails, phone numbers and links in the text and any
// name the contributor asked to be shown under, then rerun with --write. Anything without consent is refused. Text is
// trimmed to the site's limits and whitespace tidied; nothing else about what people wrote is changed.

import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// Kept in step with src/lib/firsthand.ts by src/lib/firsthand.test.ts.
export const PATHS = ["oci", "referral", "direct application", "company event", "club or trek", "other"];
export const TEAM_MATCH = ["hired to a team", "matched after offer", "unsure"];
export const LIMITS = { text: 280, stage: 60, stages: 12, displayName: 40, weeks: 52 };

const KEYS = ["company", "roleId", "classOf", "internshipSummer", "path", "firstContactToOffer", "stages", "teamMatch", "whatMattered", "advice", "displayName", "consent", "email", "kind", "received"];
const DATE_KEYS = ["_date", "date", "received", "submitted", "submittedat", "createdat", "created"];
const PATH_ALIASES = { "on-campus interviews": "oci", "on campus interviews": "oci", "on campus": "oci", direct: "direct application", applied: "direct application", event: "company event", club: "club or trek", trek: "club or trek" };
const squash = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const tidy = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const YES = new Set(["true", "yes", "y", "on", "1", "checked"]);
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Cut to `max` characters at a word boundary, with an ellipsis. */
export function clip(s, max) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** Submissions from a JSON export or pasted "field: value" text, as plain objects. */
export function parseInput(text, fieldMap = {}) {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : Array.isArray(j.submissions) ? j.submissions : [j];
  }
  // Pasted text. Our field names (or the backend's, from meta.json) start a field; other lines continue the last one.
  const names = new Map([...KEYS, ...DATE_KEYS].map((k) => [squash(k), k]));
  for (const [ours, theirs] of Object.entries(fieldMap)) names.set(squash(theirs), ours);
  const out = {};
  let cur = null;
  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w ]{0,30}?)\s*(?::|\t)\s*(.*)$/);
    const alone = names.get(squash(line));
    if (m && names.has(squash(m[1]))) { cur = names.get(squash(m[1])); out[cur] = m[2]; }
    else if (alone && line.trim().length < 32) { cur = alone; out[cur] = ""; }
    else if (cur) out[cur] = out[cur] ? `${out[cur]}\n${line}` : line;
  }
  return [out];
}

/** Map the backend's field names back onto ours. */
function rename(raw, fieldMap) {
  const back = Object.fromEntries(Object.entries(fieldMap).map(([ours, theirs]) => [theirs, ours]));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [back[k] ?? k, v]));
}

const year = (v) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 2 ? 2000 + Number(d) : d.length === 4 ? Number(d) : NaN;
};

/**
 * Validate and normalize one submission. Returns { companyId, report, warnings, email }, or throws with every reason
 * it can't be published.
 * @param {Record<string, unknown>} input
 * @param {{ companies: { id: string, name: string }[], roles: { id: string, name: string, short: string }[], fieldMap?: Record<string, string>, received?: string }} ctx
 */
export function normalize(input, { companies, roles, fieldMap = {}, received }) {
  const raw = rename(input, fieldMap);
  const errors = [], warnings = [];
  if (raw._gotcha) errors.push("the spam trap field is filled in");
  if (raw.kind && tidy(raw.kind) !== "firsthand") errors.push(`this is a "${tidy(raw.kind)}" submission, not a first-hand note`);
  if (!(raw.consent === true || YES.has(tidy(raw.consent).toLowerCase()))) errors.push("no consent to publish");

  const co = tidy(raw.company).toLowerCase();
  const company = companies.find((c) => c.id === co || c.name.toLowerCase() === co);
  if (!company) errors.push(`unknown company: "${tidy(raw.company)}"`);
  const ro = tidy(raw.roleId).toLowerCase();
  const role = roles.find((r) => r.id === ro || r.name.toLowerCase() === ro || r.short.toLowerCase() === ro);
  if (!role) errors.push(`unknown role: "${tidy(raw.roleId)}" (use one of ${roles.map((r) => r.id).join(", ")})`);

  const p = tidy(raw.path).toLowerCase();
  const path = PATHS.includes(p) ? p : PATH_ALIASES[p] ?? PATHS.find((x) => p.startsWith(x));
  if (!path) errors.push(`unknown path: "${tidy(raw.path)}"`);
  const teamMatch = TEAM_MATCH.find((x) => x === tidy(raw.teamMatch).toLowerCase());
  if (!teamMatch) errors.push(`unknown teamMatch: "${tidy(raw.teamMatch)}"`);

  const classOf = year(raw.classOf), internshipSummer = year(raw.internshipSummer);
  if (Number.isNaN(classOf)) errors.push(`classOf is not a year: "${tidy(raw.classOf)}"`);
  if (Number.isNaN(internshipSummer)) errors.push(`internshipSummer is not a year: "${tidy(raw.internshipSummer)}"`);
  if (!Number.isNaN(classOf) && !Number.isNaN(internshipSummer) && classOf !== internshipSummer + 1)
    warnings.push(`class of ${classOf} but the internship was summer ${internshipSummer}; MBA internships are usually the summer before graduation`);

  let weeks;
  if (tidy(raw.firstContactToOffer)) {
    const n = Number(tidy(raw.firstContactToOffer).replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n >= 0 && n <= LIMITS.weeks) weeks = Math.round(n);
    else warnings.push(`dropped firstContactToOffer "${tidy(raw.firstContactToOffer)}" (not 0–${LIMITS.weeks} weeks)`);
  }

  // One stage per line, as the form asks; a single line can also use ; , → or -> between stages.
  const st = String(raw.stages ?? "");
  const list = Array.isArray(raw.stages) ? raw.stages : st.split(/\r?\n/).length > 1 ? st.split(/\r?\n/) : st.split(/;|,|→|->/);
  let stages = list.map((s) => tidy(s).replace(/^(\d+[.)]|[-*•])\s*/, "")).filter(Boolean);
  if (stages.length > LIMITS.stages) { warnings.push(`kept the first ${LIMITS.stages} of ${stages.length} stages`); stages = stages.slice(0, LIMITS.stages); }
  stages = stages.map((s) => { if (s.length > LIMITS.stage) warnings.push(`trimmed stage "${s}"`); return clip(s, LIMITS.stage); });

  const text = {};
  for (const k of ["whatMattered", "advice"]) {
    const s = tidy(raw[k]);
    if (!s) errors.push(`${k} is empty`);
    if (s.length > LIMITS.text) warnings.push(`trimmed ${k} from ${s.length} to ${LIMITS.text} characters`);
    text[k] = clip(s, LIMITS.text);
  }
  const displayName = clip(tidy(raw.displayName), LIMITS.displayName) || undefined;

  const stamp = DATE_KEYS.map((k) => raw[k]).find(Boolean);
  const when = stamp ? new Date(stamp) : null;
  const date = received ?? (when && !Number.isNaN(when.getTime()) ? when.toISOString().slice(0, 10) : localToday());
  if (!received && !when) warnings.push(`no submission date found; using ${date} (pass --received YYYY-MM-DD to set it)`);

  if (errors.length) throw new Error(errors.join("\n"));

  // Things a moderator should look at before publishing.
  const published = [...stages, text.whatMattered, text.advice, displayName ?? ""].join(" ");
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(published)) warnings.push("CHECK: the text contains an email address");
  if ((published.match(/\+?\d[\d\s().-]{7,}\d/g) ?? []).some((m) => m.replace(/\D/g, "").length >= 10)) warnings.push("CHECK: the text contains what looks like a phone number");
  if (/https?:\/\/|www\./i.test(published)) warnings.push("CHECK: the text contains a link");
  if (displayName) warnings.push(`CHECK: will be shown by name, as "${displayName}"`);

  const report = {
    received: date, classOf, internshipSummer, roleId: role.id, path,
    ...(weeks !== undefined ? { firstContactToOffer: weeks } : {}),
    stages, teamMatch, whatMattered: text.whatMattered, advice: text.advice,
    ...(displayName ? { displayName } : {}),
    consent: true,
  };
  return { companyId: company.id, report, warnings, email: tidy(raw.email) || null };
}

/** Add a report, keeping companies in companies.json order and reports by date. Returns false if it's already there. */
export function addReport(data, companyId, report, companyOrder) {
  const list = data[companyId] ?? [];
  if (list.some((r) => r.received === report.received && r.advice === report.advice && r.whatMattered === report.whatMattered)) return false;
  data[companyId] = [...list, report].sort((a, b) => a.received.localeCompare(b.received));
  const sorted = Object.fromEntries(companyOrder.filter((id) => data[id]).map((id) => [id, data[id]]));
  for (const k of Object.keys(data)) delete data[k];
  Object.assign(data, sorted);
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const ri = args.indexOf("--received");
  const received = ri >= 0 ? args[ri + 1] : undefined;
  if (received && !/^\d{4}-\d{2}-\d{2}$/.test(received)) throw new Error("--received must be YYYY-MM-DD");
  const file = args.find((a, i) => !a.startsWith("--") && (ri < 0 || i !== ri + 1));

  const read = (rel) => readFile(new URL(rel, import.meta.url), "utf8").then(JSON.parse);
  const [companies, roles, meta] = await Promise.all([read("../src/data/companies.json"), read("../src/data/roles.json"), read("../src/data/meta.json")]);
  const DATA = new URL("../src/data/firsthand.json", import.meta.url);
  const data = JSON.parse(await readFile(DATA, "utf8"));

  let text = "";
  if (file) text = await readFile(file, "utf8");
  else if (!process.stdin.isTTY) for await (const chunk of process.stdin) text += chunk;
  if (!text.trim()) throw new Error("No submission given. Pass a file, or pipe one in (e.g. pbpaste | npm run add:firsthand).");

  const fieldMap = meta.firsthand?.fields ?? {};
  let added = 0, refused = 0;
  for (const sub of parseInput(text, fieldMap)) {
    let out;
    try {
      out = normalize(sub, { companies, roles, fieldMap, received });
    } catch (e) {
      refused++;
      console.error(`\nREFUSED:\n  ${e.message.split("\n").join("\n  ")}`);
      continue;
    }
    const { companyId, report, warnings, email } = out;
    const name = companies.find((c) => c.id === companyId).name;
    console.log(`\n${name} · summer ${report.internshipSummer}\n${JSON.stringify(report, null, 2)}`);
    warnings.forEach((w) => console.log(`  ! ${w}`));
    if (email) console.log(`  (contributor left an email for follow-up, not stored: ${email})`);
    if (!addReport(data, companyId, report, companies.map((c) => c.id))) { console.log("  already in firsthand.json; skipped"); continue; }
    added++;
    const same = data[companyId].filter((r) => r.internshipSummer === report.internshipSummer).length;
    console.log(`  ${name} would have ${same} note${same === 1 ? "" : "s"} for summer ${report.internshipSummer}: ${same >= 2 ? "per-report details show" : "aggregate only until a second one arrives"}.`);
  }
  if (write && added) {
    await writeFile(DATA, `${JSON.stringify(data, null, 2)}\n`);
    console.log(`\nWrote ${added} note${added === 1 ? "" : "s"} to src/data/firsthand.json. Run npm test, then commit.`);
  } else if (added) console.log("\nDry run. Rerun with --write to add to src/data/firsthand.json.");
  if (refused) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((e) => { console.error(e.message); process.exit(1); });
