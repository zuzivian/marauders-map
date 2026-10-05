// Pure logic for the posting watcher (scripts/watch-postings.mjs): turning careers-site API responses into jobs,
// deciding which are MBA internships for the current cycle, diffing them against hiring.json, inferring an
// application window, and writing the report. No network and no file access here, so it is unit-tested against
// recorded responses (src/lib/watch.test.ts).
//
// Node runs this file directly (type stripping), so it may only use erasable TypeScript and type-only imports.

import type { Change, Cycle, Evidence, Hiring, ISODate, Posting, Source, WatchEntry, WatchKind, WindowObs } from "../data/types";

/** A job as read from any careers API, normalised. */
export interface Job {
  key: string; // the ATS's id for the posting; also what keyFromUrl() extracts from its URL
  ref?: string; // the id the company shows people, when it differs (Microsoft's job number)
  title: string;
  url: string; // the public posting page
  posted: ISODate | null; // only when the API states it
  closes: ISODate | null; // only when the API states it
  countries: string[]; // "US" for the United States, otherwise whatever the API calls the country
  location: string;
  intern?: boolean; // the ATS's own employment-type flag, when it has one
  tags?: string[]; // ATS labels that read like part of the title (TikTok's "MBA Intern - 2027 Start")
  text?: string; // description and qualifications, as plain text, when fetched
}

// ── dates ────────────────────────────────────────────────────────────────────────────────────────────────

const DAY = 86_400_000;
const utc = (iso: ISODate) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
export const daysBetween = (a: ISODate, b: ISODate) => Math.round((utc(b) - utc(a)) / DAY);
export const seasonStart = (cycle: Cycle | string) => `${cycle}-05-01`;
export const seasonEnd = (cycle: Cycle | string) => `${Number(cycle) + 1}-03-31`;

