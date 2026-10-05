"use client";

import { scaleLog } from "d3-scale";
import { companies, hiring, interviews, meta, roles, type Company } from "@/data";
import type { StageType } from "@/data/types";
import { SEASON_MONTHS, SEASON_WEEKS, fmtDate, fmtRange, monthStartWeek, span, weekOf } from "@/lib/season";
import { MARK, roleMark, trailItems } from "@/lib/marks";
import { fmtCap, fmtCount, fmtPct, prose } from "@/lib/format";
import { useGuide } from "./Guide";
import { Cite, SourceList } from "./Sources";
import { openCorrection } from "./Corrections";
import { MarkIcon } from "./MarkIcon";
import GettingIn from "./GettingIn";

const cycle = meta.currentCycle;
const OPACITY = { strong: 0.95, medium: 0.6, weak: 0.3 };
const pct = (wk: number) => `${(Math.max(0, Math.min(SEASON_WEEKS, wk)) / SEASON_WEEKS) * 100}%`;
// One growth scale for every company, so bars compare across panels.
const growthAll = companies.flatMap((c) => [c.growth.value, c.growth.low ?? c.growth.value, c.growth.high ?? c.growth.value]);
const growthScale = scaleLog([Math.max(1, Math.min(...growthAll) / 1.3), Math.max(...growthAll) * 1.1], [4, 100]).clamp(true);

export const STAGE: Record<StageType, string> = {
  behavioral: "Behavioral", product: "Product sense", analytical: "Analytical", technical: "Technical", case: "Case / strategy", milestone: "Step",
};
function StageIcon({ type }: { type: StageType }) {
  const shape = {
    behavioral: <path d="M6 1.5 L10.5 6 L6 10.5 L1.5 6 Z" fill="currentColor" />,
    product: <circle cx={6} cy={6} r={4.4} fill="currentColor" />,
    analytical: <path d="M6 1.6 L10.6 10 L1.4 10 Z" fill="currentColor" />,
    technical: <rect x={2} y={2} width={8} height={8} fill="currentColor" />,
    case: <path d="M2.4 2.4 L9.6 9.6 M9.6 2.4 L2.4 9.6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />,
    milestone: <circle cx={6} cy={6} r={3.8} fill="none" stroke="currentColor" strokeWidth={1.3} />,
  }[type];
  return <svg className="si" width={11} height={11} viewBox="0 0 12 12" aria-hidden>{shape}</svg>;
}

