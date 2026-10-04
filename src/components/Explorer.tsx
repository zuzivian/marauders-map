"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { companies, type Company, waveLabel } from "@/data/companies";
import CompanyPanel from "./CompanyPanel";
import { SEASON_WEEKS, monthOf, typicalOpen } from "@/data/season";

type AxisKey = "appOpen" | "b2bUser" | "b2bPayer" | "growthPct" | "marketCapB" | "headcount" | "rtoDays";

const AXES: Record<AxisKey, { label: string; short: string; scale: () => d3.ScaleContinuousNumeric<number, number>; fmt: (v: number) => string; get: (c: Company) => number }> = {
  appOpen: { label: "When applications usually open", short: "Applications open", scale: () => d3.scaleLinear().domain([0, SEASON_WEEKS]), fmt: (v) => (v >= SEASON_WEEKS - 1 ? "no program" : monthOf(v).replace(/^(early|mid|late) /, "")), get: (c) => typicalOpen(c) ?? SEASON_WEEKS - 1 },
  b2bUser: { label: "Who uses it: consumers → businesses", short: "Who uses it", scale: () => d3.scaleLinear().domain([0, 100]), fmt: (v) => `${v}%`, get: (c) => c.b2bUser },
  b2bPayer: { label: "Who pays: consumers → businesses", short: "Who pays", scale: () => d3.scaleLinear().domain([0, 100]), fmt: (v) => `${v}%`, get: (c) => c.b2bPayer },
  growthPct: { label: "Revenue growth, year over year", short: "Revenue growth", scale: () => d3.scaleLog().domain([4, 320]).clamp(true), fmt: (v) => `${v}%`, get: (c) => c.growthPct },
  marketCapB: { label: "Market cap", short: "Market cap", scale: () => d3.scaleLog().domain([50, 9000]), fmt: fmtCap, get: (c) => c.marketCapB },
  headcount: { label: "Employees", short: "Employees", scale: () => d3.scaleLog().domain([3000, 2.5e6]), fmt: (v) => d3.format(".2~s")(v), get: (c) => c.headcount },
  rtoDays: { label: "Required days in office", short: "Days in office", scale: () => d3.scaleLinear().domain([0, 5]), fmt: (v) => `${v}`, get: (c) => c.rtoDays ?? 0 },
};

function fmtCap(v: number) {
  return v >= 1000 ? `$${d3.format(".1~f")(v / 1000)}T` : `$${d3.format(".0f")(v)}B`;
}

const WAVE_FILL = { early: "#5e1010", fall: "var(--cardinal)", winter: "var(--cardinal-3)", none: "transparent" } as const;
const W = 720, H = 540, M = { l: 56, r: 24, t: 28, b: 52 };

