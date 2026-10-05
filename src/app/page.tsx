import { companies, hiring, meta, prep, roles } from "@/data";
import { fmtDate } from "@/lib/season";
import { fmtMonthly, perMonth } from "@/lib/format";
import { GuideProvider } from "@/components/Guide";
import Section from "@/components/Section";
import Trail from "@/components/Trail";
import RoleDecoder from "@/components/RoleDecoder";
import Explorer from "@/components/Explorer";
import Windows from "@/components/Windows";
import PrepMatrix from "@/components/PrepMatrix";
import Corrections from "@/components/Corrections";
import Contribute from "@/components/Contribute";
import { MyListMenu } from "@/components/MyList";
import { Useful } from "@/components/Analytics";

const withProgram = companies.filter((c) => hiring[c.id].hasProgram).length;
const titleCount = new Set(roles.flatMap((r) => r.titles.map((t) => `${t.company}|${t.title}`))).size;
const cycles = new Set(companies.flatMap((c) => hiring[c.id].windows.map((w) => w.cycle))).size;
const pay = companies.flatMap((c) => (c.intern?.pay ? [c.intern.pay] : []));
const payLow = Math.min(...pay.map((p) => perMonth(p.low, p.per))), payHigh = Math.max(...pay.map((p) => perMonth(p.high, p.per)));
const noVisa = companies.filter((c) => c.intern?.sponsorship?.stance === "no sponsorship").length;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"];
const count = (n: number) => words[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Ordered by urgency: when to move, who the companies are, what the jobs are called, how to prepare.
// Each folds to a heading and one line computed from the data.
const SECTIONS = [
  {
    id: "windows", short: "timing", title: "When applications open",
    line: `When ${count(withProgram)} companies’ MBA internship postings went live over the last ${count(cycles)} cycles, with the uncertainty left in.`,
    dek: "A tight cluster means you can plan around it; a wide smear means watch the postings.",
    body: <Windows />,
  },
  {
    id: "companies", short: "companies", title: "The lay of the land", open: "on-company-page" as const,
    line: `${cap(count(companies.length))} companies, ${count(withProgram)} with MBA internships. Where postings state pay, it runs ${fmtMonthly(payLow)} to ${fmtMonthly(payHigh)} a month; ${count(noVisa)} say they won’t sponsor visas.`,
    dek: "Plot them by what their intern postings pay, whether they say anything about visas, when they open, or how big the company is, and pick any company for its field notes.",
    body: <Explorer />,
  },
  {
    id: "roles", short: "roles", title: "What the titles mean",
    line: `${cap(count(roles.length))} jobs behind ${titleCount} posted titles (${roles.map((r) => r.short).join(", ")}), and who’s hiring for each right now.`,
    dek: "Paste a title to decode it, or read across a row to see who's hiring for it.",
    body: <RoleDecoder />,
  },
  {
    id: "prep", short: "prep", title: "Prep, sorted by what it’s good for",
    line: `${cap(count(prep.columns.length))} kinds of prep, rated on ${count(prep.skills.length)} interview skills for ${count(prep.roles.length)} roles.`,
    dek: "Which tools cover which interview skills, by role. Information, not a study plan.",
    body: <PrepMatrix />,
  },
];

function Compass() {
  return (
    <svg className="compass" viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" strokeWidth="0.75" />
      <circle cx="24" cy="24" r="17" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="1 2.5" />
      <path d="M24 4 L27 24 L24 44 L21 24 Z" fill="currentColor" opacity="0.85" />
      <path d="M4 24 L24 21 L44 24 L24 27 Z" fill="currentColor" opacity="0.35" />
      <text x="24" y="2.5" textAnchor="middle" fontSize="5" fill="currentColor" fontFamily="var(--serif)">N</text>
    </svg>
  );
}

export default function Home() {
  return (
    <GuideProvider>
      <main className="page">
        <header className="masthead">
          <div>
            <h1>The Marauder&apos;s Map <em>of big tech recruiting</em></h1>
            <p className="dek">Who&apos;s hiring MBA interns in big tech, for what, and when. Every date sourced.</p>
            <div className="meta">For GSB MBA1s · {meta.currentCycle}–{Number(meta.currentCycle) + 1 - 2000} · checked {fmtDate(meta.researched)}</div>
          </div>
          <Compass />
        </header>

        <Trail />

        <nav className="toc" aria-label="Sections">
          <div className="toc-links">{SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.short}</a>)}</div>
          <MyListMenu />
        </nav>

        {SECTIONS.map((s) => <Section key={s.id} id={s.id} title={s.title} line={s.line} dek={s.dek} open={s.open}>{s.body}</Section>)}

        <footer className="foot">
          <div>
            <strong>How this is made.</strong> Every number links to its source. Intern pay, locations and visa terms come from the postings themselves; market values and revenue from SEC filings and market data;
            application dates come from dated postings and archived snapshots. Estimates show their range. Where we couldn&apos;t find solid evidence,
            we left it out rather than guess.
          </div>
          <Corrections />
          <Contribute />
          <Useful />
          <div className="foot-row">
            <span>Made by <a href="https://natwong.dev" target="_blank" rel="noopener">Nat Wong</a>, for GSB MBA1s. Not affiliated with the CMC, Career Hub, or Warner Bros.</span>
            <span className="mischief">mischief managed.</span>
          </div>
        </footer>
      </main>
    </GuideProvider>
  );
}
