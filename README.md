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

## Sharing

- **Company links.** Every company has its own page at `/c/<id>/` (for example
  [`/c/google/`](https://marauders-map.natwong.dev/c/google/)). It opens the full guide on that company's field notes, with its own
  title, description and preview image. Picking a company on the page swaps the address bar to its link, and the field notes
  have a "copy link" button. The trailing slash matters: the export writes `c/<id>/index.html` (`trailingSlash: true`), and
  here.now redirects `/c/<id>` to `/c/<id>/`.
- **Link previews.** `og.png` next to each page (`/og.png`, `/c/<id>/og.png`) is drawn at build time with `next/og`. Previews
  and descriptions are fixed when the site is built, so they're worded as of the last check ("not posted as of Oct 4, 2026")
  rather than "due any day". Rebuild and deploy after a data refresh to update them.
- **Weekly digest.** `npm run -s digest` prints a Slack post for the High Tech Club channel: what's open, deadlines in the next
  two weeks, what past cycles say should open next (labeled as estimates), and GSB dates coming up. Each company links to its page.
  Use `-- --date 2026-10-11` for another day, and `| pbcopy` to copy it.

## Analytics (off by default)

Analytics are opt-in and cookie-free. With `"analytics": null` in `meta.json` nothing loads. To turn them on, create a site at
[GoatCounter](https://www.goatcounter.com) (free for non-commercial use) and set its code:

```json
"analytics": { "kind": "goatcounter", "code": "your-site-code" }
```

GoatCounter then counts page views, plus these events: `select/<id>` (picked a company), `copy-link/<id>`, and `useful/yes` or
`useful/no` from the "was this useful?" line in the footer, which only shows when analytics is on.

## How the data works

| File | What it holds |
|---|---|
| `companies.json` | Market value, revenue growth, headcount, office policy. Each metric has `value`, an optional `low`–`high` range, `asOf`, and `sources`. An optional `intern` object holds what the MBA intern postings say: pay as stated (with its basis, location and cycle), locations, visa sponsorship (only when a posting says it outright, quoted), how teams are assigned, and layoffs or hiring freezes in the last 12 months. Any part a source doesn't give is left out. |
| `hiring.json` | Per company: when MBA internship postings went live in each cycle (a date *range* plus evidence strength), and what's posted right now. |
| `roles.json` | The role dictionary, every posted title we've seen (with sources), and the keyword weights the title search uses. |
| `interviews.json` | Interview stages, only where a company (high confidence) or its general hiring page (medium) describes them. |
| `calendar.json` | GSB recruiting calendar: the AAP, blackouts, OCI interview weeks, offer deadline. |
| `prep.json` | Prep resources by role × skill. Scores (0–3) are editorial judgments; module names and links are checked. |
| `sources.json` | Every source: URL, publisher, dates, and a short verbatim quote where one supports the claim. |
| `meta.json` | The current cycle, the date the data was last checked end to end, the corrections and first-hand form links, and analytics (off by default). |
| `firsthand.json` | First-hand notes from GSB second-years on how they got in, keyed by company. Self-reported, unverified, and added only through `npm run add:firsthand`. |
| `watch.json` | How the posting watcher queries each company's careers site: API kind, endpoint, search terms, filters (or `manual`, with the reason). |
| `changes.json` | The watcher's log of postings appearing and disappearing: `{date, company, kind: "posted" \| "removed", title, url}`. |

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

Market values still need a person to check them: market data has no free, reliable, keyless API. Postings are checked
daily by the watcher (below), except where a careers site has no usable API. When you update anything by hand, bump
`asOf` / `checked`, cite a source, and bump `meta.researched`. The page warns readers when that date is more than 10 days old.

### Watcher

```bash
npm run watch                                # dry run: print the report
npm run watch -- --write                     # also update hiring.json, sources.json, changes.json, meta.json
npm run watch -- --write --mark-gone         # also stamp `gone` on the sources of postings the ATS says are removed
npm run watch -- --only=google,nvidia        # just these companies
```

[`scripts/watch-postings.mjs`](scripts/watch-postings.mjs) asks each company's careers API ([`watch.json`](src/data/watch.json):
Greenhouse, Ashby, Workday, SmartRecruiters, Eightfold, Oracle, amazon.jobs, Apple, Google, TikTok, IBM, Intuit) for MBA
internships for `meta.currentCycle`, and prints a markdown report: new postings, postings that disappeared, what needs a
person, MBA internships outside the US (such as Google's EMEA-only ones), and companies that failed or are manual (Meta and
Uber block scripts). A match must be an internship, for the cycle's summer, in the US, and either say MBA in the title or
require an MBA in the description. Internships that list an MBA among other degrees are reported, not added. The filtering,
diffing and window logic is in [`src/lib/watch.ts`](src/lib/watch.ts), tested against recorded responses.

With `--write`, for every company it checked it sets `current.checked` to today and adds new postings, each with a new
primary source. The first posting of the cycle also adds the window: the API's posted date (strong), or else the span from
the last check that found nothing to today, with evidence by the gap (definitions below). It never deletes a posting.
Disappearances are logged in `changes.json` and, with `--mark-gone`, stamped on the posting's own source. Whenever a
company's postings change, its `current.summary` is rewritten from a template and flagged in the report. A hand-written
sentence would contradict the new state, so a plain true one is used instead, and you can add context in review.
`meta.researched` moves to today only when no automatic check failed.

[`.github/workflows/watch.yml`](.github/workflows/watch.yml) runs this daily at about 15:00 UTC (and on demand). If the data
changed it opens or updates a pull request from `bot/watch` with the report as its body. It never merges or deploys: review,
merge, then `npm run deploy`. Two repo settings matter:

- **Settings → Actions → General → "Allow GitHub Actions to create and approve pull requests"** must be on, or the PR step fails.
- This is a private repo, so each run spends Actions minutes (a run takes about 3–5 minutes, so roughly 100–150 a month).

### Evidence strength (application windows)

- **strong**: a primary source states the date (a posting's own date, or an official page), or archived snapshots pin it within about a week.
- **medium**: a credible secondary source (a school career page, a dated recruiter post, news), or snapshots within about four weeks.
- **weak**: inference (neighboring job IDs, forum posts). Weak cycles are drawn faded and ignored when estimating "usually opens" if better evidence exists.

## Exports and calendar feeds

The site feeds a student's own tracker and calendar; it doesn't replace them (or Career Hub).

- **My list.** Star companies in their field notes or in a row of the timing chart. Stars live in the browser's
  localStorage (no account). "My list only" narrows the trail, the timing chart and the roles grid to them. The filter and
  every export live in the "my list · export" menu in the contents bar; once something is starred, the timing chart and roles
  grid also get their own "my list only" toggle.
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
("First-hand, from 3 second-years. Not verified by the company.").

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

**Anonymity.** Notes show as "a GSB '27" unless the contributor gave a name. Nothing from a note shows until that company has at
least two notes for the same internship summer (before that, only a count), so a lone note can't be traced back to its author.

## Deploy

```bash
npm run deploy     # build (runs the tests) and publish out/ to here.now via scripts/publish.py
```

Without `HERENOW_API_KEY`, here.now sites are anonymous and expire after 24 hours. To keep one, claim it from the
`claimUrl` in `.herenow/state.json` (gitignored, since it holds the claim token). Any static host works: it's just `out/`.