export default function Explorer() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [x, setX] = useState<AxisKey>("b2bUser");
  const [y, setY] = useState<AxisKey>("growthPct");
  const [selected, setSelected] = useState<Company>(companies[0]);
  const r = useMemo(() => d3.scaleSqrt([0, 6000], [0, 32]), []);
  const radius = (c: Company) => Math.max(11, r(c.marketCapB));

  useEffect(() => {
    const svg = d3.select(svgRef.current!);
    const ax = AXES[x], ay = AXES[y];
    const sx = ax.scale().range([M.l + 24, W - M.r - 24]);
    const sy = ay.scale().range([H - M.b - 24, M.t + 24]);

    // Resolve overlaps so every bubble stays clickable.
    const nodes = companies.map((c) => ({ c, tx: sx(ax.get(c)), ty: sy(ay.get(c)), x: sx(ax.get(c)), y: sy(ay.get(c)) }));
    const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[] & typeof nodes)
      .force("x", d3.forceX<(typeof nodes)[number]>((d) => d.tx).strength(0.6))
      .force("y", d3.forceY<(typeof nodes)[number]>((d) => d.ty).strength(0.6))
      .force("collide", d3.forceCollide<(typeof nodes)[number]>((d) => radius(d.c) + (radius(d.c) >= 22 ? 4 : 10)))
      .stop();
    for (let i = 0; i < 240; i++) sim.tick();

    const t = svg.transition().duration(900).ease(d3.easeCubicInOut);
    const ticksFor = (s: d3.ScaleContinuousNumeric<number, number>, k: AxisKey) =>
      k === "marketCapB" ? [100, 300, 1000, 3000] : k === "headcount" ? [1e4, 1e5, 1e6] : k === "growthPct" ? [5, 10, 25, 50, 100, 250] : k === "appOpen" ? [13.3, 21.9, 30.6, 39.4, 47] : s.ticks(5);

    svg.select<SVGGElement>(".gx").attr("transform", `translate(0,${H - M.b})`).transition(t as never)
      .call(d3.axisBottom(sx).tickValues(ticksFor(sx, x)).tickFormat((v) => ax.fmt(+v)).tickSize(-(H - M.t - M.b)).tickPadding(10));
    svg.select<SVGGElement>(".gy").attr("transform", `translate(${M.l},0)`).transition(t as never)
      .call(d3.axisLeft(sy).tickValues(ticksFor(sy, y)).tickFormat((v) => ay.fmt(+v)).tickSize(-(W - M.l - M.r)).tickPadding(10));
    svg.selectAll(".domain").remove();
    svg.selectAll(".tick line").attr("stroke", "var(--rule)").attr("stroke-width", 0.5);
    svg.selectAll(".tick text").attr("fill", "var(--ink-3)").style("font-family", "var(--mono)").style("font-size", "11px");

    const g = svg.select<SVGGElement>(".nodes");
    const sel = g.selectAll<SVGGElement, (typeof nodes)[number]>("g.node").data(nodes, (d) => d.c.id);
    const enter = sel.enter().append("g").attr("class", "node").style("cursor", "pointer")
      .attr("transform", (d) => `translate(${d.x},${d.y})`)
      .on("click", (_, d) => setSelected(d.c));
    enter.append("circle").attr("r", (d) => radius(d.c)).attr("fill", (d) => WAVE_FILL[d.c.wave]).attr("fill-opacity", 0.88)
      .attr("stroke", (d) => (d.c.wave === "none" ? "var(--ink-3)" : "var(--paper)")).attr("stroke-width", 1.5).attr("stroke-dasharray", (d) => (d.c.wave === "none" ? "3 2" : null));
    // Big bubbles carry their label inside; small ones get it underneath.
    enter.append("text").attr("text-anchor", "middle")
      .attr("dy", (d) => (radius(d.c) >= 22 ? 4 : radius(d.c) + 14))
      .style("font-size", "12px").style("pointer-events", "none")
      .attr("fill", (d) => (radius(d.c) >= 22 && (d.c.wave === "fall" || d.c.wave === "early") ? "var(--paper)" : "var(--ink)")).text((d) => d.c.name);
    enter.append("title").text((d) => `${d.c.name} — ${waveLabel[d.c.wave]}`);
    enter.merge(sel).transition(t as never).attr("transform", (d) => `translate(${d.x},${d.y})`);

    // Quadrant names and margin notes only make sense on the default view.
    const q = svg.select(".quads");
    q.selectAll("*").remove();
    if (x === "b2bUser" && y === "growthPct") {
      const quads: [string, number, number, "start" | "end"][] = [
        ["Consumer rockets", M.l + 14, M.t + 18, "start"], ["Enterprise rockets", W - M.r - 8, M.t + 18, "end"],
        ["Consumer giants", M.l + 14, H - M.b - 12, "start"], ["Enterprise incumbents", W - M.r - 8, H - M.b - 12, "end"],
      ];
      quads.forEach(([s, qx, qy, a]) => q.append("text").text(s).attr("x", qx).attr("y", qy).attr("text-anchor", a)
        .style("font-family", "var(--serif)").style("font-style", "italic").style("font-size", "16px").attr("fill", "var(--ink-3)"));
      const oa = nodes.find((n) => n.c.id === "openai")!;
      const nv = nodes.find((n) => n.c.id === "nvidia")!;
      const note = (n: typeof oa, text: string[], dx: number, dy: number) => {
        q.append("path").attr("d", `M${n.x + dx * 0.25},${n.y + dy * 0.6} Q${n.x + dx * 0.9},${n.y + dy * 0.3} ${n.x + dx},${n.y + dy}`)
          .attr("fill", "none").attr("stroke", "var(--cardinal)").attr("stroke-width", 0.75);
        text.forEach((l, i) => q.append("text").text(l).attr("x", n.x + dx + (dx < 0 ? -4 : 4)).attr("y", n.y + dy + 4 + i * 16)
          .attr("text-anchor", dx < 0 ? "end" : "start").attr("class", "note").style("font-size", "14px").attr("fill", "var(--cardinal)"));
      };
      note(oa, ["Hollow: no MBA internship.", "Growth is annualized, not YoY."], -70, 30);
      note(nv, ["Growing 83% on a", "$5.6T base."], -50, 52);
    }

    svg.selectAll<SVGGElement, (typeof nodes)[number]>("g.node").select("circle")
      .attr("stroke", (d) => (d.c.id === selected.id ? "var(--ink)" : d.c.wave === "none" ? "var(--ink-3)" : "var(--paper)"))
      .attr("stroke-width", (d) => (d.c.id === selected.id ? 2.5 : 1.5));
  }, [x, y, selected, r]);

  return (
    <div className="explorer">
      <div>
        <div className="controls">
          <span>Across</span>
          <select className="select" value={x} onChange={(e) => setX(e.target.value as AxisKey)} aria-label="Horizontal axis">
            {Object.entries(AXES).map(([k, a]) => <option key={k} value={k}>{a.short}</option>)}
          </select>
          <span>Up</span>
          <select className="select" value={y} onChange={(e) => setY(e.target.value as AxisKey)} aria-label="Vertical axis">
            {Object.entries(AXES).map(([k, a]) => <option key={k} value={k}>{a.short}</option>)}
          </select>
          <span className="label" style={{ marginLeft: "auto" }}>bubble size = market cap</span>
        </div>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" className="chart" role="img"
          aria-label={`Bubble chart of 12 tech companies: ${AXES[x].label} versus ${AXES[y].label}`}>
          <g className="gx" /><g className="gy" /><g className="quads" /><g className="nodes" />
          <text x={W - M.r} y={H - 10} textAnchor="end" fill="var(--ink-2)" style={{ fontSize: 12 }}>{AXES[x].label} →</text>
          <text x={M.l} y={14} fill="var(--ink-2)" style={{ fontSize: 12 }}>↑ {AXES[y].label}</text>
        </svg>
        <div className="legend">
          <span><i style={{ background: "#5e1010" }} />Opens by August</span>
          <span><i style={{ background: "var(--cardinal)" }} />Opens Sep–Oct</span>
          <span><i style={{ background: "var(--cardinal-3)" }} />Opens Dec–Jan</span>
          <span><i style={{ border: "1px dashed var(--ink-3)" }} />No MBA internship</span>
        </div>
        <div className="caveat">
          Market caps as of Oct 2, 2026. Growth is trailing-twelve-month revenue. Consumer/business splits are our estimates from segment reporting; companies don&apos;t disclose them.
        </div>
      </div>
      <CompanyPanel company={selected} />
    </div>
  );
}