/** The US Pacific calendar date of an instant: careers sites are US-based, and a 5pm PT posting shouldn't read as tomorrow. */
export function pacificDate(when: Date | string | number): ISODate {
  const d = typeof when === "number" ? new Date(when < 1e12 ? when * 1000 : when) : new Date(when);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "August  4, 2026", "Oct 02, 2026", "2026-9-11" → ISO. Null when it can't tell. */
export function parseDate(s: string | null | undefined): ISODate | null {
  if (!s) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s.trim());
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const m = /([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (!m) return null;
  const mi = MONTHS.findIndex((x) => x.startsWith(m[1].toLowerCase().slice(0, 3)));
  return mi < 0 ? null : `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

// ── text ─────────────────────────────────────────────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—" };
export const decode = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m);
/** HTML to one line of plain text. */
export const plain = (html: string | null | undefined) =>
  decode((html ?? "").replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|li|div|h\d)>/gi, ". ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
export const normTitle = (t: string) => t.toLowerCase().replace(/[–—-]/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
export const slug = (t: string) => normTitle(t).replace(/ /g, "-");

// ── locations ────────────────────────────────────────────────────────────────────────────────────────────

const US_NAMES = /^(us|usa|u\.s\.a?\.?|united states( of america)?)$/i;
const US_STATES =
  "Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia";
const US_TEXT = new RegExp(`\\b(United States|USA|U\\.S\\.|${US_STATES})\\b|,\\s*(CA|NY|WA|TX|MA|IL|GA|NC|CO|UT|OR|VA|FL|DC|NJ|PA|MN|AZ|AR|MI|OH|TN)\\b|^US\\b|\\bUS$`);

const ABROAD =
  /\b(Canada|Mexico|Brazil|Argentina|Chile|Colombia|Costa Rica|United Kingdom|UK|England|Scotland|Ireland|Germany|France|Spain|Portugal|Italy|Netherlands|Belgium|Switzerland|Austria|Sweden|Norway|Denmark|Finland|Poland|Czechia|Czech Republic|Romania|Hungary|Greece|Turkey|Israel|United Arab Emirates|Saudi Arabia|Egypt|Morocco|South Africa|Nigeria|Kenya|India|China|Hong Kong|Taiwan|Japan|Korea|Singapore|Malaysia|Indonesia|Thailand|Vietnam|Philippines|Australia|New Zealand|London|Dublin|Paris|Munich|Berlin|Toronto|Vancouver|Bangalore|Bengaluru|Hyderabad|Shanghai|Beijing|Tokyo|Sydney)\b/i;

export const countryCode = (name: string) => (US_NAMES.test(name.trim()) ? "US" : name.trim());

/** True when a job is (or may be) in the US. Unknown locations count as US, so nothing is dropped on a guess. */
export function inUS(job: Pick<Job, "countries" | "location">): boolean {
  if (job.countries.length) return job.countries.some((c) => countryCode(c) === "US");
  if (!job.location || /multiple locations|^\d+ locations$/i.test(job.location.trim())) return true;
  return US_TEXT.test(job.location) || !ABROAD.test(job.location); // "Remote", a bare US city: can't tell, keep it
}

// ── classification ───────────────────────────────────────────────────────────────────────────────────────

const MBA = /\bMBAs?\b|Master of Business Administration|\bM\.B\.A\b/i;
const INTERN = /\bintern(s|ship|ships)?\b|\bco-?op\b/i;
/** Degree words in a title that mean the posting is for someone else (only consulted when the title doesn't say MBA). */
const OTHER_DEGREE = /\b(under ?grad(uate)?s?|bachelor'?s?|BS|MS|PhD|masters?|master's|high school|apprentice(ship)?s?)\b/i;
/** Description wording that makes an MBA a requirement or the target, not a passing mention. */
const MBA_REQUIRED = [
  /\b(pursuing|enrolled in|candidates? for|completing|working towards?|currently in|student in|attending)\b[^.;]{0,50}?\b(MBA|Master of Business Administration)\b/i,
  /\b(MBA|Master of Business Administration)\s+(candidates?|students?|programs?|degree)\b[^.;]{0,80}?\b(graduat\w*|20\d\d|expected|anticipated|enrolled|pursuing|returning)/i,
  /\b(first|1st|second|2nd)[- ]year (full[- ]time )?MBA\b/i,
  /\bMBA\b[^.;]{0,20}\b(required|requirement|only)\b/i,
  /\b(requires?|required|must (have|be))\b[^.;]{0,40}\b(MBA|Master of Business Administration)\b/i,
  /\bMBA (intern|internship)s?\b/i,
];

const NOT_MBA = /\b(not|non|no|excluding|except)[\s-]+(an?\s+)?(MBA|Master of Business Administration)s?\b/gi;

export type Verdict =
  | { match: true; basis: "title" | "requirement" }
  | { match: false; reason: "not an internship" | "full-time MBA role" | "no MBA" | "other degree" | "other cycle" | "MBA mentioned only in passing" };

/**
 * Is this an MBA internship for the cycle's summer (cycle "2026" → summer 2027)?
 *
 * - intern: the title says intern/internship/co-op, or the ATS flags it as an internship
 * - cycle: any year in the title must be the internship summer (so "Summer 2026" leftovers and "2026 Start" off-cycle
 *   roles drop out); with no year, a stated posting date must fall inside the season
 * - MBA: the title (or an ATS label) says MBA; otherwise the description must require or target an MBA, and the title
 *   must not name another degree. A bare mention ("bachelor's, master's, MBA or PhD") is reported, not added.
 */
export function classify(job: Job, cycle: Cycle | string): Verdict {
  const head = [job.title, ...(job.tags ?? [])].join(" · ");
  if (!INTERN.test(head) && !job.intern) return { match: false, reason: MBA.test(head) ? "full-time MBA role" : "not an internship" };
  const years = [...head.matchAll(/\b20\d\d\b/g)].map((m) => m[0]);
  const summer = String(Number(cycle) + 1);
  if (years.length && !years.includes(summer)) return { match: false, reason: "other cycle" };
  if (!years.length && job.posted && (job.posted < seasonStart(cycle) || job.posted > seasonEnd(cycle))) return { match: false, reason: "other cycle" };
  if (MBA.test(head)) return { match: true, basis: "title" };
  if (OTHER_DEGREE.test(job.title)) return { match: false, reason: "other degree" };
  const text = (job.text ?? "").replace(NOT_MBA, " "); // "(Bachelor/Master - not MBA)" is the opposite of a requirement
  if (MBA_REQUIRED.some((r) => r.test(text))) return { match: true, basis: "requirement" };
  if (MBA.test(text)) return { match: false, reason: "MBA mentioned only in passing" };
  return { match: false, reason: "no MBA" };
}

/** Worth fetching the job's detail page to classify it (an internship whose title neither says MBA nor rules it out). */
export const needsDetail = (job: Job) => (INTERN.test(job.title) || !!job.intern) && !MBA.test([job.title, ...(job.tags ?? [])].join(" ")) && !OTHER_DEGREE.test(job.title) && job.text === undefined;
/** Engineering, research and design internships: an "any degree, including MBA" line there isn't worth a person's time. */
export const technicalRole = (title: string) => /\b(software|engineer(ing)?|developer|scientist|research(er)?|design(er)?|data science|hardware|firmware|machine learning)\b/i.test(title);
export const looksLikeIntern =(job: Pick<Job, "title" | "intern">) => INTERN.test(job.title) || !!job.intern;

/** "EMEA" when a posting is limited to students at schools in a region, like Google's London/Dublin MBA internships. */
export function regionOnly(job: Pick<Job, "text">): string | null {
  return /\bprograms?\s+(?:located\s+)?in\s+the\s+(EMEA|APAC|LATAM)\b/i.exec(job.text ?? "")?.[1]?.toUpperCase() ?? null;
}

// ── ids ──────────────────────────────────────────────────────────────────────────────────────────────────

/** The ATS id in a posting URL, in the same form the parsers below use for `Job.key`. Null when the URL has none. */
export function keyFromUrl(kind: WatchKind, url: string): string | null {
  const pick = (...res: RegExp[]) => {
    for (const r of res) {
      const m = r.exec(url);
      if (m) return m[1];
    }
    return null;
  };
  switch (kind) {
    case "greenhouse": return pick(/[?&]gh_jid=(\d+)/, /\/(?:jobs|positions)\/(\d{6,})(?:[/?#]|$)/); // not the "2027" of a slug URL
    case "ashby": return pick(/jobs\.ashbyhq\.com\/[^/]+\/([0-9a-f-]{36})/);
    case "workday": return pick(/_([A-Z]*-?\d+[A-Z]?)(?:-\d+)?(?:[/?#]|$)/);
    case "amazon": return pick(/\/jobs\/(\d+)/);
    case "eightfold": return pick(/\/job\/(\d+)/, /[?&]pid=(\d+)/);
    case "apple": return pick(/\/details\/(\d+)/);
    case "google": return pick(/\/results\/(\d+)/);
    case "tiktok": return pick(/\/search\/(\d+)/, /\/position\/(?:detail\/)?(\d+)/);
    case "smartrecruiters": return pick(/\/(\d{12,})(?:[-/?]|$)/);
    case "oracle-hcm": return pick(/\/job\/(\d+)/, /Id=%22(\d+)%22/);
    case "ibm": return pick(/[?&]jobId=(\d+)/, /\/(\d+)(?:[/?]|$)/);
    case "radancy": return pick(/\/(\d+)\/?(?:[?#]|$)/);
    default: return null;
  }
}

// ── parsers: one per API, from a recorded or live response to Job[] ──────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party API payloads, checked field by field */

export function parseGreenhouse(raw: any): Job[] {
  return (raw?.jobs ?? []).map((j: any) => ({
    key: String(j.id),
    title: String(j.title).trim(),
    url: j.absolute_url,
    posted: j.first_published ? pacificDate(j.first_published) : null,
    closes: null,
    countries: [],
    location: j.location?.name ?? "",
    intern: (j.metadata ?? []).some((m: any) => m?.name === "Job Level" && [m.value].flat().some((v: any) => /intern/i.test(String(v)))) || undefined,
    text: j.content !== undefined ? plain(decode(j.content)) : undefined,
  }));
}

export function parseAshby(raw: any): Job[] {
  return (raw?.jobs ?? [])
    .filter((j: any) => j.isListed !== false)
    .map((j: any) => ({
      key: j.id,
      title: String(j.title).trim(),
      url: j.jobUrl,
      posted: j.publishedAt ? pacificDate(j.publishedAt) : null,
      closes: null,
      countries: [j.address?.postalAddress?.addressCountry, ...(j.secondaryLocations ?? []).map((l: any) => l.address?.addressCountry)].filter(Boolean).map(countryCode),
      location: [j.location, ...(j.secondaryLocations ?? []).map((l: any) => l.location)].filter(Boolean).join("; "),
      intern: j.employmentType === "Intern" || undefined,
      text: j.descriptionPlain ?? (j.descriptionHtml ? plain(j.descriptionHtml) : undefined),
    }));
}

/** Workday CXS: `/wday/cxs/<tenant>/<site>/jobs` → `https://<host>/<site>` is the public site. */
export const workdayPublicBase = (endpoint: string) => endpoint.replace(/\/wday\/cxs\/[^/]+\/([^/]+)\/jobs\/?$/, "/$1");

export function parseWorkdayList(raw: any, endpoint: string): Job[] {
  const base = workdayPublicBase(endpoint);
  return (raw?.jobPostings ?? [])
    .filter((j: any) => j.externalPath)
    .map((j: any) => ({
      key: keyFromUrl("workday", j.externalPath) ?? j.bulletFields?.[0] ?? j.externalPath,
      title: String(j.title).trim(),
      url: base + j.externalPath,
      posted: null,
      closes: null,
      countries: [],
      location: j.locationsText ?? "",
    }));
}

/** Facet values that mean "internship", to list only interns (`workerSubType` "Intern (Fixed Term)", Visa's jobFamily "Intern"). */
export function workdayInternFacets(raw: any): Record<string, string[]> | null {
  const flat: any[] = [];
  const walk = (fs: any[]) => fs?.forEach((f) => (f.values?.some((v: any) => v.facetParameter) ? walk(f.values) : flat.push(f)));
  walk(raw?.facets ?? []);
  const hits = flat.flatMap((f) => (f.values ?? []).filter((v: any) => /\bintern(s|ship)?\b/i.test(v.descriptor ?? "")).map((v: any) => ({ param: f.facetParameter as string, id: v.id as string })));
  if (!hits.length) return null;
  const param = hits.some((h) => h.param === "workerSubType") ? "workerSubType" : hits[0].param; // one facet only: Workday ANDs across facets
  return { [param]: hits.filter((h) => h.param === param).map((h) => h.id) };
}

export function parseWorkdayDetail(raw: any, job: Job): Job {
  const i = raw?.jobPostingInfo;
  if (!i) return job;
  const country = i.jobRequisitionLocation?.country?.alpha2Code ?? i.country?.descriptor;
  return {
    ...job,
    title: String(i.title ?? job.title).trim(),
    posted: parseDate(i.startDate) ?? job.posted,
    closes: parseDate(i.endDate) ?? job.closes,
    countries: country ? [countryCode(country)] : job.countries,
    location: [i.location, ...(i.additionalLocations ?? [])].filter(Boolean).join("; ") || job.location,
    text: plain(i.jobDescription),
  };
}

export function parseAmazon(raw: any): Job[] {
  return (raw?.jobs ?? []).map((j: any) => ({
    key: String(j.id_icims),
    title: String(j.title).trim(),
    url: `https://www.amazon.jobs${j.job_path}`,
    posted: parseDate(j.posted_date),
    closes: null,
    countries: j.country_code ? [j.country_code === "USA" ? "US" : j.country_code] : [],
    location: j.normalized_location ?? j.location ?? "",
    text: plain([j.basic_qualifications, j.preferred_qualifications, j.description].filter(Boolean).join(" ")),
  }));
}

/** Eightfold PCSX (Microsoft careers): search positions. */
export function parseEightfoldSearch(raw: any, origin: string): Job[] {
  return (raw?.data?.positions ?? []).map((p: any) => ({
    key: String(p.id),
    ref: p.displayJobId ? String(p.displayJobId) : undefined,
    title: String(p.name).trim(),
    url: `${origin}/careers/job/${p.id}`,
    posted: p.postedTs ? pacificDate(p.postedTs) : null,
    closes: null,
    countries: (p.standardizedLocations ?? []).map((l: string) => countryCode(l.split(",").at(-1) ?? l)),
    location: (p.locations ?? []).join("; "),
  }));
}

export function parseEightfoldDetail(raw: any, job: Job): Job {
  const d = raw?.data;
  if (!d || !d.id) return job;
  return { ...job, intern: /intern/i.test(String(d.efcustomTextEmploymentType ?? "")) || job.intern, text: plain(d.jobDescription) };
}

/** jobs.apple.com renders search results server-side into `window.__staticRouterHydrationData`. */
export function parseApple(html: string): Job[] {
  const m = /window\.__staticRouterHydrationData\s*=\s*JSON\.parse\(("(?:[^"\\]|\\.)*")\)/.exec(html);
  if (!m) throw new Error("Apple search page has no hydration data (layout changed?)");
  const data = JSON.parse(JSON.parse(m[1]));
  const results = data?.loaderData?.search?.searchResults;
  if (!Array.isArray(results)) throw new Error("Apple hydration data has no searchResults");
  return results.map((r: any) => ({
    key: String(r.positionId),
    ref: String(r.id),
    title: String(r.postingTitle).trim(),
    url: `https://jobs.apple.com/en-us/details/${r.id}/${r.transformedPostingTitle}`,
    posted: r.postDateInGMT ? pacificDate(r.postDateInGMT) : parseDate(r.postingDate),
    closes: null,
    countries: (r.locations ?? []).map((l: any) => countryCode(l.countryName ?? "")).filter(Boolean),
    location: (r.locations ?? []).map((l: any) => l.name).join("; "),
    text: plain(r.jobSummary),
  }));
}

/** Google Careers renders results into an `AF_initDataCallback({key: 'ds:1', ...})` array. Field positions are Google's. */
export function parseGoogle(html: string): Job[] {
  const m = /AF_initDataCallback\(\{key: 'ds:1',[\s\S]*?data:([\s\S]*?), sideChannel: \{\}\}\);<\/script>/.exec(html);
  if (!m) throw new Error("Google results page has no ds:1 data (layout changed?)");
  const rows = JSON.parse(m[1])?.[0] ?? [];
  return rows.map((r: any[]) => {
    const howToApply = plain(r[15]?.[1]);
    const closes = /before\s+([A-Z][a-z]+ \d{1,2},? \d{4})/.exec(howToApply)?.[1];
    return {
      key: String(r[0]),
      title: String(r[1]).trim(),
      url: `https://www.google.com/about/careers/applications/jobs/results/${r[0]}-${slug(String(r[1]))}`,
      posted: r[12]?.[0] ? pacificDate(r[12][0]) : null,
      closes: parseDate(closes),
      countries: (r[9] ?? []).map((l: any[]) => countryCode(String(l[5] ?? ""))).filter(Boolean),
      location: (r[9] ?? []).map((l: any[]) => l[0]).join("; "),
      text: [r[3]?.[1], r[4]?.[1], r[10]?.[1], r[15]?.[1], r[19]?.[1]].map(plain).join(" "),
    };
  });
}

export function parseTikTok(raw: any): Job[] {
  const country = (c: any): string => (c?.parent ? country(c.parent) : (c?.en_name ?? ""));
  return (raw?.data?.job_post_list ?? []).map((p: any) => ({
    key: String(p.id),
    title: String(p.title).trim(),
    url: `https://lifeattiktok.com/search/${p.id}`,
    posted: null, // the API gives none; the id encodes a creation time, but that's inference, not a posted date
    closes: null,
    countries: p.city_info ? [countryCode(country(p.city_info))] : [],
    location: p.city_info?.en_name ?? "",
    intern: p.recruit_type?.en_name === "Intern" || undefined,
    tags: p.job_subject?.en_name ? [p.job_subject.en_name] : [],
    text: plain([p.description, p.requirement].filter(Boolean).join(" ")),
  }));
}

export function parseSmartRecruiters(raw: any, company: string): Job[] {
  return (raw?.content ?? []).map((p: any) => ({
    key: String(p.id),
    title: String(p.name).trim(),
    url: `https://jobs.smartrecruiters.com/${company}/${p.id}-${slug(String(p.name))}`,
    posted: p.releasedDate ? pacificDate(p.releasedDate) : null,
    closes: null,
    countries: p.location?.country ? [countryCode(p.location.country === "us" ? "US" : String(p.location.country).toUpperCase())] : [],
    location: p.location?.fullLocation ?? p.location?.city ?? "",
    intern: p.typeOfEmployment?.id === "intern" || undefined,
  }));
}

/** A SmartRecruiters posting. Closed postings still answer 200, with `active: false`. */
export function parseSmartRecruitersDetail(raw: any, job: Job): Job & { active: boolean } {
  const sections = raw?.jobAd?.sections ?? {};
  const text = plain(["jobDescription", "qualifications", "additionalInformation"].map((k) => sections[k]?.text ?? "").join(" "));
  return { ...job, text: text || job.text, active: raw?.active !== false };
}

/** Oracle Recruiting Cloud (Dell): `recruitingCEJobRequisitions` search. `jobBase` is the candidate site, e.g. …/sites/careers. */
export function parseOracle(raw: any, jobBase: string): Job[] {
  return (raw?.items?.[0]?.requisitionList ?? []).map((r: any) => ({
    key: String(r.Id),
    title: String(r.Title).trim(),
    url: `${jobBase}/job/${r.Id}`,
    posted: parseDate(r.PostedDate),
    closes: parseDate(r.PostingEndDate?.slice?.(0, 10)),
    countries: r.PrimaryLocationCountry ? [countryCode(r.PrimaryLocationCountry)] : [],
    location: r.PrimaryLocation ?? "",
  }));
}

export function parseOracleDetail(raw: any, job: Job): Job {
  const d = raw?.items?.[0];
  if (!d) return job;
  return {
    ...job,
    closes: parseDate(d.ExternalPostedEndDate?.slice(0, 10)) ?? job.closes, // the date as Oracle states it (midnight Central, stored as 05:00Z)
    intern: d.RequisitionType === "Intern" || job.intern,
    text: plain([d.ExternalDescriptionStr, d.ExternalQualificationsStr, d.ExternalResponsibilitiesStr].filter(Boolean).join(" ")),
  };
}

/** IBM's careers search (an Elasticsearch-style index behind ibm.com/careers/search). */
export function parseIbm(raw: any): Job[] {
  return (raw?.hits?.hits ?? []).map((h: any) => {
    const s = h._source ?? {};
    return {
      key: String(s.field_text_01),
      title: String(s.title).trim(),
      url: `https://careers.ibm.com/en_US/careers/JobDetail?jobId=${s.field_text_01}`,
      posted: null,
      closes: null,
      countries: s.field_keyword_05 ? [countryCode(s.field_keyword_05)] : [],
      location: s.field_keyword_19 ?? "",
      intern: s.field_keyword_18 === "Internship" || undefined,
      text: s.body !== undefined ? plain(s.body) : undefined,
    };
  });
}

/** Radancy TalentBrew (jobs.intuit.com): `/search-jobs/results` returns the result list as HTML inside JSON. */
export function parseRadancy(raw: any, origin: string): Job[] {
  const html: string = raw?.results ?? "";
  return [...html.matchAll(/<li[^>]*>\s*<a href="([^"]+)"[^>]*data-title="([^"]*)"[\s\S]*?<\/a>/g)].map((m) => {
    const loc = /class="job-location">([^<]*)</.exec(m[0])?.[1] ?? "";
    return {
      key: keyFromUrl("radancy", m[1]) ?? m[1],
      title: decode(m[2]).trim(),
      url: origin + m[1],
      posted: null,
      closes: null,
      countries: [],
      location: decode(loc).trim(),
    };
  });
}

/** A Radancy job page: schema.org JobPosting JSON-LD gives datePosted, validThrough and the description. */
export function parseJobPostingLd(html: string, job: Job): Job {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    let d: any;
    try {
      d = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (d?.["@type"] !== "JobPosting") continue;
    const countries = [d.jobLocation].flat().map((l: any) => l?.address?.addressCountry).filter(Boolean).map(countryCode);
    return { ...job, posted: parseDate(d.datePosted) ?? job.posted, closes: parseDate(d.validThrough?.slice?.(0, 10)) ?? job.closes, countries: countries.length ? countries : job.countries, text: plain(d.description) };
  }
  return job;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── diff ─────────────────────────────────────────────────────────────────────────────────────────────────

export const sameJob = (kind: WatchKind, p: Pick<Posting, "url" | "title">, j: Job) => {
  const k = keyFromUrl(kind, p.url);
  return k ? k === j.key : normTitle(p.title) === normTitle(j.title);
};

/** Postings whose last logged change is "removed": known to be gone already, so not reported again. */
export function removedUrls(changes: Change[], company: string): Set<string> {
  const last = new Map<string, Change["kind"]>();
  for (const c of changes) if (c.company === company) last.set(c.url, c.kind);
  return new Set([...last].filter(([, k]) => k === "removed").map(([u]) => u));
}

export interface Diff {
  added: Job[]; // MBA internships not yet in hiring.json
  present: Posting[]; // known postings still listed
  missing: Posting[]; // known postings absent from every result (probably closed; may need an existence check)
  reappeared: Posting[]; // logged as removed, but listed again
}

/**
 * `seen` is every job any query returned; `matches` the ones that passed classify() and inUS(). A known posting
 * counts as present if it shows up in `seen` at all, so a reworded title doesn't read as a removal.
 */
export function diffPostings(kind: WatchKind, known: Posting[], seen: Job[], matches: Job[], removed: Set<string> = new Set()): Diff {
  const listed = (p: Posting) => seen.some((j) => sameJob(kind, p, j));
  const live = known.filter((p) => !removed.has(p.url));
  return {
    added: matches.filter((j) => !known.some((p) => sameJob(kind, p, j))),
    present: live.filter(listed),
    missing: live.filter((p) => !listed(p)),
    reappeared: known.filter((p) => removed.has(p.url) && listed(p)),
  };
}

// ── writing ──────────────────────────────────────────────────────────────────────────────────────────────

/** Evidence for a window bounded by two of our own checks, by the README's definitions (about a week / four weeks). */
export const evidenceForGap = (days: number): Evidence => (days <= 7 ? "strong" : days <= 28 ? "medium" : "weak");

/**
 * The current cycle's window, the first time a company posts. A stated posting date pins it (strong). Otherwise it
 * went up after the last check that found nothing (`prevChecked`) and by today.
 */
export function inferWindow(o: { cycle: Cycle; prevChecked: ISODate; today: ISODate; added: { job: Job; sourceId: string }[] }): WindowObs {
  const { cycle, today, added } = o;
  const start = seasonStart(cycle);
  const dated = added.filter((a) => a.job.posted).sort((a, b) => a.job.posted!.localeCompare(b.job.posted!));
  const titles = added.map((a) => a.job.title);
  const scope = `${titles.length === 1 ? "" : `${titles.length} postings: `}${titles.slice(0, 4).join("; ")}${titles.length > 4 ? `; and ${titles.length - 4} more` : ""}`;
  const sources = [...new Set(added.map((a) => a.sourceId))];
  if (dated.length) {
    const first = dated[0].job.posted! < start ? start : dated[0].job.posted! > today ? today : dated[0].job.posted!;
    return { cycle, from: first, to: first, evidence: "strong", scope, note: `Posted date from the careers site's API; first found by the posting watcher on ${today}.`, sources };
  }
  const from = o.prevChecked < start ? start : o.prevChecked;
  return {
    cycle,
    from,
    to: today,
    evidence: evidenceForGap(daysBetween(from, today)),
    scope,
    note: `No posted date in the API. Not listed at the check on ${o.prevChecked}; found by the posting watcher on ${today}.`,
    sources,
  };
}

/** A primary source for a newly found posting. */
export function sourceFor(job: Job, entry: Pick<WatchEntry, "publisher">, today: ISODate): Source {
  return { url: job.url, title: `${job.title} (${job.ref ?? job.key})`, publisher: entry.publisher, published: job.posted, accessed: today, kind: "primary", quote: null };
}

/** A free sources.json id: `<company>-<ats id>`, made unique. */
export function sourceId(company: string, job: Job, taken: Record<string, unknown>): string {
  const base = `${company}-${job.key.length > 24 ? slug(job.title).slice(0, 40) : job.key}`;
  let id = base;
  for (let n = 2; id in taken; n++) id = `${base}-${n}`;
  return id;
}

/** Insert `key` before the first existing key that sorts after it, keeping the file's (mostly alphabetical) order. */
export function insertSorted<T>(obj: Record<string, T>, key: string, value: T): Record<string, T> {
  const out: Record<string, T> = {};
  let done = false;
  for (const [k, v] of Object.entries(obj)) {
    if (!done && k > key) {
      out[key] = value;
      done = true;
    }
    out[k] = v;
  }
  if (!done) out[key] = value;
  return out;
}

const quoteList = (ts: string[]) => {
  const q = ts.map((t) => `'${t}'`);
  return q.length <= 2 ? q.join(" and ") : `${q.slice(0, -1).join(", ")} and ${q.at(-1)}`;
};

/**
 * The status sentence, rebuilt from the postings when they change. Hand-written summaries go stale the moment a
 * posting appears or disappears, so the watcher replaces them with this rather than leave a contradiction.
 */
export function summarize(o: { today: ISODate; live: Pick<Posting, "title" | "posted" | "closes">[]; removed: number }): string {
  // Dates stay ISO; the page formats them (lib/format.ts prose()).
  const { today, live, removed } = o;
  const gone = removed ? ` ${removed} earlier posting${removed === 1 ? " has" : "s have"} been taken down.` : "";
  if (!live.length) return `As of ${today}, no US MBA intern posting is live.${gone}`;
  const posted = live.map((p) => p.posted).filter(Boolean).sort() as ISODate[];
  const when = posted.length ? (posted[0] === posted.at(-1) ? `, posted ${posted[0]}` : `, posted ${posted[0]} to ${posted.at(-1)}`) : "";
  const shown = live.slice(0, 3).map((p) => p.title);
  const more = live.length > 3 ? ` and ${live.length - 3} more` : "";
  const closes = [...new Set(live.map((p) => p.closes).filter(Boolean) as ISODate[])].sort();
  const deadline = !closes.length ? " No stated deadline." : closes.length === 1 ? ` Stated deadline ${closes[0]}.` : ` Stated deadlines ${closes[0]} to ${closes.at(-1)}.`;
  const n = live.length;
  return `As of ${today}, ${n} US MBA intern posting${n === 1 ? " is" : "s are"} live${when}: ${quoteList(shown)}${more}.${deadline}${gone}`;
}

// ── report ───────────────────────────────────────────────────────────────────────────────────────────────

export interface CompanyResult {
  id: string;
  name: string;
  status: "ok" | "failed" | "manual";
  hasProgram: boolean;
  reason?: string; // manual: why; failed: the error
  diff?: Diff;
  gone?: { posting: Posting; confirmed: boolean }[]; // missing postings after any existence check
  window?: WindowObs | null; // a window added this run
  summary?: { before: string; after: string } | null; // rewritten this run
  nonUS?: { job: Job; region: string | null }[]; // MBA internships outside the US (dropped); region set when limited to that region's schools
  passing?: Job[]; // internships that mention an MBA only in passing (left out, listed for a human)
  stamped?: string[]; // source ids marked gone
  unstampable?: Posting[]; // gone, but every source is shared, so there's nothing to stamp
}

const link = (t: string, u: string) => `[${t.replace(/[[\]]/g, "")}](${u})`;
const dates = (j: Pick<Job, "posted" | "closes">) => [j.posted && `posted ${j.posted}`, j.closes && `closes ${j.closes}`].filter(Boolean).join(", ");

export function renderReport(o: { today: ISODate; cycle: Cycle; results: CompanyResult[]; write: boolean; researched?: { from: ISODate; to: ISODate } | null }): string {
  const { today, cycle, results } = o;
  const ok = results.filter((r) => r.status === "ok");
  const added = ok.filter((r) => r.diff?.added.length);
  const gone = ok.filter((r) => r.gone?.length || r.diff?.reappeared.length);
  const human = results.filter((r) => r.summary || r.passing?.length || r.unstampable?.length || (!r.hasProgram && r.diff?.added.length) || r.gone?.some((g) => !g.confirmed));
  const quiet = ok.filter((r) => !added.includes(r) && !gone.includes(r));
  const out: string[] = [];
  out.push(`# Posting watch, ${today}`, "");
  out.push(
    `Cycle ${cycle} (summer ${Number(cycle) + 1} internships). Checked ${ok.length} of ${results.length} companies automatically; ` +
      `${results.filter((r) => r.status === "manual").length} need a person; ${results.filter((r) => r.status === "failed").length} failed.` +
      (o.write ? " Changes were written to src/data." : " Dry run: nothing was written (use --write)."),
  );
  if (o.researched) out.push("", `\`meta.researched\` moved from ${o.researched.from} to ${o.researched.to}.`);

  out.push("", `## New postings (${added.reduce((n, r) => n + r.diff!.added.length, 0)})`, "");
  if (!added.length) out.push("None.");
  for (const r of added) {
    out.push(`- **${r.name}**${r.hasProgram ? "" : " (marked as having no MBA program: not written)"}`);
    for (const j of r.diff!.added) out.push(`  - ${link(j.title, j.url)}${dates(j) ? ` · ${dates(j)}` : ""} · ${j.location || "location not given"}`);
    if (r.window) out.push(`  - First posting this cycle: window ${r.window.from === r.window.to ? r.window.from : `${r.window.from} to ${r.window.to}`} (${r.window.evidence} evidence) added.`);
  }

  out.push("", `## Disappeared, probably closed (${gone.reduce((n, r) => n + (r.gone?.length ?? 0), 0)})`, "");
  if (!gone.length) out.push("None.");
  for (const r of gone) {
    for (const g of r.gone ?? []) out.push(`- **${r.name}**: ${link(g.posting.title, g.posting.url)} · ${g.confirmed ? "confirmed gone (the ATS says the job no longer exists)" : "no longer in search results (not confirmed)"}`);
    for (const p of r.diff?.reappeared ?? []) out.push(`- **${r.name}**: ${link(p.title, p.url)} · listed again after being logged as removed`);
    if (r.stamped?.length) out.push(`  - Marked gone in sources.json: ${r.stamped.map((s) => `\`${s}\``).join(", ")}`);
  }

  out.push("", `## Needs a human (${human.length})`, "");
  if (!human.length) out.push("Nothing.");
  for (const r of human) {
    if (r.summary) out.push(`- **${r.name}**: status sentence rewritten from the template. Add context by hand if it helps.`, `  - was: ${r.summary.before}`, `  - now: ${r.summary.after}`);
    if (r.passing?.length)
      out.push(
        `- **${r.name}**: ${r.passing.length === 1 ? "1 internship that lists" : `${r.passing.length} internships that list`} an MBA among other degrees, not added ` +
          `(check whether ${r.passing.length === 1 ? "it's" : "they're"} really for MBAs): ${r.passing.map((j) => link(j.title, j.url)).join(", ")}`,
      );
    for (const p of r.unstampable ?? []) out.push(`- **${r.name}**: ${link(p.title, p.url)} is gone, but it only cites shared sources, so nothing was marked gone.`);
    for (const g of r.gone?.filter((x) => !x.confirmed) ?? []) out.push(`- **${r.name}**: confirm ${link(g.posting.title, g.posting.url)} is really closed (only its absence from search results says so).`);
    if (!r.hasProgram && r.diff?.added.length) out.push(`- **${r.name}**: hiring.json says no MBA program, but an MBA internship matched. Review and update by hand.`);
  }

  const abroad = ok.filter((r) => r.nonUS?.length);
  out.push("", `## Outside the US, not added (${abroad.reduce((n, r) => n + r.nonUS!.length, 0)})`, "");
  if (!abroad.length) out.push("None.");
  for (const r of abroad)
    for (const x of r.nonUS!)
      out.push(`- **${r.name}**: ${link(x.job.title, x.job.url)} · ${x.job.location || x.job.countries.join(", ")}${dates(x.job) ? ` · ${dates(x.job)}` : ""}${x.region ? ` · only for students at ${x.region} schools` : ""}`);

  out.push("", `## Checked, no change (${quiet.length})`, "");
  for (const r of quiet) {
    const n = r.diff?.present.length ?? 0;
    out.push(`- ${r.name}: ${n ? `${n} known posting${n === 1 ? "" : "s"} still up` : "no US MBA internship posted"}`);
  }

  const off = results.filter((r) => r.status !== "ok");
  out.push("", `## Failed or manual (${off.length})`, "");
  if (!off.length) out.push("None.");
  for (const r of off) out.push(`- ${r.name} (${r.status}): ${r.reason}`);
  return out.join("\n") + "\n";
}

/** This cycle's window, if the company has posted. */
export const windowFor = (h: Hiring, cycle: Cycle) => h.windows.find((w) => w.cycle === cycle) ?? null;
