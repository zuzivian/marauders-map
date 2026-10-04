"use client";

import { calendar, companies, hiring, meta } from "@/data";
import { daysBetween, fmtDate, seasonEnd } from "@/lib/season";
import { statusOf, type State } from "@/lib/status";
import { useGuide } from "./Guide";

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;
const GROUPS:{ state: State; label: string; limit?: number }[] = [
  { state: "closing", label: "Closing soon" },
  { state: "open", label: "Open now" },
  { state: "due", label: "Due any day" },
  { state: "late", label: "Running late" },
  { state: "expected", label: "Up next", limit: 4 },
  { state: "closed", label: "Already closed", limit: 4 },
];

export default function RightNow() {
  const { today, live, select } = useGuide();
  const cycle = meta.currentCycle;
  const all = companies.map((c) => ({ c, s: statusOf(hiring[c.id], today, cycle) })).sort((a, b) => a.s.sortKey - b.s.sortKey);
  const current = calendar.filter((m) => m.to && m.kind !== "academic" && m.from <= today && today <= m.to);
  const next = calendar.filter((m) => m.from > today && m.kind !== "academic").sort((a, b) => a.from.localeCompare(b.from))[0];
  const age = daysBetween(meta.researched, today);
  const over = daysBetween(seasonEnd(cycle), today) > 0;

  return (
    <section className="now" aria-labelledby="now-h">
      <h2 id="now-h" className="label">right now · {live ? fmtDate(today, { year: true }) : `as of ${fmtDate(meta.researched, { year: true })}`}</h2>
      {over && <p className="warn">The {cycle}–{Number(cycle) + 1 - 2000} season has ended. This guide hasn&apos;t been updated for the next one yet.</p>}
      {live && age > 10 && !over && (
        <p className="warn">Postings were last checked {fmtDate(meta.researched)} ({age} days ago). Anything marked open may have closed, so confirm on the careers site.</p>
      )}
      <div className="now-grid">
        {GROUPS.map((g) => {
          const items = all.filter((x) => x.s.state === g.state).slice(0, g.limit);
          if (!items.length) return null;
          return (
            <div key={g.state} className={`now-col status-${g.state}`}>
              <div className="now-h">{g.label}</div>
              <ul>
                {items.map(({ c, s }) => (
                  <li key={c.id}><button className="linkish" onClick={() => select(c.id, { reveal: true })}>{c.name}</button> <span className="muted">{s.headline}</span></li>
                ))}
              </ul>
            </div>
          );
        })}
        {(current.length > 0 || next) && (
          <div className="now-col">
            <div className="now-h">At the GSB</div>
            <ul>
              {current.map((m) => <li key={m.id}><strong>Now:</strong> {m.label} <span className="muted">· until {fmtDate(m.to!)}</span></li>)}
              {next && <li><strong>{fmtDate(next.from)}:</strong> {next.label} <span className="muted">· in {plural(daysBetween(today, next.from), "day")}</span></li>}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