export function SeasonBar({ company }: { company: Company }) {
  const { today, live } = useGuide();
  const h = hiring[company.id];
  if (!h.windows.length) return <p className="label">no mba internship postings found</p>;
  const rows = [...h.windows].sort((a, b) => a.cycle.localeCompare(b.cycle));
  const todayWk = weekOf(today, cycle);
  return (
    <div className="seasonbar">
      <div className="track" style={{ height: 12 * rows.length + 4 }}>
        {rows.map((o, i) => {
          const [a, b] = span(o);
          return (
            <div key={o.cycle} className="bar" style={{ top: 2 + i * 12, left: pct(a), width: `max(6px, calc(${pct(b)} - ${pct(a)}))`, opacity: OPACITY[o.evidence],
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

/** Mon–Fri with required days filled; a team-set band shows its extra days hatched. */
function WeekStrip({ company: c }: { company: Company }) {
  const o = c.office;
  const solid = o.category === "fixed" ? Math.round(o.days ?? 0) : o.category === "team" ? Math.floor(o.low ?? 0) : 0;
  const maybe = o.category === "team" ? Math.ceil(o.high ?? 0) - solid : 0;
  const caption = o.category === "remote" ? "remote-first" : o.category === "flexible" ? "no set minimum" : o.category === "team" ? (o.low !== undefined ? `${o.low}–${o.high} days a week` : "varies by team") : `${o.days} days a week`;
  return (
    <div className="weekstrip" title={o.summary}>
      <div className="days" aria-hidden>
        {["M", "T", "W", "T", "F"].map((d, i) => (
          <span key={i} className={i < solid ? "on" : i < solid + maybe ? "maybe" : o.category === "flexible" ? "flex" : ""}>{d}</span>
        ))}
      </div>
      <div className="cap">{caption}</div>
    </div>
  );
}

/** Consumers ← → businesses, with the estimate's plausible range shaded. */
function SplitBar({ label, m }: { label: string; m: { value: number; low?: number; high?: number } }) {
  return (
    <div className="split">
      <div className="split-l"><span>{label}</span><span className="split-v">{m.value}% business</span></div>
      <div className="split-track" role="img" aria-label={`${label}: ${m.value}% business${m.low !== undefined ? `, plausibly ${m.low}–${m.high}%` : ""}`}>
        {m.low !== undefined && m.high !== undefined && <span className="split-range" style={{ left: `${m.low}%`, width: `${m.high - m.low}%` }} />}
        <span className="split-mark" style={{ left: `${m.value}%` }} />
      </div>
      <div className="split-ends" aria-hidden><span>consumers</span><span>businesses</span></div>
    </div>
  );
}

function Stages({ company }: { company: Company }) {
  const iv = interviews[company.id];
  if (!iv) return null;
  return (
    <>
      <h4>the interview process · {iv.roleScope.toLowerCase()}</h4>
      <ol className="stepper">
        {iv.stages.map((s, i) => {
          const kinds = s.types.filter((t) => t !== "milestone");
          return (
            <li key={i} className={kinds.length ? "stage" : "stage step"} title={s.detail ? prose(s.detail) : undefined}>
              {(kinds.length ? kinds : (["milestone"] as StageType[])).map((t) => <StageIcon key={t} type={t} />)}
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="stage-key" aria-hidden>
        {[...new Set(iv.stages.flatMap((s) => s.types).filter((t) => t !== "milestone"))].map((t) => <span key={t}><StageIcon type={t} />{STAGE[t]}</span>)}
      </div>
      <details className="why">
        <summary>Stage details</summary>
        <ul className="stage-details">{iv.stages.filter((s) => s.detail).map((s, i) => <li key={i}><strong>{s.label}:</strong> {prose(s.detail)}</li>)}</ul>
        {iv.distinctive && <p>{iv.distinctive}</p>}
        <p className="muted">{iv.confidence === "high" ? "Stages as the company describes them." : "From the company's general (not MBA-specific) process; your loop may differ."}{iv.caveat && ` ${iv.caveat}`} <Cite ids={iv.sources} /></p>
      </details>
    </>
  );
}

export default function CompanyPanel({ company: c }: { company: Company }) {
  const { today, live } = useGuide();
  const h = hiring[c.id];
  const item = trailItems([c], hiring, today, cycle)[0];
  const myRoles = roles.map((r) => ({ r, titles: r.titles.filter((t) => t.company === c.name), mark: roleMark(r, c, item, cycle) })).filter((x) => x.titles.length);
  const now = h.windows.find((w) => w.cycle === cycle);
  const allSources = [
    ...c.marketCap.sources, ...c.growth.sources, ...c.headcount.sources, ...c.b2bPayer.sources, ...c.b2bUser.sources, ...c.office.sources,
    ...h.windows.flatMap((w) => w.sources), ...h.current.postings.flatMap((p) => p.sources), ...(interviews[c.id]?.sources ?? []),
    ...myRoles.flatMap((x) => x.titles.flatMap((t) => t.sources)),
  ];
  const g = c.growth;
  const private_ = c.marketCap.kind === "private valuation";

  return (
    <aside className="panel" aria-label={`Field notes: ${c.name}`}>
      <div className="label">field notes</div>
      <h3>{c.name}</h3>
      <div className="sub">{c.model.toLowerCase()} · {c.hq.toLowerCase()} · {c.ai.toLowerCase()}</div>

      <div className={`statuscard m-${item?.mark ?? "later"}`}>
        {item ? <MarkIcon mark={item.mark} size={16} /> : null}
        <div>
          <strong>{item ? item.status.headline : "No MBA internship"}</strong>
          <div className="statusnote">{prose(h.current.summary, Number(cycle))}</div>
          {!live && <div className="label">as of {fmtDate(h.current.checked, { year: true })}</div>}
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="tv">{fmtCap(c.marketCap.value)}</div>
          <div className="tl">{private_ ? "valuation" : "market value"} · {c.marketCap.asOf ? fmtDate(c.marketCap.asOf) : ""} <Cite ids={c.marketCap.sources} /></div>
        </div>
        <div className="tile">
          <div className="tv">{fmtPct(g.value)}</div>
          <div className="gbar" role="img" aria-label={`Revenue growth ${g.value}%`}>
            {g.low !== undefined && g.high !== undefined && <span className="grange" style={{ left: `${growthScale(g.low)}%`, width: `${growthScale(g.high) - growthScale(g.low)}%` }} />}
            <span className="gfill" style={{ width: `${growthScale(g.value)}%` }} />
          </div>
          <div className="tl" title={g.basis}>revenue growth <Cite ids={g.sources} /></div>
        </div>
        <div className="tile">
          <div className="tv">{fmtCount(c.headcount.value)}{c.headcount.low !== undefined && <span className="tvs"> ±</span>}</div>
          <div className="tl" title={c.headcount.note ?? undefined}>employees <Cite ids={c.headcount.sources} /></div>
        </div>
        <div className="tile">
          <WeekStrip company={c} />
          <div className="tl">in the office <Cite ids={c.office.sources} /></div>
        </div>
      </div>
      {(g.note || c.headcount.note || c.office.interns) && (
        <details className="why">
          <summary>Notes on these numbers</summary>
          {g.note && <p>{prose(g.note)}</p>}
          <p className="muted">Growth: {prose(g.basis)}.</p>
          {c.headcount.note && <p>Employees: {c.headcount.note}</p>}
          {c.office.interns && <p>Interns: {prose(c.office.interns)}</p>}
          <p className="muted">Office: {c.office.summary}</p>
        </details>
      )}

      <SplitBar label="who pays" m={c.b2bPayer} />
      <SplitBar label="who uses it" m={c.b2bUser} />
      <details className="why">
        <summary>How we estimated these splits</summary>
        <p><strong>Who pays.</strong> {c.b2bPayer.reasoning}</p>
        <p><strong>Who uses.</strong> {c.b2bUser.reasoning}</p>
      </details>

      <h4>mba intern roles</h4>
      {myRoles.length ? (
        <div className="rolechips">
          {myRoles.map(({ r, titles, mark }) => (
            <a key={r.id} href="#roles" className={`rolechip m-${mark ?? "later"}`} title={titles.map((t) => t.title).join("\n")}>
              {mark && <MarkIcon mark={mark} />}{r.name}<span className="n">{titles.length}</span>
            </a>
          ))}
        </div>
      ) : <p className="small muted">{prose(h.note) || "No MBA internship titles found."}</p>}

      <h4>when applications opened · black = this cycle</h4>
      <SeasonBar company={c} />
      <p className="small muted">{now ? `This cycle: ${fmtRange(now.from, now.to)} (${now.evidence} evidence). ` : ""}{h.pattern}.</p>
      {h.current.postings.length > 0 && (
        <details className="why">
          <summary>this cycle&apos;s posting{h.current.postings.length === 1 ? "" : "s"} ({h.current.postings.length})</summary>
          <ul className="postings">
            {h.current.postings.map((p) => (
              <li key={p.url + p.title}><a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                <span className="muted">{p.posted ? ` · posted ${fmtDate(p.posted)}` : ""}{p.closes ? (p.closes < today ? ` · closed ${fmtDate(p.closes)}` : ` · closes ${fmtDate(p.closes)}`) : ""}</span></li>
            ))}
          </ul>
        </details>
      )}

      <GettingIn company={c} />

      <Stages company={c} />

      <details className="why">
        <summary>All sources for {c.name}</summary>
        <SourceList ids={allSources} label="" />
      </details>
      {meta.corrections && (
        <p className="small"><button className="linkish quiet" onClick={() => openCorrection(c.name)}>something wrong about {c.name}?</button></p>
      )}
      <span className="sr-only">{item ? MARK[item.mark].label : ""}</span>
    </aside>
  );
}
