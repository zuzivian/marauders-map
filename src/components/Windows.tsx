"use client";

import { calendar, companies, hiring, meta } from "@/data";
import type { Cycle } from "@/data/types";
import { SEASON_MONTHS, SEASON_WEEKS, fmtDate, fmtRange, monthStartWeek, span, steadiness, typicalOpen, weekOf } from "@/lib/season";
import { statusOf } from "@/lib/status";
import { prose } from "@/lib/format";
import { useGuide } from "./Guide";
import { Cite, SourceList } from "./Sources";
import { MarkIcon } from "./MarkIcon";
import GsbStrip from "./GsbStrip";
import { MyListBar, MyListEmpty, StarButton, StarMark, useMyListFilter } from "./MyList";
import { MARK, trailItems } from "@/lib/marks";

const cycle = meta.currentCycle;
const CYCLES: Cycle[] = ["2023", "2024", "2025", "2026"];
export const CYCLE_SHADE: Record<Cycle, string> = { "2023": "#e3aaa3", "2024": "#c4534a", "2025": "#8c1515", "2026": "#1c1a16" };
const OPACITY = { strong: 0.95, medium: 0.6, weak: 0.3 };
const pct = (wk: number) => `${(Math.max(0, Math.min(SEASON_WEEKS, wk)) / SEASON_WEEKS) * 100}%`;
const summerOf = (c: Cycle) => Number(c) + 1;
const cycleName = (c: Cycle) => (c === cycle ? "this cycle" : `${c} cycle`);

export default function Windows() {
  const { today, live, select } = useGuide();
  const { only, keep } = useMyListFilter();
  const rows = [...companies].filter((c) => keep(c.id)).sort(
    (a, b) => (typicalOpen(hiring[a.id], cycle)?.week ?? 99) - (typicalOpen(hiring[b.id], cycle)?.week ?? 99),
  );
  const todayWk = weekOf(today, cycle);
  const plotted = calendar.filter((m) => m.timeline);
  const marks = new Map(trailItems(companies, hiring, today, cycle).map((i) => [i.company.id, i.mark]));

  return (
    <div>
      <MyListBar />
      {only && !rows.length && <MyListEmpty />}
      <div className={`timeline${only && !rows.length ? " mylist-hidden" : ""}`}>
        <div className="tl-head" aria-hidden>
          <div className="tl-track">
            {SEASON_MONTHS.map((m, i) => <span key={m} className="tl-month" style={{ left: pct(monthStartWeek(i, cycle)) }}>{m}</span>)}
          </div>
        </div>
        <div className="tl-body">
          <div className="tl-overlay" aria-hidden>
            {SEASON_MONTHS.map((m, i) => <div key={m} className="tl-grid" style={{ left: pct(monthStartWeek(i, cycle)) }} />)}
            {plotted.map((m) => {
              const a = weekOf(m.from, cycle);
              return m.to
                ? <div key={m.id} className={`tl-band tl-${m.kind}`} style={{ left: pct(a), width: `calc(${pct(weekOf(m.to, cycle) + 1 / 7)} - ${pct(a)})` }} />
                : <div key={m.id} className={`tl-line tl-${m.kind}`} style={{ left: pct(a) }} />;
            })}
            {live && todayWk >= 0 && todayWk <= SEASON_WEEKS && (
              <div className="tl-today" style={{ left: pct(todayWk) }}><span>you are here</span></div>
            )}
          </div>
          {rows.map((c) => {
            const h = hiring[c.id];
            const v = steadiness(h, cycle);
            const st = statusOf(h, today, cycle);
            const mk = marks.get(c.id);
            const ws = [...h.windows].sort((a, b) => a.cycle.localeCompare(b.cycle));
            return (
              <details key={c.id} className="tl-row-wrap">
                <summary className="tl-row">
                  <span className="tl-name">{c.name}<StarMark id={c.id} /></span>
                  <span className="tl-track">
                    {ws.map((w) => {
                      const [a, b] = span(w);
                      const lane = CYCLES.indexOf(w.cycle);
                      return (
                        <span key={w.cycle} className="tl-bar" style={{ left: pct(a), width: `max(7px, calc(${pct(b)} - ${pct(a)}))`, top: 4 + lane * 7,
                          background: CYCLE_SHADE[w.cycle], opacity: OPACITY[w.evidence] }} />
                      );
                    })}
                    {!h.hasProgram && <span className="tl-none">no mba internship program</span>}
                    <span className="sr-only">
                      {ws.map((w) => `${cycleName(w.cycle)}: opened ${fmtRange(w.from, w.to)}, ${w.evidence} evidence. `).join("")}
                    </span>
                  </span>
                  <span className="tl-mk">{mk && <MarkIcon mark={mk} size={13} />}<span className="sr-only">{mk ? MARK[mk].label : ""}</span></span>
                  <span className="tl-verdict">
                    {h.hasProgram && <span className={v.steady ? "note" : "note muted"}>{v.text}</span>}
                    {v.earlier && <span className="flag"> · earlier this year</span>}
                    {v.later && <span className="flag"> · later this year</span>}
                    <span className={`tl-status status-${st.state}`}>{st.headline}</span>
                  </span>
                </summary>
                <div className="tl-detail">
                  <p>{prose(h.current.summary, Number(meta.currentCycle))} <span className="muted">(checked {fmtDate(h.current.checked)})</span> <Cite ids={h.current.sources ?? []} /></p>
                  {ws.length > 0 && (
                    <table className="obs">
                      <thead><tr><th>cycle</th><th>postings went up</th><th>evidence</th><th>notes</th></tr></thead>
                      <tbody>
                        {[...ws].reverse().map((w) => (
                          <tr key={w.cycle}>
                            <td><i className="swatch" style={{ background: CYCLE_SHADE[w.cycle] }} />{w.cycle === cycle ? "this cycle" : `for summer ${summerOf(w.cycle)}`}</td>
                            <td>{w.from === w.to ? fmtDate(w.from, { year: true }) : `between ${fmtDate(w.from)} and ${fmtDate(w.to, { year: true })}`}{w.closes ? `; closed ${fmtDate(w.closes)}` : ""}</td>
                            <td><span className={`ev ev-${w.evidence}`}>{w.evidence}</span></td>
                            <td>{prose([w.scope, w.note].filter(Boolean).join(". "))} <Cite ids={w.sources} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <SourceList ids={[...ws.flatMap((w) => w.sources), ...h.current.postings.flatMap((p) => p.sources), ...(h.current.sources ?? [])]} />
                  <button className="chip" onClick={() => select(c.id, { reveal: true })}>Open {c.name} field notes ↓</button>
                  <StarButton company={c} chip />
                </div>
              </details>
            );
          })}
        </div>
      </div>

      <div className="legend wrap">
        {CYCLES.map((k) => <span key={k}><i className="pill" style={{ background: CYCLE_SHADE[k] }} />{k === cycle ? "this cycle" : `for summer ${summerOf(k)}`}</span>)}
        <span className="label">width = how unsure the date is · faded = weaker evidence · tap a row for sources</span>
      </div>

      <h4 className="subhead">The GSB calendar, 2026–27</h4>
      <GsbStrip />
      <div className="caveat">
        Dates are when postings went live on company career sites. They come from dated postings, archived snapshots, school career pages, and recruiter posts;
        each row lists its sources. GSB&apos;s calendar governs GSB-facilitated recruiting. The AAP bars employers from cold-contacting first-years, but it
        doesn&apos;t stop postings from going live, and several companies post before it ends.
      </div>
    </div>
  );
}
