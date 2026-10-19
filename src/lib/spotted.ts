// "It's live" reports: a student says they see a posting at a company the watcher can't check (watch.json kind
// "manual"). This is the pure half of scripts/add-spotted.mjs: reading a pasted or exported submission and deciding
// whether it can be added. The script does the writing, with the watcher's own helpers from watch.ts.
//
// Node runs this file directly (type stripping), so it may only use erasable TypeScript and type-only imports.

import type { WatchEntry } from "../data/types";

export const LIMITS = { url: 500, title: 160 };

const KEYS = ["company", "url", "title", "email", "kind", "_gotcha", "_subject", "_date"];
const squash = (s: string) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
const tidy = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

/** Cut to `max` characters at a word boundary, with an ellipsis. */
function clip(s: string, max: number) {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.-]+$/, "")}…`;
}

/** Submissions from a Formspree JSON export or pasted "field: value" text, as plain objects. */
export function parseInput(text: string, fieldMap: Record<string, string> = {}): Record<string, unknown>[] {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    const j = JSON.parse(t);
    return Array.isArray(j) ? j : Array.isArray(j.submissions) ? j.submissions : [j];
  }
  // Pasted text. Our field names (or the backend's, from meta.json) start a field; other lines continue the last one.
  const names = new Map(KEYS.map((k) => [squash(k), k]));
  for (const [ours, theirs] of Object.entries(fieldMap)) names.set(squash(theirs), ours);
  const out: Record<string, string> = {};
  let cur: string | null = null;
  for (const line of t.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][\w ]{0,30}?)\s*(?::|\t)\s*(.*)$/);
    const alone = names.get(squash(line));
    if (m && names.has(squash(m[1]))) { cur = names.get(squash(m[1]))!; out[cur] = m[2]; }
    else if (alone && line.trim().length < 32) { cur = alone; out[cur] = ""; }
    else if (cur) out[cur] = out[cur] ? `${out[cur]}\n${line}` : line;
  }
  return [out];
}

/** Map the backend's field names back onto ours. */
function rename(raw: Record<string, unknown>, fieldMap: Record<string, string>) {
  const back = Object.fromEntries(Object.entries(fieldMap).map(([ours, theirs]) => [theirs, ours]));
  return Object.fromEntries(Object.entries(raw).map(([k, v]) => [back[k] ?? k, v]));
}

/** Does a posting URL sit on the careers site (or a subdomain of it)? */
export function onBoard(url: string, board: string): boolean {
  const host = (u: string) => new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  const [u, b] = [host(url), host(board)];
  return u === b || u.endsWith(`.${b}`);
}

export interface SpottedContext {
  companies: { id: string; name: string }[];
  hiring: Record<string, { hasProgram: boolean }>;
  watch: Record<string, Pick<WatchEntry, "kind" | "board">>;
  fieldMap?: Record<string, string>;
  title?: string; // from --title; wins over what the student typed, since the moderator has opened the link
}

/**
 * Validate and normalize one submission. Returns { companyId, url, title, email, warnings }, or throws with every
 * reason it can't be added. Warnings are for the moderator to read before --write.
 */
export function normalize(input: Record<string, unknown>, { companies, hiring, watch, fieldMap = {}, title: given }: SpottedContext) {
  const raw = rename(input, fieldMap);
  const errors: string[] = [], warnings: string[] = [];
  if (raw._gotcha) errors.push("the spam trap field is filled in");
  if (raw.kind && tidy(raw.kind) !== "spotted") errors.push(`this is a "${tidy(raw.kind)}" submission, not an "it's live" report`);

  const co = tidy(raw.company).toLowerCase();
  const company = companies.find((c) => c.id === co || c.name.toLowerCase() === co);
  if (!company) errors.push(`unknown company: "${tidy(raw.company)}"`);
  else if (!hiring[company.id]) errors.push(`${company.id} is not in hiring.json`);
  else if (!hiring[company.id].hasProgram) errors.push(`${company.name} has no MBA program in hiring.json`);

  let url = tidy(raw.url);
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") errors.push(`the URL is not https: ${url}`);
    else if (u.username || u.password) errors.push("the URL has a login in it");
    else if (url.length > LIMITS.url) errors.push(`the URL is longer than ${LIMITS.url} characters`);
    else url = u.href;
  } catch {
    errors.push(url ? `not a URL: "${url}"` : "no URL");
  }

  const reported = clip(tidy(raw.title), LIMITS.title);
  const title = tidy(given) ? clip(tidy(given), LIMITS.title) : reported;
  if (!title) errors.push("no title: the form's title is optional, so pass --title=\"...\" after reading it off the posting");

  if (errors.length) throw new Error(errors.join("\n"));

  const id = company!.id;
  const entry = watch[id];
  if (!entry) warnings.push(`${id} is not in watch.json`);
  else {
    if (entry.kind !== "manual") warnings.push(`the watcher checks ${company!.name} itself (${entry.kind}); it will likely find this posting on its own`);
    if (!onBoard(url, entry.board)) warnings.push(`CHECK: the link is not on ${new URL(entry.board).hostname}, the board in watch.json`);
  }
  if (tidy(raw.title).length > LIMITS.title && !tidy(given)) warnings.push(`trimmed the title to ${LIMITS.title} characters`);
  if (/https?:\/\/|www\./i.test(title)) warnings.push("CHECK: the title contains a link");
  return { companyId: id, url, title, email: tidy(raw.email) || null, warnings };
}
