import type { CalendarMarker, Company, Cycle, Hiring, ISODate } from "@/data/types";
import { trailItems, type TrailItem } from "./marks";
import { addDays, dateAtWeek, daysBetween, fmtDate, fmtRange, monthOf, seasonEnd, typicalOpen } from "./season";
import { SITE, companyUrl } from "./share";

// The weekly Slack post (`npm run digest`): what's open, what's closing, what past cycles say is next, and the
// GSB dates coming up. Everything is computed from the data for the given date, with the same status rules as
// the page. Slack mrkdwn: *bold*, _italic_, <url|text> links. Each company is named once, as a link to its page.

export interface DigestInput {
  companies: Company[];
  hiring: Record<string, Hiring>;
  calendar: CalendarMarker[];
  cycle: Cycle;
  researched: ISODate; // when postings were last checked
  today: ISODate;
}

const HORIZON = 14; // days ahead
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const link = (c: Company) => `<${companyUrl(c.id)}|${esc(c.name)}>`;
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const relDays = (n: number) => (n === 0 ? "today" : n === 1 ? "tomorrow" : `in ${plural(n, "day")}`);
/** "Apple, Amazon and Intuit" */
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);
const when = (m: CalendarMarker) => (m.to ? fmtRange(m.from, m.to) : fmtDate(m.from));

export function digest({ companies, hiring, calendar, cycle, researched, today }: DigestInput): string {
  const end = addDays(today, HORIZON);
  const items = trailItems(companies, hiring, today, cycle);
  const of = (...marks: TrailItem["mark"][]) => items.filter((i) => marks.includes(i.mark));
  const window = (i: TrailItem) => hiring[i.company.id].windows.find((w) => w.cycle === cycle)!;
  const deadline = (i: TrailItem) => (i.daysLeft !== null ? addDays(today, i.daysLeft) : null);
  const out: string[] = [`*Big tech MBA internships, week of ${fmtDate(today)}*`];

  const age = daysBetween(researched, today);
  if (daysBetween(seasonEnd(cycle), today) > 0) out.push(`_The ${cycle}–${Number(cycle) + 1 - 2000} season is over, and the map hasn't moved on to the next one yet._`);
  else if (age > 10) out.push(`_Postings were last checked ${fmtDate(researched)}, ${plural(age, "day")} ago, so anything below may have moved._`);

  // Open now: newly opened first, then the rest in one line. Ones closing soon get their own section.
  const closing = of("closing").sort((a, b) => a.daysLeft! - b.daysLeft!);
  const open = of("open").sort((a, b) => window(b).from.localeCompare(window(a).from));
  const fresh = open.filter((i) => window(i).from >= addDays(today, -7));
  const rest = open.filter((i) => !fresh.includes(i));
  const note = (i: TrailItem, opened: boolean) => {
    const d = deadline(i);
    const bits = [opened ? fmtRange(window(i).from, window(i).to) : "", d ? `closes ${fmtDate(d)}` : ""].filter(Boolean);
    return bits.length ? ` (${bits.join(", ")})` : "";
  };
  out.push("", "*Open now*");
  if (fresh.length) out.push(`• New this week: ${list(fresh.map((i) => link(i.company) + note(i, true)))}`);
  if (rest.length) out.push(`• ${fresh.length ? "Still open" : "Open"}: ${list(rest.map((i) => link(i.company) + note(i, false)))}`);
  if (!open.length) out.push(closing.length ? "• Only the ones closing below." : "• Nothing open right now.");

  out.push("", "*Closing in the next two weeks*");
  if (closing.length) for (const i of closing) out.push(`• ${link(i.company)}: ${fmtDate(deadline(i)!)}, ${relDays(i.daysLeft!)}`);
  else out.push(`• No stated deadlines before ${fmtDate(end)}.`);

  // Not posted yet but due, or some past cycle had opened by the end of the horizon.
  const earliest = (i: TrailItem) => { const t = typicalOpen(hiring[i.company.id], cycle); return t ? dateAtWeek(t.min, cycle) : null; };
  const expected = items.filter((i) => i.mark === "due" || (i.mark === "later" && (earliest(i) ?? "9999") <= end)).sort((a, b) => a.week - b.week);
  const usual = (i: TrailItem) => monthOf(typicalOpen(hiring[i.company.id], cycle)!.week, cycle);
  out.push("", "*Expected to open in the next two weeks* _(estimates from past cycles, not announcements)_");
  for (const i of expected) out.push(`• ${link(i.company)}: ${i.mark === "due" ? "due any day, " : ""}usually ${usual(i)}`);
  if (!expected.length) out.push(`• Nothing, going by past cycles, before ${fmtDate(end)}.`);
  const late = of("late");
  if (late.length) out.push(`• Not posted yet, later than any past cycle: ${list(late.map((i) => link(i.company)))}`);

  // GSB dates: what's in force now, and what starts within the horizon.
  const recruiting = calendar.filter((m) => m.kind !== "academic").sort((a, b) => a.from.localeCompare(b.from));
  const ongoing = recruiting.filter((m) => m.to && m.from <= today && today <= m.to);
  const soon = recruiting.filter((m) => m.from > today && m.from <= end);
  const next = recruiting.find((m) => m.from > end);
  out.push("", "*At the GSB*");
  for (const m of ongoing) out.push(`• ${esc(m.label)} (until ${fmtDate(m.to!)})`);
  for (const m of soon) out.push(`• ${esc(m.label)} (${when(m)})`);
  if (!soon.length && next) out.push(`• Nothing else before ${fmtDate(end)}. Next is ${esc(next.label)} (${when(next)}).`);

  out.push("", `<${SITE}|Full map>, with sources for every date. Postings checked ${fmtDate(researched)}; confirm on the careers site before you count on one.`);
  return out.join("\n");
}
