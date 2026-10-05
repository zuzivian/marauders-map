import { calendar, companies, companyById, hiring, meta, sources, type CalendarMarker } from "@/data";
import type { Cycle, Hiring, ISODate, Posting } from "@/data/types";
import { dateAtWeek, fmtDate, monthOf, typicalOpen } from "./season";
import { statusOf } from "./status";
import { prose } from "./format";
import { buildIcs, icsDate, type IcsEvent } from "./ics";

// Exports into the student's own tools: rows for their tracker (CSV / tab-separated for pasting) and calendar
// feeds. The site knows the market; their tracker knows their relationships. These feed it, they don't replace it.

export const SITE_URL = "https://marauders-map.natwong.dev";
const HOST = new URL(SITE_URL).host;
const cycle = meta.currentCycle;

/** A company's own guide page (built by the share pages). */
export const companyGuideUrl = (id: string) => `${SITE_URL}/c/${id}/`;
/** Where a calendar feed lives: "all" or a company id. */
export const calPath = (id: string) => `/cal/${id}.ics`;
/** webcal:// makes calendar apps offer to subscribe rather than import once. */
export const webcalUrl = (path: string) => `webcal://${HOST}${path}`;

/** Companies that get their own feed: everyone with an MBA internship program. */
export const feedIds = companies.filter((c) => hiring[c.id].hasProgram).map((c) => c.id);

/** Ids in the order the timing chart uses: by when applications usually open. */
export function inOpeningOrder(ids: Iterable<string>) {
  const wk = (id: string) => typicalOpen(hiring[id], cycle)?.week ?? 99;
  return [...ids].filter((id) => companyById[id]).sort((a, b) => wk(a) - wk(b));
}

/** This cycle's latest stated deadline, the same date the status line counts down to. */
function closesOf(h: Hiring, c: Cycle) {
  const now = h.windows.find((w) => w.cycle === c);
  return [now?.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean).sort().at(-1) as ISODate | undefined;
}
const urlsOf = (h: Hiring) => [...new Set(h.current.postings.map((p) => p.url))];

/* ---- tracker rows ---- */

export function trackerRows(ids: string[], today: ISODate): string[][] {
  const head = ["Company", `Status (as of ${fmtDate(today, { year: true })})`, "Usually opens", "Opened this cycle", "Closes", "Posting URLs", "How postings behave", "Guide"];
  const rows = ids.map((id) => {
    const c = companyById[id], h = hiring[id];
    const now = h.windows.find((w) => w.cycle === cycle);
    const t = h.hasProgram ? typicalOpen(h, cycle) : null;
    const usual = !t ? "" : t.max - t.min >= 1 ? `${monthOf(t.week, cycle)} (${monthOf(t.min, cycle)} – ${monthOf(t.max, cycle)})` : monthOf(t.week, cycle);
    return [
      c.name,
      statusOf(h, today, cycle).headline,
      usual,
      now ? (now.from === now.to ? now.from : `${now.from} to ${now.to}`) : "",
      closesOf(h, cycle) ?? (now ? "no stated deadline" : ""),
      urlsOf(h).join(" "),
      h.pattern,
      companyGuideUrl(id),
    ];
  });
  return [head, ...rows];
}

// Spreadsheets run cells that start with these as formulas; a leading apostrophe keeps them text.
const defuse = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : s);

