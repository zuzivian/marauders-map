import * as d3 from "d3";
import { type Company, type StopType, waveLabel } from "@/data/companies";
import { SEASON_MONTHS, SEASON_WEEKS, TODAY, span } from "@/data/season";

export const STOP: Record<StopType, { label: string; color: string; glyph: string }> = {
  behavioral: { label: "Behavioral", color: "#5e1010", glyph: "◆" },
  product: { label: "Product sense", color: "#8c1515", glyph: "●" },
  analytical: { label: "Analytical", color: "#c4534a", glyph: "▲" },
  technical: { label: "Technical", color: "#e8a49c", glyph: "■" },
  case: { label: "Case / strategy", color: "#b6ae9e", glyph: "✕" },
  milestone: { label: "Milestone", color: "var(--ink)", glyph: "○" },
};

export function SeasonBar({ company }: { company: Company }) {
  const w = company.windows;
  if (!w.length) return <p className="label">no mba internship postings found</p>;
  const x = d3.scaleLinear([0, SEASON_WEEKS], [0, 100]);
  const op = { strong: 0.9, medium: 0.55, weak: 0.25 };
  return (
    <div>
      <div style={{ position: "relative", height: 14 * w.length + 4, background: "var(--paper-2)" }}>
        {w.map((o, i) => {
          const [a, b] = span(o);
          return (
            <div key={o.cycle} title={`${o.cycle} cycle · ${o.evidence} evidence${o.note ? " · " + o.note : ""}`}
              style={{ position: "absolute", top: 2 + i * 14, height: 10, left: `${x(a)}%`, width: `${Math.max(2, x(b) - x(a))}%`,
                background: o.cycle === "2026" ? "var(--ink)" : "var(--cardinal)", opacity: op[o.evidence], borderRadius: 5 }} />
          );
        })}
        <div style={{ position: "absolute", top: 0, bottom: 0, left: `${x(TODAY)}%`, borderLeft: "1px dashed var(--cardinal)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        {SEASON_MONTHS.map((m) => <span key={m} className="label">{m[0].toLowerCase()}</span>)}
      </div>
      <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 6 }}>{company.status}</div>
    </div>
  );
}

export function Route({ company }: { company: Company }) {
  const s = company.route;
  if (!s) return <p className="label">no route yet — 2Ys, tell us yours</p>;
  const W = 330, x = d3.scaleLinear([0, s.length - 1], [22, W - 22]);
  const pts = s.map((d, i) => [x(i), 34 + (i > 0 && i < s.length - 1 ? (i % 2 ? -12 : 12) : 0)] as [number, number]);
  return (
    <svg viewBox={`0 0 ${W} 80`} width="100%">
      <path d={d3.line().curve(d3.curveCatmullRom)(pts)!} fill="none" stroke="var(--ink)" strokeWidth={1.25} strokeDasharray="2 4" />
      {s.map((d, i) => {
        const [px, py] = pts[i];
        const st = STOP[d.type];
        const last = i === s.length - 1;
        return (
          <g key={i}>
            {d.type === "milestone"
              ? <circle cx={px} cy={py} r={last ? 6 : 4} fill={last ? "var(--cardinal)" : "var(--paper)"} stroke="var(--ink)" strokeWidth={1.25} />
              : <text x={px} y={py + 5} textAnchor="middle" fill={st.color} style={{ fontSize: 15 }}>{st.glyph}</text>}
            <text x={px} y={i % 2 && !last ? py - 12 : py + 22} textAnchor="middle" fill="var(--ink-2)" style={{ fontSize: 10.5 }}>{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Mix({ company }: { company: Company }) {
  const m = company.mix;
  if (!m) return null;
  const entries = Object.entries(m).filter(([, v]) => v) as [Exclude<StopType, "milestone">, number][];
  return (
    <div>
      <div style={{ display: "flex", gap: 2, height: 20 }}>
        {entries.map(([k, v]) => (
          <div key={k} title={`${STOP[k].label}: ${v}%`} style={{ width: `${v}%`, background: STOP[k].color, color: v >= 15 ? "#fff" : "transparent",
            fontFamily: "var(--mono)", fontSize: 10.5, padding: "3px 4px" }}>{v}%</div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6, fontSize: 11.5, color: "var(--ink-2)" }}>
        {entries.map(([k]) => <span key={k}><span style={{ color: STOP[k].color }}>{STOP[k].glyph}</span> {STOP[k].label}</span>)}
      </div>
    </div>
  );
}

export default function CompanyPanel({ company: c }: { company: Company }) {
  const cap = c.marketCapB >= 1000 ? `$${(c.marketCapB / 1000).toFixed(1)}T` : `$${Math.round(c.marketCapB)}B`;
  return (
    <aside className="panel" aria-live="polite">
      <div className="label">field notes</div>
      <h3>{c.name}</h3>
      <div className="sub">{waveLabel[c.wave].toLowerCase()} · {c.model.toLowerCase()} · {c.hq.toLowerCase()}</div>
      <dl>
        <dt>{c.capNote?.startsWith("Private") ? "valuation" : "market cap"}</dt><dd>{cap}{c.capNote ? ` (${c.capNote})` : ""}</dd>
        <dt>growth</dt><dd>{c.growthPct}%{c.growthNote ? ` — ${c.growthNote}` : ""}</dd>
        <dt>employees</dt><dd>{d3.format(",")(c.headcount)}</dd>
        <dt>in office</dt><dd>{c.rto}</dd>
        <dt>ai posture</dt><dd>{c.ai}</dd>
        <dt>process</dt><dd>{c.pattern}</dd>
      </dl>
      <h4>mba intern roles</h4>
      <div style={{ fontSize: 13, color: "var(--ink-2)", lineHeight: 1.7 }}>{c.roles.join(" · ")}</div>
      <h4>when applications opened · black = this cycle</h4>
      <SeasonBar company={c} />
      <h4>the interview route</h4>
      <Route company={c} />
      {c.mix && <><h4>where your interview time goes</h4><Mix company={c} /></>}
      {(c.route || c.mix) && <div className="caveat">Route and mix are placeholders until 2Y interns weigh in.</div>}
    </aside>
  );
}
