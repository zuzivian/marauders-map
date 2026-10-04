"use client";

import * as d3 from "d3";
import { companies } from "@/data/companies";
import { GSB_MARKERS, SEASON_MONTHS, SEASON_WEEKS, TODAY, monthStartWeek, span, typicalOpen, verdict, week } from "@/data/season";

const W = 1060, ROW = 34, M = { l: 112, r: 240, t: 78 };
const CYCLE_SHADE: Record<string, string> = { "2023": "#e8b4ae", "2024": "#c4534a", "2025": "#8c1515", "2026": "#1c1a16" };
const OPACITY = { strong: 0.9, medium: 0.55, weak: 0.25 };

export default function Windows() {
  const rows = [...companies].sort((a, b) => (typicalOpen(a) ?? 99) - (typicalOpen(b) ?? 99));
  const H = M.t + rows.length * ROW + 34;
  const x = d3.scaleLinear([0, SEASON_WEEKS], [M.l, W - M.r]);
  const cycles = Object.keys(CYCLE_SHADE);
  const bottom = H - 30;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="When MBA internship applications opened in past cycles, by company">
        {GSB_MARKERS.map((g, i) => {
          const a = x(week(g.from)), b = g.to ? x(week(g.to)) : a;
          return (
            <g key={g.label}>
              {g.to
                ? <rect x={a} y={M.t - 18} width={b - a} height={bottom - M.t + 18} fill={g.label === "Blackout" ? "var(--paper-2)" : "var(--cardinal-wash)"} opacity={0.8} />
                : <line x1={a} x2={a} y1={M.t - 18} y2={bottom} stroke="var(--ink-3)" strokeWidth={0.75} strokeDasharray="1 3" />}
              <text x={a + 3} y={M.t - 24 - i * 13} fill="var(--ink-2)" style={{ fontFamily: "var(--mono)", fontSize: 10.5 }}>gsb: {g.label.toLowerCase()}</text>
            </g>
          );
        })}
        {SEASON_MONTHS.map((m, i) => (
          <g key={m}>
            <line x1={x(monthStartWeek(i))} x2={x(monthStartWeek(i))} y1={M.t - 6} y2={bottom} stroke="var(--rule)" strokeWidth={0.5} />
            <text x={x(monthStartWeek(i)) + 4} y={M.t - 4} fill="var(--ink-3)" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{m.toLowerCase()}</text>
          </g>
        ))}
        {rows.map((c, i) => {
          const y = M.t + 12 + i * ROW + ROW / 2;
          const v = verdict(c);
          return (
            <g key={c.id}>
              <text x={0} y={y + 4} fill="var(--ink)" style={{ fontSize: 13 }}>{c.name}</text>
              <line x1={M.l} x2={W - M.r} y1={y} y2={y} stroke="var(--rule)" strokeWidth={0.5} strokeDasharray="1 3" />
              {c.windows.map((w, j) => {
                const [a, b] = span(w);
                const yy = y + (j - (c.windows.length - 1) / 2) * 5;
                return (
                  <rect key={w.cycle} x={x(a) - 4} y={yy - 4} width={Math.max(8, x(b) - x(a) + 8)} height={8} rx={4}
                    fill={CYCLE_SHADE[w.cycle]} opacity={OPACITY[w.evidence]}>
                    <title>{`${c.name}, ${w.cycle} cycle: opened ${w.to ? `between ${w.from} and ${w.to}` : `~${w.from}`} (${w.evidence} evidence)${w.note ? ` — ${w.note}` : ""}`}</title>
                  </rect>
                );
              })}
              {!c.windows.length && <text x={M.l + 6} y={y + 4} fill="var(--ink-3)" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>no mba internship program</text>}
              <text x={W - M.r + 14} y={y + 4} fill={v.tone} className="note" style={{ fontSize: 14 }}>
                {c.windows.length ? v.text : ""}
                {v.earlier && <tspan fill="var(--cardinal)" style={{ fontFamily: "var(--mono)", fontStyle: "normal", fontSize: 10.5 }}>{"  "}· earlier this year</tspan>}
              </text>
            </g>
          );
        })}
        <line x1={x(TODAY)} x2={x(TODAY)} y1={M.t - 6} y2={bottom} stroke="var(--cardinal)" strokeWidth={1.25} strokeDasharray="4 3" />
        <text x={x(TODAY) + 5} y={H - 12} className="note" fill="var(--cardinal)" style={{ fontSize: 14 }}>today</text>
      </svg>
      <div className="legend" style={{ flexWrap: "wrap" }}>
        {cycles.map((k) => <span key={k}><i style={{ background: CYCLE_SHADE[k], borderRadius: 4, width: 18 }} />{k === "2026" ? "this cycle" : `${k} cycle`}</span>)}
        <span className="label">width = how unsure the date is · faded = weaker evidence · hover a bar for the source note</span>
      </div>
      <div className="caveat">
        Dates are when postings went up on company career sites, from dated postings, archived pages, and recruiter posts. GSB&apos;s calendar governs
        on-campus activity only, and several companies post well before it: Amazon, Apple, and Intuit all opened in August this cycle.
        Interview rounds aren&apos;t shown; they run on a rolling basis and vary too much person to person.
      </div>
    </div>
  );
}
