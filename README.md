# The Marauder's Map of big tech recruiting

Live at **https://marauders-map.natwong.dev**.

A field guide to big tech internship recruiting for Stanford GSB MBA1s. It covers what the posted titles actually mean,
how the companies differ, when applications tend to open, and which prep is worth your time.

It's a single static page (Next.js static export) with no backend. Everything on it comes from the JSON files in
[`src/data/`](src/data), and every factual claim links to a source.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # data health checks + unit tests
npm run build      # runs the tests, then exports static HTML to out/
npm start          # serve out/ locally
```

## How the data works

| File | What it holds |
|---|---|
| `companies.json` | Market value, revenue growth, headcount, consumer/business splits, office policy. Each metric has `value`, an optional `low`–`high` range, `asOf`, and `sources`. |
| `hiring.json` | Per company: when MBA internship postings went live in each cycle (a date *range* plus evidence strength), and what's posted right now. |
| `roles.json` | The role dictionary, every posted title we've seen (with sources), and the keyword weights the title search uses. |
| `interviews.json` | Interview stages, only where a company (high confidence) or its general hiring page (medium) describes them. |
| `calendar.json` | GSB recruiting calendar: the AAP, blackouts, OCI interview weeks, offer deadline. |
| `prep.json` | Prep resources by role × skill. Scores (0–3) are editorial judgments; module names and links are checked. |
| `sources.json` | Every source: URL, publisher, dates, and a short verbatim quote where one supports the claim. |
| `meta.json` | The current cycle, the date the data was last checked end to end, and the corrections and first-hand form links. |
| `firsthand.json` | First-hand notes from GSB second-years on how they got in, keyed by company. Self-reported, unverified, and added only through `npm run add:firsthand`. |

The rules:

- **Nothing on the page is typed by hand if it can be computed.** "Usually opens", steady vs moves around, open/closing/closed status,
  the "right now" strip, counts, and as-of dates are all derived from the data. "Today" comes from the reader's clock,
  so the page stays honest after the build date. Statuses are worded as facts up to the last check and as predictions after it.
- **Uncertainty is shown, not hidden.** Application dates are ranges, faded by evidence strength. Estimated metrics carry
  ranges, drawn as bars on the chart.
- **No placeholders.** If something can't be sourced, it's left out. For example, interview stages for Apple, Nvidia, Airbnb
  and Meta's MBA role aren't shown, and there's no "time mix" chart because no source gives those numbers.
- **`npm test` enforces it** ([`src/data/data.test.ts`](src/data/data.test.ts)). Every cited source must exist and every source must be
  cited. Every metric and window must be sourced, ranges must be ordered, dates must sit inside their season, and the prep
  matrix must be complete. The build fails if any check fails.

### Refreshing

```bash
# Revenue growth, straight from SEC XBRL filings (SEC requires a contact User-Agent):
SEC_USER_AGENT="Your Name you@example.com" npm run refresh:sec            # dry run: compare
SEC_USER_AGENT="Your Name you@example.com" npm run refresh:sec -- --write # update companies.json

# Link and quote health: flags dead links, and quotes that no longer appear on their page.
npm run check:sources                       # report only
npm run check:sources -- --strict           # drop every quote that can't be verified (live page or Wayback copy)
npm run check:sources -- --mark-gone        # stamp expired postings "since removed" instead of failing
```

Pages that render with JavaScript (Workday, SmartRecruiters, most careers sites) can't be verified by the script. Check
those quotes in a browser and mark them `"quoteCheck": "browser YYYY-MM-DD"` in `sources.json`.

Market values and postings still need a person to check them. Market data has no free, reliable, keyless API, and posting
dates need judgment about evidence. When you update them, bump `asOf` / `checked`, cite a source, and bump
`meta.researched`. The page warns readers when that date is more than 10 days old.

### Evidence strength (application windows)

- **strong**: a primary source states the date (a posting's own date, or an official page), or archived snapshots pin it within about a week.
- **medium**: a credible secondary source (a school career page, a dated recruiter post, news), or snapshots within about four weeks.
- **weak**: inference (neighboring job IDs, forum posts). Weak cycles are drawn faded and ignored when estimating "usually opens" if better evidence exists.

## Exports and calendar feeds

The site feeds a student's own tracker and calendar; it doesn't replace them (or Career Hub).

- **My list.** Star companies in their field notes or in a row of the timing chart. Stars live in the browser's
  localStorage (no account). "My list only" narrows the trail, the timing chart and the roles grid to them.
- **Copy to my tracker.** Copies the starred companies (or all, if none are starred) as tab-separated rows for
  Google Sheets, Notion, Airtable or Excel, or downloads them as CSV. Columns: company, status today (the site's own
  wording), usually opens, opened this cycle, closes, posting URLs, how postings behave, and a link to the company's guide page.
- **Calendar feeds**, written at build time by [`src/app/cal/[file]/route.ts`](src/app/cal/%5Bfile%5D/route.ts):
  `/cal/all.ics` (every company plus the GSB calendar) and `/cal/<id>.ics` for each company with an MBA program.
  Events are all-day: stated deadlines, when this cycle's postings went live, and, for companies that haven't posted,
  an "expected to open (estimate)" date from past cycles with the range in the description. UIDs are stable, so a
  subscribed calendar updates instead of duplicating. The starred list downloads as a one-time `.ics` built in the browser.

The writers are in [`src/lib/ics.ts`](src/lib/ics.ts) and [`src/lib/export.ts`](src/lib/export.ts), with tests beside them.

## First-hand notes

Each company's field notes have a "Getting in" block. The top half is computed: a backward plan from that company's past
windows, plus the GSB rule that bears on its timing. The only number in it that isn't data, the two-week lead time, is
labeled a rule of thumb. The bottom half is first-hand notes from second-years, shown as their own evidence class
("first-hand · n=3 · not verified by the company").

**How notes come in.** Second-years fill in the form at the bottom of the page. It posts to the same Formspree form as
corrections, marked `kind=firsthand` with its own subject line, and its fields mirror `firsthand.json`. Shareable links
open it directly: `https://marauders-map.natwong.dev/#contribute`, or `?contribute=google#contribute` to preselect a company.

**Moderating one** (about 30 seconds). Copy the submission from the Formspree dashboard or email, then:

```bash
pbpaste | npm run add:firsthand              # dry run: the normalized entry, plus anything to check
pbpaste | npm run add:firsthand -- --write   # add it to src/data/firsthand.json
npm test                                     # then commit
```

It accepts Formspree JSON or pasted `field: value` lines. It refuses anything without consent or not marked
`kind=firsthand`, trims text to the limits (280 characters for "what mattered" and advice), drops the email, and flags
emails, phone numbers, links and a chosen display name in the text. Read those flags before you write, and edit the JSON
by hand if something identifying slips through.

**Anonymity.** Notes show as "a GSB '27" unless the contributor gave a name. A company's count, path mix and common
stages show from the first note. Advice and "what mattered" show only once that company has at least two notes for the
same internship summer, so a lone note can't be traced back to its author.

## Deploy

```bash
npm run deploy     # build (runs the tests) and publish out/ to here.now via scripts/publish.py
```

Without `HERENOW_API_KEY`, here.now sites are anonymous and expire after 24 hours. To keep one, claim it from the
`claimUrl` in `.herenow/state.json` (gitignored, since it holds the claim token). Any static host works: it's just `out/`.
