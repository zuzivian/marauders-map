import type { CalendarMarker, Change, Company, FirsthandReport, Hiring, Interview, Meta, Prep, Role, Source, VisaData, WatchEntry } from "./types";
import companiesJson from "./companies.json";
import hiringJson from "./hiring.json";
import interviewsJson from "./interviews.json";
import rolesJson from "./roles.json";
import calendarJson from "./calendar.json";
import prepJson from "./prep.json";
import sourcesJson from "./sources.json";
import metaJson from "./meta.json";
import firsthandJson from "./firsthand.json";
import visaJson from "./visa.json";
import changesJson from "./changes.json";
import watchJson from "./watch.json";

// JSON imports widen string unions to `string`; the casts are checked at runtime by data.test.ts.
export const companies = companiesJson as unknown as Company[];
export const hiring = hiringJson as unknown as Record<string, Hiring>;
export const interviews = interviewsJson as unknown as Record<string, Interview>;
export const roles = rolesJson as unknown as Role[];
export const calendar = calendarJson as unknown as CalendarMarker[];
export const prep = prepJson as unknown as Prep;
export const sources = sourcesJson as unknown as Record<string, Source>;
export const meta = metaJson as unknown as Meta;
export const firsthand = firsthandJson as unknown as Record<string, FirsthandReport[]>; // keyed by company id
export const visa = visaJson as unknown as VisaData; // H-1B filings by company, from scripts/refresh-lca.py
export const changes = changesJson as unknown as Change[]; // the watcher's log, oldest first
export const watch = watchJson as unknown as Record<string, WatchEntry>; // keyed by company id

export const companyById = Object.fromEntries(companies.map((c) => [c.id, c])) as Record<string, Company>;
export const companyByName = Object.fromEntries(companies.map((c) => [c.name.toLowerCase(), c])) as Record<string, Company>;

export type { CalendarMarker, Change, Company, FirsthandReport, Hiring, Interview, Meta, Prep, Role, Source, VisaData };
