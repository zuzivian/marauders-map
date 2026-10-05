"use client";

import { useState } from "react";
import { scaleLog } from "d3-scale";
import { companies, hiring, interviews, meta, roles, sources, type Company } from "@/data";
import type { Intern, StageType } from "@/data/types";
import { SEASON_MONTHS, SEASON_WEEKS, fmtDate, fmtRange, monthStartWeek, span, weekOf } from "@/lib/season";
import { MARK, roleMark, trailItems } from "@/lib/marks";
import { fmtCap, fmtCount, fmtMonthly, fmtPct, fmtStatedPay, perMonth, prose } from "@/lib/format";
import { useGuide } from "./Guide";
import { Cite, SourceList } from "./Sources";
import { openCorrection } from "./Corrections";
import { MarkIcon } from "./MarkIcon";
import { CompanyCalLinks, StarButton } from "./MyList";
import GettingIn from "./GettingIn";
import { CopyLink } from "./CopyLink";

const cycle = meta.currentCycle;
const OPACITY = { strong: 0.95, medium: 0.6, weak: 0.3 };
const pct = (wk: number) => `${(Math.max(0, Math.min(SEASON_WEEKS, wk)) / SEASON_WEEKS) * 100}%`;
// One growth scale for every company, so bars compare across panels.
const growthAll = companies.flatMap((c) => [c.growth.value, c.growth.low ?? c.growth.value, c.growth.high ?? c.growth.value]);
const growthScale = scaleLog([Math.max(1, Math.min(...growthAll) / 1.3), Math.max(...growthAll) * 1.1], [4, 100]).clamp(true);

const STAGE: Record<StageType, string> = {
  behavioral: "behavioral", product: "product sense", analytical: "analytical", technical: "technical", case: "case or strategy", milestone: "step",
};

