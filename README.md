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
| `companies.json` | Market value, revenue growth, headcount, office policy. Each metric has `value`, an optional `low`–`high` range, `asOf`, and `sources`. |
| `hiring.json` | Per company: when MBA internship postings went live in each cycle (a date *range* plus evidence strength), and what's posted right now. |
| `roles.json` | The role dictionary, every posted title we've seen (with sources), and the keyword weights the title search uses. |
| `interviews.json` | Interview stages, only where a company (high confidence) or its general hiring page (medium) describes them. |
| `calendar.json` | GSB recruiting calendar: the AAP, blackouts, OCI interview weeks, offer deadline. |
| `prep.json` | Prep resources by role × skill. Scores (0–3) are editorial judgments; module names and links are checked. |
| `sources.json` | Every source: URL, publisher, dates, and a short verbatim quote where one supports the claim. |
| `meta.json` | The current cycle, the date the data was last checked end to end, and the corrections link. |

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

## Deploy

```bash
npm run deploy     # build (runs the tests) and publish out/ to here.now via scripts/publish.py
```

Without `HERENOW_API_KEY`, here.now sites are anonymous and expire after 24 hours. To keep one, claim it from the
`claimUrl` in `.herenow/state.json` (gitignored, since it holds the claim token). Any static host works: it's just `out/`.
