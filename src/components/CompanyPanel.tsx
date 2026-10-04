"use client";

import { hiring, interviews, meta, roles, type Company } from "@/data";
import type { StageType } from "@/data/types";
import { SEASON_MONTHS, SEASON_WEEKS, fmtDate, fmtRange, monthStartWeek, span, waveLabel, waveOf, weekOf } from "@/lib/season";
import { statusOf } from "@/lib/status";
import { fmtCap, fmtPct, fmtWithRange, prose } from "@/lib/format";
import { format } from "d3-format";
import { useGuide } from "./Guide";
import { Cite, SourceList } from "./Sources";

const cycle = meta.currentCycle;
export const STAGE: Record<StageType, { label: string; glyph: string }> = {
  behavioral: { label: "Behavioral", glyph: "◆" },
  product: { label: "Product sense", glyph: "●" },
  analytical: { label: "Analytical", glyph: "▲" },
  technical: { label: "Technical", glyph: "■" },
  case: { label: "Case / strategy", glyph: "✕" },
  milestone: { label: "Step", glyph: "○" },
};
const OPACITY = { strong: 0.95, medium: 0.6, weak: 0.3 };
const pct = (wk: number) => `${(Math.max(0, Math.min(SEASON_WEEKS, wk)) / SEASON_WEEKS) * 100}%`;

export function SeasonBar({ company }: { company: Company }) {
  const { today, live } = useGuide();
  const h = hiring[company.id];
  if (!h.windows.length) return <p className="label">no mba internship postings found</p>;
  const rows = [...h.windows].sort((a, b) => a.cycle.localeCompare(b.cycle));
  const todayWk = weekOf(today, cycle);
  return (
    <div className="seasonbar">
      <div className="track" style={{ height: 14 * rows.length + 4 }}>
        {rows.map((o, i) => {
          const [a, b] = span(o);
          return (
            <div key={o.cycle} className="bar" style={{ top: 2 + i * 14, left: pct(a), width: `max(6px, calc(${pct(b)} - ${pct(a)}))`, opacity: OPACITY[o.evidence],
              background: o.cycle === cycle ? "var(--ink)" : "var(--cardinal)" }}>
              <span className="sr-only">{o.cycle} cycle: {fmtRange(o.from, o.to)}, {o.evidence} evidence</span>
            </div>
          );
        })}
        {live && todayWk >= 0 && todayWk <= SEASON_WEEKS && <div className="today" style={{ left: pct(todayWk) }} />}
      </div>
      <div className="months" aria-hidden>
        {SEASON_MONTHS.map((m, i) => <span key={m} style={{ left: pct(monthStartWeek(i, cycle)) }}>{m[0]}</span>)}
      </div>
    </div>
  );
}

function Stages({ company }: { company: Company }) {
  const iv = interviews[company.id];
  if (!iv) return null;
  return (
    <>
      <h4>the interview process · {iv.roleScope.toLowerCase()}</h4>
      <ol className="stages">
        {iv.stages.map((s, i) => {
          const kinds = s.types.filter((t) => t !== "milestone");
          return (
            <li key={i} className={kinds.length ? undefined : "milestone"}>
              <span className="glyph" aria-hidden>{STAGE[kinds[0] ?? "milestone"].glyph}</span>
              <span><strong>{s.label}</strong>{kinds.length > 0 && <span className="label"> {kinds.map((t) => STAGE[t].label).join(" + ")}</span>}
                {s.detail && <span className="stage-detail"> · {prose(s.detail)}</span>}</span>
            </li>
          );
        })}
      </ol>
      {iv.distinctive && <p className="small">{iv.distinctive}</p>}
      <div className="small muted">
        {iv.confidence === "high" ? "Stages as the company describes them." : "From the company's general (not MBA-specific) process; your loop may differ."}
        {iv.caveat && ` ${iv.caveat}`} <Cite ids={iv.sources} />
      </div>
    </>
  );
}

