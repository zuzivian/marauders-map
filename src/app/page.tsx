import Explorer from "@/components/Explorer";
import Windows from "@/components/Windows";
import RoleDecoder from "@/components/RoleDecoder";
import PrepMatrix from "@/components/PrepMatrix";

const SECTIONS = [
  { id: "explorer", no: "01", title: "The lay of the land", dek: "Twelve companies that hire MBA interns, placed by public data. Change the axes to see them from a different angle; click any bubble for its field notes." },
  { id: "windows", no: "02", title: "When applications open", dek: "Past cycles, with the uncertainty left in. A tight cluster means you can plan around it. A wide smear means watch the postings." },
  { id: "roles", no: "03", title: "What the titles mean", dek: "The same job goes by different names at different companies. Paste any title you see, or read the four entries below." },
  { id: "prep", no: "04", title: "Prep, sorted by what it's good for", dek: "Which tools cover which interview skills, depending on the role. Information, not a study plan." },
];

export default function Home() {
  return (
    <main className="page">
      <header className="masthead">
        <h1>Lone Tree<br /><em>a field guide to big tech</em></h1>
        <div className="meta">for gsb mba1s<br />recruiting season 2026–27<br />updated oct 3, 2026</div>
      </header>
      <p className="dek">
        Career Hub tells you what&apos;s open. This tells you what it is: how the big tech companies differ, when they tend to open,
        what their titles actually mean, and which prep is worth your time.
      </p>
      <nav className="toc">
        {SECTIONS.map((s) => <a key={s.id} href={`#${s.id}`}>{s.no} {s.title.toLowerCase()}</a>)}
      </nav>

      {SECTIONS.map((s) => (
        <section key={s.id} id={s.id} className="section">
          <div className="section-head">
            <div className="no">{s.no}</div>
            <h2>{s.title}</h2>
            <p>{s.dek}</p>
          </div>
          {s.id === "explorer" && <Explorer />}
          {s.id === "windows" && <Windows />}
          {s.id === "roles" && <RoleDecoder />}
          {s.id === "prep" && <PrepMatrix />}
        </section>
      ))}

      <footer className="foot">
        <span>made by and for gsb mba1s · not affiliated with the cmc or career hub</span>
        <span>corrections welcome</span>
      </footer>
    </main>
  );
}