function SeasonBar({ company }: { company: Company }) {
  const { today, live } = useGuide();
  const h = hiring[company.id];
  if (!h.windows.length) return <p className="small muted">No MBA internship postings found.</p>;
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

const STANCE: Record<NonNullable<Intern["sponsorship"]>["stance"], string> = {
  sponsors: "Sponsors visas", "no sponsorship": "No visa sponsorship", "authorization required": "US work authorization required",
};
const cycleName = (c: string) => (c === cycle ? "this cycle" : `${c}–${Number(c) + 1 - 2000} cycle`);
const city = (place: string) => place.replace(/, [A-Z]{2}$/, "");

/** What the MBA intern postings say, as four cards: pay and visas first, then where and how teams are set. */
function InternFacts({ company: c }: { company: Company }) {
  const i = c.intern ?? {};
  const { pay, locations: loc, sponsorship: visa, teamModel: team } = i;
  const visaQuote = visa ? sources[visa.sources[0]]?.quote : null;
  const places = loc?.places ?? [];
  return (
    <>
      <h4>The internship</h4>
      <div className="cards">
        <div className="card">
          <div className="card-l">Pay</div>
          {pay ? (
            <>
              <div className="card-v big">{fmtMonthly(perMonth(pay.low, pay.per))}{pay.high > pay.low ? `–${fmtMonthly(perMonth(pay.high, pay.per))}` : ""}<span className="card-u"> a month</span></div>
              <div className="card-s">posted as {fmtStatedPay(pay)} <Cite ids={pay.sources} /></div>
            </>
          ) : <div className="card-v none">Not stated</div>}
        </div>
        <div className={`card visa-${visa ? visa.stance.replace(/ /g, "-") : "none"}`}>
          <div className="card-l">Visa</div>
          {visa ? (
            <>
              <div className="card-v">{STANCE[visa.stance]}</div>
              {visaQuote && <div className="card-s"><q>{visaQuote}</q> <Cite ids={visa.sources} /></div>}
            </>
          ) : <div className="card-v none">Not stated</div>}
        </div>
        <div className="card">
          <div className="card-l">Where</div>
          {places.length ? (
            <>
              <div className="card-v">{places.slice(0, 2).map(city).join(", ")}</div>
              {places.length > 2 ? (
                <details className="card-more"><summary>+{places.length - 2} more</summary>{places.slice(2).map(city).join(", ")} <Cite ids={loc!.sources} /></details>
              ) : <div className="card-s"><Cite ids={loc!.sources} /></div>}
            </>
          ) : <div className="card-v none">Not stated</div>}
        </div>
        <div className="card">
          <div className="card-l">Team</div>
          {team ? (
            <><div className="card-v">{team.model[0].toUpperCase() + team.model.slice(1)}</div><div className="card-s"><Cite ids={team.sources} /></div></>
          ) : <div className="card-v none">Not stated</div>}
        </div>
      </div>
      {(pay || visa || team?.note) && (
        <details className="why">
          <summary>Notes on these figures</summary>
          {pay && <p>Pay: {fmtStatedPay(pay)}, {pay.where}; {cycleName(pay.cycle)}, {pay.postings} posting{pay.postings === 1 ? "" : "s"}.{pay.note && ` ${pay.note}`}</p>}
          {pay && <p className="muted">Monthly figures assume 40-hour weeks for hourly rates and divide annual rates by 12. They are the posted rates only.</p>}
          {visa && <p>Visa: {visa.scope}, {cycleName(visa.cycle)}.</p>}
          {team?.note && <p>Team: {team.note}</p>}
        </details>
      )}
    </>
  );
}

/** Layoffs and hiring freezes in the last 12 months, newest first. */
function StaffCuts({ company: c }: { company: Company }) {
  const pulse = c.intern?.pulse;
  if (!pulse?.length) return null;
  return (
    <>
      <h4>Staff cuts, last 12 months</h4>
      <ul className="pulse">
        {[...pulse].sort((a, b) => b.date.localeCompare(a.date)).map((p) => (
          <li key={p.date + p.what}><span className="muted">{fmtDate(p.date, { year: true })}:</span> {p.what} <Cite ids={p.sources} /></li>
        ))}
      </ul>
    </>
  );
}

function Stages({ company }: { company: Company }) {
  const iv = interviews[company.id];
  if (!iv) return null;
  return (
    <>
      <h4>The interview process <span className="muted">({iv.roleScope.toLowerCase()})</span></h4>
      <ol className="stages">
        {iv.stages.map((s, i) => {
          const kinds = s.types.filter((t) => t !== "milestone");
          return (
            <li key={i} title={s.detail ? prose(s.detail) : undefined}>
              {s.label}{kinds.length > 0 && <span className="muted">: {kinds.map((t) => STAGE[t]).join(", ")}</span>}
            </li>
          );
        })}
      </ol>
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
  const [fullFor, setFullFor] = useState<string | null>(null); // whose long status note is expanded
  const h = hiring[c.id];
  const item = trailItems([c], hiring, today, cycle)[0];
  const myRoles = roles.map((r) => ({ r, titles: r.titles.filter((t) => t.company === c.name), mark: roleMark(r, c, item, cycle) })).filter((x) => x.titles.length);
  const now = h.windows.find((w) => w.cycle === cycle);
  const allSources = [
    ...c.marketCap.sources, ...c.growth.sources, ...c.headcount.sources, ...c.office.sources,
    ...[c.intern?.pay, c.intern?.locations, c.intern?.sponsorship, c.intern?.teamModel, ...(c.intern?.pulse ?? [])].flatMap((x) => x?.sources ?? []),
    ...h.windows.flatMap((w) => w.sources), ...h.current.postings.flatMap((p) => p.sources), ...(interviews[c.id]?.sources ?? []),
    ...(h.current.sources ?? []),
    ...myRoles.flatMap((x) => x.titles.flatMap((t) => t.sources)),
  ];
  const g = c.growth;
  const private_ = c.marketCap.kind === "private valuation";

  return (
    <aside id="field-notes" className="panel" aria-label={`Field notes: ${c.name}`}>
      <div className="panel-head">
        <div>
          <div className="label">Field notes</div>
          <h3>{c.name}</h3>
          <div className="sub">{c.model} · {c.hq} · {c.ai}</div>
        </div>
        <div className="panel-tools"><StarButton company={c} /><CopyLink key={c.id} id={c.id} /></div>
      </div>

      <div className={`status m-${item?.mark ?? "later"}`}>
        <p className="status-head">
          {item && <MarkIcon mark={item.mark} size={13} />}<strong>{item ? item.status.headline : "No MBA internship"}</strong>
          <span className="sr-only">{item ? ` (${MARK[item.mark].label})` : ""}</span>
        </p>
        <p className={`statusnote${fullFor === c.id ? "" : " clamp"}`}>{prose(h.current.summary, Number(cycle))} <Cite ids={h.current.sources ?? []} />{!live && <span className="muted"> As of {fmtDate(h.current.checked, { year: true })}.</span>}</p>
        {h.current.summary.length > 200 && (
          <button className="linkish quiet more-toggle" onClick={() => setFullFor(fullFor === c.id ? null : c.id)} aria-expanded={fullFor === c.id}>
            {fullFor === c.id ? "less" : "more"}
          </button>
        )}
        {h.current.postings.length > 0 && (
          <details className="why">
            <summary>This cycle&apos;s posting{h.current.postings.length === 1 ? "" : "s"} ({h.current.postings.length})</summary>
            <ul className="postings">
              {h.current.postings.map((p) => (
                <li key={p.url + p.title}><a href={p.url} target="_blank" rel="noreferrer">{p.title}</a>
                  <span className="muted">{p.posted ? `, posted ${fmtDate(p.posted)}` : ""}{p.closes ? (p.closes < today ? `, closed ${fmtDate(p.closes)}` : `, closes ${fmtDate(p.closes)}`) : ""}</span></li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {h.hasProgram && <InternFacts company={c} />}

      <div className="block-gi"><GettingIn company={c} /></div>

      {/* Everything a student doesn't decide with first, behind two labeled folds. */}
      <details className="more">
        <summary>Past openings, roles{interviews[c.id] ? " and interviews" : ""}</summary>
        <h4>When applications opened</h4>
        <SeasonBar company={c} />
        <p className="small muted">
          {h.windows.length > 0 && "One bar per cycle: this cycle in black, earlier ones in red, paler for weaker evidence. "}
          {now ? `This cycle: ${fmtRange(now.from, now.to)} (${now.evidence} evidence). ` : ""}{h.pattern}.
        </p>
        <CompanyCalLinks company={c} />

        <h4>MBA intern roles</h4>
        {myRoles.length ? (
          <div className="rolechips">
            {myRoles.map(({ r, titles, mark }) => (
              <a key={r.id} href="#roles" className={`rolechip m-${mark ?? "later"}`} title={titles.map((t) => t.title).join("\n")}>
                {mark && <MarkIcon mark={mark} />}{r.name}<span className="n">{titles.length} title{titles.length === 1 ? "" : "s"}</span>
              </a>
            ))}
          </div>
        ) : <p className="small muted">{prose(h.note) || "No MBA internship titles found."}</p>}

        <Stages company={c} />
      </details>

      <details className="more">
        <summary>The company{c.intern?.pulse?.length ? ", staff cuts" : ""} and all sources</summary>
        <h4>Size, growth and office days</h4>
        <div className="tiles">
          <div className="tile">
            <div className="tv">{fmtCap(c.marketCap.value)}</div>
            <div className="tl">{private_ ? "valuation" : "market value"}, {c.marketCap.asOf ? fmtDate(c.marketCap.asOf) : ""} <Cite ids={c.marketCap.sources} /></div>
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
            <div className="tv">{fmtCount(c.headcount.value)}{c.headcount.low !== undefined && <span className="tvs"> approx.</span>}</div>
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

        <StaffCuts company={c} />

        <h4>All sources for {c.name}</h4>
        <SourceList ids={allSources} label="" />
      </details>

      {meta.corrections && (
        <p className="small panel-fix"><button className="linkish quiet" onClick={() => openCorrection(c.name)}>Something wrong about {c.name}?</button></p>
      )}
    </aside>
  );
}
