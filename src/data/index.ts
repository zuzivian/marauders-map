import type { CalendarMarker, Company, Hiring, Interview, Meta, Prep, Role, Source } from "./types";
import companiesJson from "./companies.json";
import hiringJson from "./hiring.json";
import interviewsJson from "./interviews.json";
import rolesJson from "./roles.json";
import calendarJson from "./calendar.json";
import prepJson from "./prep.json";
import sourcesJson from "./sources.json";
import metaJson from "./meta.json";

// JSON imports widen string unions to `string`; the casts are checked at runtime by data.test.ts.
export const companies = companiesJson as unknown as Company[];
export const hiring = hiringJson as unknown as Record<string, Hiring>;
export const interviews = interviewsJson as unknown as Record<string, Interview>;
export const roles = rolesJson as unknown as Role[];
export const calendar = calendarJson as unknown as CalendarMarker[];
export const prep = prepJson as unknown as Prep;
export const sources = sourcesJson as unknown as Record<string, Source>;
export const meta = metaJson as unknown as Meta;

export const companyById = Object.fromEntries(companies.map((c) => [c.id, c])) as Record<string, Company>;
export const companyByName = Object.fromEntries(companies.map((c) => [c.name.toLowerCase(), c])) as Record<string, Company>;

export type { CalendarMarker, Company, Hiring, Interview, Meta, Prep, Role, Source };
