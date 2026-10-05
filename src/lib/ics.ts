import type { ISODate } from "@/data/types";
import { addDays } from "./season";

// A small RFC 5545 (iCalendar) writer for all-day events: enough for calendar feeds that Google Calendar,
// Apple Calendar and Outlook subscribe to. Lines end in CRLF and fold at 75 octets.

export interface IcsEvent {
  uid: string; // stable across builds, so re-subscribing or re-importing updates the event instead of duplicating it
  date: ISODate; // all-day start
  end?: ISODate; // last day, inclusive (multi-day events)
  summary: string;
  description?: string;
  url?: string;
}

export interface IcsCalendar {
  name: string;
  description: string;
  stamp: ISODate; // DTSTAMP for every event; a fixed date keeps builds reproducible
  events: IcsEvent[];
}

/** Escape a TEXT value: backslash, semicolon, comma, and newlines (RFC 5545 §3.3.11). */
export function escapeText(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r\n|\r|\n/g, "\\n");
}

const octets = (ch: string) => {
  const cp = ch.codePointAt(0)!;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
};

/** Fold a content line at 75 octets, never inside a multi-byte character; continuation lines start with a space. */
export function foldLine(line: string) {
  const out: string[] = [];
  let cur = "", n = 0;
  for (const ch of line) {
    const k = octets(ch);
    if (n + k > 75) {
      out.push(cur);
      cur = " ";
      n = 1;
    }
    cur += ch;
    n += k;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** 2026-10-20 → 20261020, the DATE value type. */
export const icsDate = (iso: ISODate) => iso.replace(/-/g, "");

function eventLines(e: IcsEvent, stamp: ISODate) {
  return [
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${icsDate(stamp)}T000000Z`,
    `DTSTART;VALUE=DATE:${icsDate(e.date)}`,
    `DTEND;VALUE=DATE:${icsDate(addDays(e.end ?? e.date, 1))}`, // DTEND is exclusive for all-day events
    `SUMMARY:${escapeText(e.summary)}`,
    ...(e.description ? [`DESCRIPTION:${escapeText(e.description)}`] : []),
    ...(e.url ? [`URL:${e.url}`] : []),
    "TRANSP:TRANSPARENT", // deadlines and estimates shouldn't mark the reader busy
    "END:VEVENT",
  ];
}

export function buildIcs(cal: IcsCalendar) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Marauder's Map//Big tech MBA recruiting//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `NAME:${escapeText(cal.name)}`,
    `X-WR-CALNAME:${escapeText(cal.name)}`,
    `DESCRIPTION:${escapeText(cal.description)}`,
    `X-WR-CALDESC:${escapeText(cal.description)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:P1D",
    "X-PUBLISHED-TTL:P1D",
    ...cal.events.flatMap((e) => eventLines(e, cal.stamp)),
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