/** RFC 4180 CSV: CRLF rows, fields quoted when they hold a comma, quote or line break. */
export function toCsv(rows: string[][]) {
  const cell = (s: string) => {
    const v = defuse(s);
    return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  return rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

/** Tab-separated text for the clipboard: pastes into Sheets, Excel, Notion and Airtable as rows and columns. */
export function toTsv(rows: string[][]) {
  return rows.map((r) => r.map((s) => defuse(s.replace(/[\t\r\n]+/g, " "))).join("\t")).join("\n");
}

/* ---- calendar events ---- */

const uid = (key: string) => `${key}@${HOST}`;
const postingList = (ps: Posting[]) => ps.map((p) => `• ${p.title}: ${p.url}`).join("\n");

/** One company's events: when this cycle's postings went live and their deadlines, or, if nothing is posted yet, an estimate. */
export function companyEvents(id: string): IcsEvent[] {
  const c = companyById[id], h = hiring[id];
  if (!h.hasProgram) return [];
  const guide = companyGuideUrl(id);
  const tail = [`How postings behave: ${h.pattern}.`, `Details and sources: ${guide}`];
  const now = h.windows.find((w) => w.cycle === cycle);

  if (now) {
    const events: IcsEvent[] = [{
      uid: uid(`${cycle}-${id}-opened`),
      date: now.from,
      summary: `${c.name}: MBA internship postings went live`,
      description: [
        now.from === now.to
          ? `Postings went live ${fmtDate(now.from, { year: true })} (${now.evidence} evidence).`
          : `Postings went live between ${fmtDate(now.from)} and ${fmtDate(now.to, { year: true })} (${now.evidence} evidence); this event sits on the earliest date.`,
        postingList(h.current.postings),
        ...tail,
      ].filter(Boolean).join("\n\n"),
      url: guide,
    }];
    // One event per stated deadline, listing the postings that close that day.
    const byDate = new Map<ISODate, Posting[]>();
    for (const p of h.current.postings) if (p.closes) byDate.set(p.closes, [...(byDate.get(p.closes) ?? []), p]);
    if (now.closes && !byDate.has(now.closes)) byDate.set(now.closes, []);
    for (const [date, ps] of byDate)
      events.push({
        uid: uid(`${cycle}-${id}-closes-${icsDate(date)}`),
        date,
        summary: `${c.name}: MBA internship applications close`,
        description: [`Stated deadline ${fmtDate(date, { year: true })}.`, postingList(ps), ...tail].filter(Boolean).join("\n\n"),
        url: ps.length === 1 ? ps[0].url : guide,
      });
    return events;
  }

  const t = typicalOpen(h, cycle);
  if (!t) return [];
  const lo = dateAtWeek(t.min, cycle), hi = dateAtWeek(t.max, cycle);
  return [{
    uid: uid(`${cycle}-${id}-expected`),
    date: dateAtWeek(t.week, cycle),
    summary: `${c.name}: MBA internship expected to open (estimate)`,
    description: [
      "An estimate from past cycles, not a posted date.",
      lo === hi
        ? `Based on ${t.n === 1 ? "one past cycle" : `${t.n} past cycles`}: postings went live around ${fmtDate(lo)} (shifted onto this year's calendar).`
        : `In ${t.n} past cycles, postings went live between about ${fmtDate(lo)} and ${fmtDate(hi)} (shifted onto this year's calendar); this date is their average.`,
      statusOf(h, h.current.checked, cycle).detail,
      ...tail,
    ].join("\n\n"),
    url: guide,
  }];
}

/** The GSB recruiting calendar's dates (classes starting and the like are left out). */
export function gsbEvents(markers: CalendarMarker[] = calendar): IcsEvent[] {
  return markers
    .filter((m) => m.kind !== "academic")
    .map((m) => {
      const urls = [...new Set(m.sources.map((s) => sources[s].url))];
      return {
        uid: uid(`${cycle}-gsb-${m.id}`),
        date: m.from,
        end: m.to ?? undefined,
        summary: `GSB: ${m.label}`,
        description: [prose(m.description), m.confidence !== "high" ? `${m.confidence[0].toUpperCase()}${m.confidence.slice(1)} confidence.` : "", `Source: ${urls.join(" ")}`]
          .filter(Boolean).join("\n\n"),
        url: urls[0],
      };
    });
}

const byDate = (a: IcsEvent, b: IcsEvent) => a.date.localeCompare(b.date) || a.uid.localeCompare(b.uid);
const season = `${cycle}–${Number(cycle) + 1 - 2000}`;
const about = `Estimates come from past cycles and say so; confirm on the careers site. ${SITE_URL}`;

/** /cal/all.ics: every company, plus the GSB calendar. */
export const allFeed = () =>
  buildIcs({
    name: "Big tech MBA internships · Marauder's Map",
    description: `Big tech MBA internship deadlines, estimated openings, and GSB recruiting dates, ${season}. ${about}`,
    stamp: meta.researched,
    events: [...feedIds.flatMap(companyEvents), ...gsbEvents()].sort(byDate),
  });

/** /cal/<id>.ics */
export const companyFeed = (id: string) =>
  buildIcs({
    name: `${companyById[id].name} MBA internship · Marauder's Map`,
    description: `${companyById[id].name} MBA internship postings and deadlines, ${season}. ${about}`,
    stamp: meta.researched,
    events: companyEvents(id).sort(byDate),
  });

/** A one-time import for the reader's starred companies; a static host can't serve per-reader feeds. */
export const myListFeed = (ids: string[]) =>
  buildIcs({
    name: "My list · Marauder's Map",
    description: `MBA internship deadlines and estimated openings for ${ids.map((id) => companyById[id].name).join(", ")}, ${season}. A one-time import: download it again for updates. ${about}`,
    stamp: meta.researched,
    events: ids.filter((id) => feedIds.includes(id)).flatMap(companyEvents).sort(byDate),
  });
