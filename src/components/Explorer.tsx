"use client";

import { Fragment, useMemo, useState } from "react";
import { scaleLinear, scaleLog, scaleSqrt } from "d3-scale";
import { forceCollide, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { format } from "d3-format";
import { companies, hiring, meta, type Company } from "@/data";
import { SEASON_MONTHS, SEASON_WEEKS, monthStartWeek, typicalOpen, waveOf, type Wave } from "@/lib/season";
import { fmtCap, fmtCount, fmtMonthly, latest, perMonth } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";
import { useGuide } from "./Guide";
import CompanyPanel from "./CompanyPanel";

type AxisKey = "pay" | "visa" | "appOpen" | "growth" | "marketCap" | "headcount" | "office";
interface Point { v: number; lo?: number; hi?: number }
interface Axis {
  label: string;
  short: string;
  log?: boolean;
  get: (c: Company) => Point;
  fmt: (v: number) => string;
  ticks?: (domain: [number, number]) => number[];
}

const cycle = meta.currentCycle;
const NO_PROGRAM = SEASON_WEEKS - 2;
// Office policy as an ordered scale: remote-first, then office-based with no minimum, then required days.
const OFFICE_REMOTE = -1.6, OFFICE_FLEX = -0.6;
const range = (m: { value: number; low?: number; high?: number }): Point => ({ v: m.value, lo: m.low, hi: m.high });
// Intern pay a month, from the range the postings state. Companies whose postings state none get their own lane below the lowest.
function payPoint(c: Company): Point | null {
  const p = c.intern?.pay;
  if (!p) return null;
  const lo = perMonth(p.low, p.per), hi = perMonth(p.high, p.per);
  return { v: (lo + hi) / 2, lo, hi };
}
const PAID = companies.map(payPoint).filter((p): p is Point => p !== null);
const PAY_STEP = 2000;
const PAY_FIRST = Math.ceil(Math.min(...PAID.map((p) => p.lo ?? p.v)) / PAY_STEP) * PAY_STEP;
const PAY_NONE = PAY_FIRST - 1.5 * PAY_STEP;
const PAY_MAX = Math.max(...PAID.map((p) => p.hi ?? p.v));
// Sponsorship as lanes: what the postings say, with "not stated" kept apart rather than read as a no.
const VISA_LANE = { "no sponsorship": 0, "authorization required": 1, sponsors: 2 } as const;
const VISA_NONE = -1.2;
const logTicks = ([a, b]: [number, number]) =>
  [1, 2.5, 5].flatMap((k) => [0, 1, 2, 3, 4, 5, 6].map((e) => k * 10 ** e)).filter((t) => t >= a && t <= b).sort((x, y) => x - y);

const AXES: Record<AxisKey, Axis> = {
  pay: {
    label: "Intern pay a month, as posted", short: "Intern pay",
    get: (c) => payPoint(c) ?? { v: PAY_NONE },
    fmt: (v) => (v <= PAY_NONE ? "not stated" : fmtMonthly(v)),
    ticks: () => [PAY_NONE, ...Array.from({ length: Math.floor((PAY_MAX - PAY_FIRST) / PAY_STEP) + 1 }, (_, i) => PAY_FIRST + i * PAY_STEP)],
  },
  visa: {
    label: "Visa sponsorship, as a posting states it", short: "Visa sponsorship",
    get: (c) => ({ v: c.intern?.sponsorship ? VISA_LANE[c.intern.sponsorship.stance] : VISA_NONE }),
    fmt: (v) => (v === VISA_NONE ? "not stated" : ["no", "needs auth", "yes"][Math.round(v)]),
    ticks: () => [VISA_NONE, 0, 1, 2],
  },
  appOpen: {
    label: "When applications usually open", short: "Applications open",
    get: (c) => {
      const t = hiring[c.id].hasProgram ? typicalOpen(hiring[c.id], cycle) : null;
      return t ? { v: t.week, lo: t.min, hi: t.max } : { v: NO_PROGRAM };
    },
    fmt: (v) => (v >= NO_PROGRAM - 0.5 ? "none" : SEASON_MONTHS[[...SEASON_MONTHS.keys()].findLast((i) => monthStartWeek(i, cycle) <= v + 0.5) ?? 0]),
    ticks: () => [1, 3, 5, 7, 9].map((i) => monthStartWeek(i, cycle)).concat(NO_PROGRAM),
  },
  growth: { label: "Revenue growth, year over year", short: "Revenue growth", log: true, get: (c) => range(c.growth), fmt: (v) => `${v}%`, ticks: logTicks },
  marketCap: { label: "Market value ($)", short: "Market value", log: true, get: (c) => range(c.marketCap), fmt: fmtCap, ticks: (d) => logTicks(d).filter((t) => String(t)[0] !== "5") },
  headcount: { label: "Employees", short: "Employees", log: true, get: (c) => range(c.headcount), fmt: fmtCount, ticks: (d) => logTicks(d).filter((t) => String(t)[0] === "1") },
  office: {
    label: "Days a week in the office", short: "Office days",
    get: ({ office: o }) =>
      o.category === "remote" ? { v: OFFICE_REMOTE } : o.category === "flexible" || (o.category === "team" && o.low === undefined) ? { v: OFFICE_FLEX } : { v: o.days ?? ((o.low ?? 0) + (o.high ?? 0)) / 2, lo: o.low, hi: o.high },
    fmt: (v) => (v === OFFICE_REMOTE ? "remote" : v === OFFICE_FLEX ? "no rule" : format("~g")(v)),
    ticks: () => [OFFICE_REMOTE, OFFICE_FLEX, 1, 2, 3, 4, 5],
  },
};

// Rounded to a hundredth of a pixel: browsers shorten long decimals in a style attribute, so unrounded positions
// from the layout read back differently from the prerendered HTML and break hydration.
const translate = (x: number, y: number) => `translate(${Math.round(x * 100) / 100}px, ${Math.round(y * 100) / 100}px)`;

function domainFor(k: AxisKey): [number, number] {
  const a = AXES[k];
  if (k === "appOpen") return [0, SEASON_WEEKS];
  if (k === "office") return [-2.2, 5.4];
  if (k === "pay") return [PAY_NONE - PAY_STEP / 2, PAY_MAX * 1.04];
  if (k === "visa") return [VISA_NONE - 0.5, 2.5];
  const vals = companies.flatMap((c) => { const p = a.get(c); return [p.v, p.lo ?? p.v, p.hi ?? p.v]; }).filter((v) => v > 0);
  return [Math.min(...vals) / 1.5, Math.max(...vals) * 1.5];
}

export const WAVE_FILL: Record<Wave, string> = { summer: "var(--cardinal-dark)", fall: "var(--cardinal)", winter: "var(--cardinal-3)", none: "transparent" };
// The colour key, worded to follow "Colour is when applications usually open:".
const WAVE_KEY: Record<Wave, string> = { summer: "by August", fall: "Sep–Oct", winter: "Nov or later", none: "no MBA internship" };
type Node = SimulationNodeDatum & { c: Company; tx: number; ty: number; r: number; x: number; y: number };

export default function Explorer() {
  const { selected, select } = useGuide();
  const [x, setX] = useState<AxisKey>("office");
  const [y, setY] = useState<AxisKey>("pay");
  const [wrapRef, measured] = useWidth<HTMLDivElement>(720);
  const W = measured || 720; // the section starts folded, where the chart measures 0 wide; lay out as prerendered until it opens
  // Animate only when the reader changes an axis, not when the chart first measures itself or resizes.
  const [animateAt, setAnimateAt] = useState<number | null>(null);
  const narrow = W < 560;
  const fs = narrow ? 11 : 12;
  const H = Math.round(Math.min(560, narrow ? W * 1.1 : W * 0.74));
  // Leave room on the left for the longest vertical-axis label, e.g. "not stated".
  const yLabel = Math.max(...(AXES[y].ticks?.(domainFor(y)) ?? []).map((t) => AXES[y].fmt(t).length));
  const M = { l: Math.max(narrow ? 46 : 58, Math.round(yLabel * (fs - 1) * 0.62 + 12)), r: 14, t: 30, b: 44 };
  const waves = useMemo(() => Object.fromEntries(companies.map((c) => [c.id, waveOf(hiring[c.id], cycle)])) as Record<string, Wave>, []);

  const { sx, sy, nodes } = useMemo(() => {
    const scale = (k: AxisKey) => (AXES[k].log ? scaleLog() : scaleLinear()).domain(domainFor(k)).clamp(true);
    const sx = scale(x).range([M.l + 18, W - M.r - 18]);
    const sy = scale(y).range([H - M.b - 18, M.t + 18]);
    const r = scaleSqrt([0, Math.max(...companies.map((c) => c.marketCap.value))], [0, narrow ? 24 : 34]);
    const nodes: Node[] = companies.map((c) => {
      const tx = sx(AXES[x].get(c).v), ty = sy(AXES[y].get(c).v);
      return { c, tx, ty, x: tx, y: ty, r: Math.max(narrow ? 8 : 11, r(c.marketCap.value)) };
    });
    // Nudge overlapping bubbles apart so every one stays clickable; whiskers move with their bubble.
    const sim = forceSimulation(nodes)
      .force("x", forceX<Node>((d) => d.tx).strength(0.6))
      .force("y", forceY<Node>((d) => d.ty).strength(0.6))
      // Small bubbles carry their label underneath, so they also reserve room for its width.
      .force("collide", forceCollide<Node>((d) => (d.r >= 22 ? d.r + 3 : Math.max(d.r + (narrow ? 9 : 12), d.c.name.length * (narrow ? 3.4 : 3.8)))).iterations(3))
      .stop();
    const half = (d: Node) => (d.r >= 22 ? d.r : Math.max(d.r, d.c.name.length * (narrow ? 3.4 : 3.8)));
    for (let i = 0; i < 240; i++) {
      sim.tick();
      // Keep every bubble and its label inside the plot.
      for (const d of nodes) d.x = Math.min(W - M.r - half(d), Math.max(M.l + half(d), d.x));
    }
    return { sx, sy, nodes };
  }, [x, y, W, H, narrow, M.l, M.r, M.t, M.b]);

  const ax = AXES[x], ay = AXES[y];
  const xt = ax.ticks?.(sx.domain() as [number, number]) ?? sx.ticks(5);
  const yt = ay.ticks?.(sy.domain() as [number, number]) ?? sy.ticks(5);
  const capAsOf = latest(companies.filter((c) => c.marketCap.kind === "market cap").map((c) => c.marketCap.asOf));
  const sel = companies.find((c) => c.id === selected)!;
  const shown = ([x, y] as AxisKey[]).filter((k, i, a) => (k === "pay" || k === "visa") && a.indexOf(k) === i);

  const axisSelect = (value: AxisKey, set: (k: AxisKey) => void, label: string) => (
    <select className="select" value={value} onChange={(e) => { setAnimateAt(W); set(e.target.value as AxisKey); }} aria-label={label}>
      {(Object.keys(AXES) as AxisKey[]).map((k) => <option key={k} value={k}>{AXES[k].short}</option>)}
    </select>
  );

  return (
    <div className="explorer">
      <div>
        <div className="controls">
          <span className="pair">Across {axisSelect(x, setX, "Horizontal axis")}</span>
          <span className="pair">Up {axisSelect(y, setY, "Vertical axis")}</span>
        </div>
        <div ref={wrapRef}>
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className={`chart${animateAt === W ? " animate" : ""}`} role="group" aria-label={`${companies.length} companies plotted by ${ax.label} and ${ay.label}. Use the buttons below the chart, or tab to a bubble, to open its field notes.`}>
            {xt.map((t) => (
              <g key={`x${t}`}>
                <line x1={sx(t)} x2={sx(t)} y1={M.t} y2={H - M.b} className="grid" />
                <text x={sx(t)} y={H - M.b + 16} textAnchor="middle" className="tick" style={{ fontSize: fs - 1 }}>{ax.fmt(t)}</text>
              </g>
            ))}
            {yt.map((t) => (
              <g key={`y${t}`}>
                <line x1={M.l} x2={W - M.r} y1={sy(t)} y2={sy(t)} className="grid" />
                <text x={M.l - 8} y={sy(t) + 4} textAnchor="end" className="tick" style={{ fontSize: fs - 1 }}>{ay.fmt(t)}</text>
              </g>
            ))}
            <g className="whiskers">
              {nodes.map((d) => {
                const px = ax.get(d.c), py = ay.get(d.c), dx = d.x - d.tx, dy = d.y - d.ty;
                return (
                  <g key={d.c.id} className="nodepos" style={{ transform: translate(dx, dy) }}>
                    {px.lo !== undefined && px.hi !== undefined && px.hi > px.lo && <Whisker x1={sx(px.lo)} x2={sx(px.hi)} y1={d.ty} y2={d.ty} />}
                    {py.lo !== undefined && py.hi !== undefined && py.hi > py.lo && <Whisker x1={d.tx} x2={d.tx} y1={sy(py.lo)} y2={sy(py.hi)} />}
                  </g>
                );
              })}
            </g>
            {nodes.map((d) => {
              const w = waves[d.c.id], on = d.c.id === selected, inside = d.r >= 22;
              return (
                <g key={d.c.id} className="node nodepos" style={{ transform: translate(d.x, d.y) }} role="button" tabIndex={0}
                  aria-pressed={on} aria-label={`${d.c.name}: ${ax.short} ${ax.fmt(ax.get(d.c).v)}, ${ay.short} ${ay.fmt(ay.get(d.c).v)}`}
                  onClick={() => select(d.c.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(d.c.id); } }}>
                  <circle r={d.r} fill={WAVE_FILL[w]} fillOpacity={0.9} stroke={on ? "var(--ink)" : w === "none" ? "var(--ink-3)" : "var(--paper)"}
                    strokeWidth={on ? 2.5 : 1.5} strokeDasharray={w === "none" ? "3 2" : undefined} />
                  <text textAnchor="middle" dy={inside ? 4 : d.r + fs + 2} style={{ fontSize: fs }}
                    fill={inside && w !== "winter" && w !== "none" ? "var(--paper)" : "var(--ink)"}>{d.c.name}</text>
                </g>
              );
            })}
            <text x={W - M.r} y={H - 8} textAnchor="end" className="axis-title" style={{ fontSize: fs }}>{ax.label} →</text>
            <text x={M.l} y={14} className="axis-title" style={{ fontSize: fs }}>↑ {ay.label}</text>
          </svg>
        </div>
        <p className="chart-key">
          Bubble size is market value; whiskers show a range. Colour is when applications usually open:{" "}
          {(["summer", "fall", "winter", "none"] as Wave[]).map((w, i) => (
            <Fragment key={w}>{i > 0 && ", "}<span className="pair"><i className="dot" style={w === "none" ? { border: "1px dashed var(--ink-3)" } : { background: WAVE_FILL[w] }} />{WAVE_KEY[w]}</span></Fragment>
          ))}.
        </p>
        <label className="picker">
          Field notes for{" "}
          <select className="select" value={selected} onChange={(e) => select(e.target.value)}>
            {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="muted"> or tap a bubble</span>
        </label>
        <details className="why">
          <summary>How these are measured</summary>
          <p>
            Market values as of {capAsOf}{companies.some((c) => c.marketCap.kind === "private valuation") ? " (private companies: latest reported valuation)" : ""}.
            Growth is revenue over the latest twelve reported months vs the twelve before, from SEC filings; for private companies it&apos;s reported figures, shown as a range. On &ldquo;applications open&rdquo;, bars span past cycles.
          </p>
          <p>
            Intern pay is the range stated on US MBA intern postings (this cycle&apos;s where they&apos;re up, otherwise last cycle&apos;s), put on a monthly basis with hourly rates at 40 hours a week; bars span the range.
            Visa sponsorship is only what a posting says outright; &ldquo;needs auth&rdquo; means you must already be authorized to work in the US.
          </p>
          {shown.length > 0 && <p>{shown.map((k) => <span key={k}>{AXES[k].short} not stated: {companies.filter((c) => AXES[k].get(c).v === (k === "pay" ? PAY_NONE : VISA_NONE)).map((c) => c.name).join(", ")}. </span>)}</p>}
        </details>
      </div>
      <CompanyPanel company={sel} />
      <div className="sr-only" aria-live="polite">Showing field notes for {sel.name}</div>
    </div>
  );
}

function Whisker({ x1, x2, y1, y2 }: { x1: number; x2: number; y1: number; y2: number }) {
  const v = x1 === x2;
  return (
    <g className="whisker">
      <line x1={x1} x2={x2} y1={y1} y2={y2} />
      <line x1={v ? x1 - 3 : x1} x2={v ? x1 + 3 : x1} y1={v ? y1 : y1 - 3} y2={v ? y1 : y1 + 3} />
      <line x1={v ? x2 - 3 : x2} x2={v ? x2 + 3 : x2} y1={v ? y2 : y2 - 3} y2={v ? y2 : y2 + 3} />
    </g>
  );
}
