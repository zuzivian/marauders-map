import { companies, hiring, meta } from "@/data";
import { fmtDate } from "@/lib/season";
import { GuideProvider } from "@/components/Guide";
import RightNow from "@/components/RightNow";
import RoleDecoder from "@/components/RoleDecoder";
import Explorer from "@/components/Explorer";
import Windows from "@/components/Windows";
import PrepMatrix from "@/components/PrepMatrix";
import Corrections from "@/components/Corrections";

const withProgram = companies.filter((c) => hiring[c.id].hasProgram).length;
const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four", "twenty-five"];
const count = (n: number) => words[n] ?? String(n);
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

// Ordered the way a first-year discovers the space: what the jobs are, who offers them, when to move, how to prepare.
const SECTIONS = [
  { id: "roles", short: "roles", title: "What the titles mean", dek: "The same job goes by different names at different companies. Paste any title you see, or read the entries below.", body: <RoleDecoder /> },
  {
    id: "companies", short: "companies", title: "The lay of the land",
    dek: `${cap(count(companies.length))} big tech companies, ${count(withProgram)} of them with MBA internships, placed by public data. Change the axes to see them from a different angle, and pick any company for its field notes.`,
    body: <Explorer />,
  },
  { id: "windows", short: "timing", title: "When applications open", dek: "Past cycles, with the uncertainty left in. A tight cluster means you can plan around it; a wide smear means watch the postings.", body: <Windows /> },
  { id: "prep", short: "prep", title: "Prep, sorted by what it’s good for", dek: "Which tools cover which interview skills, by role. Information, not a study plan.", body: <PrepMatrix /> },
];

export default function Home() {
  return (
    <GuideProvider>
      <main className="page">
        <header className="masthead">
          <h1>Lone Tree<br /><em>a field guide to big tech</em></h1>
          <div className="meta">for gsb mba1s<br />recruiting season {meta.currentCycle}–{Number(meta.currentCycle) + 1 - 2000}<br />data checked {fmtDate(meta.researched, { year: true }).toLowerCase()}</div>
        </header>
        <p className="dek">
          Career Hub tells you what&apos;s open. This tells you what it is: what the titles mean, how the big tech companies differ,
          when they tend to open, and which prep is worth your time.
        </p>
        <nav className="toc" aria-label="Sections">
          {SECTIONS.map((s, i) => <a key={s.id} href={`#${s.id}`}><span className="no">0{i + 1}</span> {s.short}</a>)}
        </nav>

        <RightNow />

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

        <Corrections />

        <footer className="foot">
          <div>
            <strong>How this is made.</strong> Every number links to its source. Market values and revenue come from SEC filings and market data;
            application dates come from dated postings and archived snapshots. Estimates show their range. Where we couldn&apos;t find solid evidence,
            we left it out rather than guess.
          </div>
          <div className="foot-row">
            <span>made by <a href="https://natwong.dev" target="_blank" rel="noopener">nat wong</a>, for gsb mba1s · not affiliated with the cmc or career hub</span>
            {meta.correctionsEndpoint ? <a href="#corrections">send a correction</a> : <span>corrections welcome</span>}
          </div>
        </footer>
      </main>
    </GuideProvider>
  );
}
