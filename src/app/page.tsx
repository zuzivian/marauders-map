import { companies, hiring, meta, roles } from "@/data";
import { fmtDate } from "@/lib/season";
import { GuideProvider } from "@/components/Guide";
import Trail from "@/components/Trail";
import RoleDecoder from "@/components/RoleDecoder";
import Explorer from "@/components/Explorer";
import Windows from "@/components/Windows";
import PrepMatrix from "@/components/PrepMatrix";
import Corrections from "@/components/Corrections";

const withProgram = companies.filter((c) => hiring[c.id].hasProgram).length;
const titleCount = new Set(roles.flatMap((r) => r.titles.map((t) => `${t.company}|${t.title}`))).size;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"];
const count = (n: number) => words[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Ordered the way a first-year discovers the space: what the jobs are, who offers them, when to move, how to prepare.
const SECTIONS = [
  { id: "roles", short: "roles", title: "What the titles mean", dek: `${cap(count(roles.length))} jobs, ${titleCount} posted titles. Paste a title to decode it, or read across a row to see who's hiring for it right now.`, body: <RoleDecoder /> },
  {
    id: "companies", short: "companies", title: "The lay of the land",
    dek: `${cap(count(companies.length))} big tech companies, ${count(withProgram)} of them with MBA internships, placed by public data. Change the axes to see them from a different angle, and pick any company for its field notes.`,
    body: <Explorer />,
  },
  { id: "windows", short: "timing", title: "When applications open", dek: "Past cycles, with the uncertainty left in. A tight cluster means you can plan around it; a wide smear means watch the postings.", body: <Windows /> },
  { id: "prep", short: "prep", title: "Prep, sorted by what it’s good for", dek: "Which tools cover which interview skills, by role. Information, not a study plan.", body: <PrepMatrix /> },
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
            <h1>The Marauder&apos;s Map<br /><em>of big tech recruiting</em></h1>
            <div className="meta">gsb mba1s · {meta.currentCycle}–{Number(meta.currentCycle) + 1 - 2000} · checked {fmtDate(meta.researched).toLowerCase()}</div>
          </div>
          <Compass />
        </header>
        <p className="dek">Who&apos;s hiring MBA interns in big tech, for what, and when. Every date sourced.</p>
        <nav className="toc" aria-label="Sections">
          {SECTIONS.map((s, i) => <a key={s.id} href={`#${s.id}`}><span className="no">0{i + 1}</span> {s.short}</a>)}
        </nav>

        <Trail />

        {SECTIONS.map((s, i) => (
          <section key={s.id} id={s.id} className="section" aria-labelledby={`${s.id}-h`}>
            <div className="section-head">
              <div className="no">0{i + 1}</div>
              <h2 id={`${s.id}-h`}>{s.title}</h2>
              <p>{s.dek}</p>
            </div>
            {s.body}
          </section>
        ))}

        <footer className="foot">
          <div>
            <strong>How this is made.</strong> Every number links to its source. Market values and revenue come from SEC filings and market data;
            application dates come from dated postings and archived snapshots. Estimates show their range. Where we couldn&apos;t find solid evidence,
            we left it out rather than guess.
          </div>
          <Corrections />
          <div className="foot-row">
            <span>made by <a href="https://natwong.dev" target="_blank" rel="noopener">nat wong</a>, for gsb mba1s · not affiliated with the cmc, career hub, or warner bros.</span>
            <span className="mischief">mischief managed.</span>
          </div>
        </footer>
      </main>
    </GuideProvider>
  );
}