export default function CompanyPanel({ company: c }: { company: Company }) {
  const { today, live } = useGuide();
  const h = hiring[c.id];
  const st = statusOf(h, today, cycle);
  const myRoles = roles.map((r) => ({ r, titles: r.titles.filter((t) => t.company === c.name) })).filter((x) => x.titles.length);
  const now = h.windows.find((w) => w.cycle === cycle);
  const allSources = [
    ...c.marketCap.sources, ...c.growth.sources, ...c.headcount.sources, ...c.b2bPayer.sources, ...c.b2bUser.sources, ...c.office.sources,
    ...h.windows.flatMap((w) => w.sources), ...h.current.postings.flatMap((p) => p.sources), ...(interviews[c.id]?.sources ?? []),
    ...myRoles.flatMap((x) => x.titles.flatMap((t) => t.sources)),
  ];

  return (
    <aside className="panel" aria-label={`Field notes: ${c.name}`}>
      <div className="label">field notes</div>
      <h3>{c.name}</h3>
      <div className="sub">{waveLabel[waveOf(h, cycle)].toLowerCase()} · {c.model.toLowerCase()} · {c.hq.toLowerCase()}</div>

      <div className={`status status-${st.state}`}>
        <strong>{st.headline}</strong>
        <div>{prose(h.current.summary, Number(meta.currentCycle))}</div>
        {!live && <div className="label">as of {fmtDate(h.current.checked, { year: true })}</div>}
      </div>

      <dl>
        <dt>{c.marketCap.kind === "private valuation" ? "valuation" : "market value"}</dt>
        <dd>{fmtCap(c.marketCap.value)} {c.marketCap.asOf && <span className="muted">· {c.marketCap.kind === "private valuation" ? "reported" : "close"} {fmtDate(c.marketCap.asOf, { year: true })}</span>} <Cite ids={c.marketCap.sources} /></dd>
        <dt>growth</dt>
        <dd>{fmtWithRange(c.growth, fmtPct)} <span className="muted">· {c.growth.basis.replace(/\d{4}-\d{2}-\d{2}/g, (d) => fmtDate(d, { year: true }))}</span> <Cite ids={c.growth.sources} />{c.growth.note && <div className="muted">{prose(c.growth.note)}</div>}</dd>
        <dt>employees</dt>
        <dd>{fmtWithRange(c.headcount, (n) => format(",")(n))}{c.headcount.asOf && <span className="muted"> · {fmtDate(c.headcount.asOf, { year: true })}</span>} <Cite ids={c.headcount.sources} />{c.headcount.note && <div className="muted">{c.headcount.note}</div>}</dd>
        <dt>in office</dt>
        <dd>{c.office.summary} <Cite ids={c.office.sources} />{c.office.interns && <div className="muted">Interns: {prose(c.office.interns)}</div>}</dd>
        <dt>who pays</dt>
        <dd>{fmtWithRange(c.b2bPayer, (n) => `${n}%`)} businesses <span className="muted">· our estimate</span></dd>
        <dt>who uses</dt>
        <dd>{fmtWithRange(c.b2bUser, (n) => `${n}%`)} business products <span className="muted">· our estimate</span></dd>
        <dt>ai posture</dt><dd>{c.ai}</dd>
        <dt>postings</dt><dd>{h.pattern}</dd>
      </dl>
      <details className="why">
        <summary>How we estimated who pays and who uses</summary>
        <p><strong>Who pays.</strong> {c.b2bPayer.reasoning}</p>
        <p><strong>Who uses.</strong> {c.b2bUser.reasoning}</p>
        <Cite ids={[...c.b2bPayer.sources, ...c.b2bUser.sources]} />
      </details>

      <h4>mba intern roles</h4>
      {myRoles.length ? (
        <ul className="role-list">
          {myRoles.map(({ r, titles }) => (
            <li key={r.id}><a href={`#role-${r.id}`}>{r.name}</a>: {titles.map((t) => t.title).join(" · ")}</li>
          ))}
        </ul>
      ) : <p className="small muted">{prose(h.note) || "No MBA internship titles found."}</p>}

      <h4>when applications opened · black = this cycle</h4>
      <SeasonBar company={c} />
      {now && <p className="small">This cycle: {fmtRange(now.from, now.to)} ({now.evidence} evidence){now.note ? `. ${prose(now.note, Number(meta.currentCycle))}` : ""}</p>}
      {h.current.postings.length > 0 && (
        <ul className="postings">
          {h.current.postings.map((p) => (
            <li key={p.url + p.title}><a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
              <span className="muted">{p.posted ? ` · posted ${fmtDate(p.posted)}` : ""}{p.closes ? ` · closes ${fmtDate(p.closes)}` : ""}</span></li>
          ))}
        </ul>
      )}

      <Stages company={c} />

      <details className="why">
        <summary>All sources for {c.name}</summary>
        <SourceList ids={allSources} label="" />
      </details>
    </aside>
  );
}
