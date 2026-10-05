"use client";

import { useMemo } from "react";
import { calendar, companies, hiring, meta } from "@/data";
import { MARK, MARK_ORDER, trailItems, type Mark, type TrailItem } from "@/lib/marks";
import { SEASON_MONTHS, daysBetween, fmtDate, monthOf, monthStartWeek, seasonEnd, weekOf } from "@/lib/season";
import { useWidth } from "@/lib/useWidth";
import { useGuide } from "./Guide";

const cycle = meta.currentCycle;
const LANE = 21; // px between stacked tags
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** The short note after a company's name, when it adds something the glyph doesn't. */
function note(it: TrailItem) {
  if (it.daysLeft !== null && it.daysLeft >= 0 && it.daysLeft <= 30) return `${it.daysLeft}d`;
  return "";
}
/** Longer description for the vertical (phone) trail and for screen readers. */
function detail(it: TrailItem) {
  const when = monthOf(it.week, cycle);
  switch (it.mark) {
    case "closing":
    case "open":
      return it.daysLeft !== null && it.daysLeft >= 0 ? `closes in ${plural(it.daysLeft, "day")}` : `opened ${when}`;
    case "closed": return it.status.headline.toLowerCase();
    case "due": return `usually ${when}`;
    case "late": return `usually by ${when}`;
    default: return `usually ${when}`;
  }
}

export function MarkLegend({ marks = MARK_ORDER }: { marks?: Mark[] }) {
  return (
    <div className="marks" aria-label="Legend">
      {marks.map((m) => (
        <span key={m} className={`mark-chip m-${m}`}><span className="glyph" aria-hidden>{MARK[m].glyph}</span>{MARK[m].label}</span>
      ))}
    </div>
  );
}

export default function Trail() {
  const { today, live, select } = useGuide();
  const [ref, W] = useWidth<HTMLDivElement>(1060);
  const items = useMemo(() => trailItems(companies, hiring, today, cycle), [today]);
  const todayWk = weekOf(today, cycle);

  const current = calendar.filter((m) => m.to && m.kind !== "academic" && m.from <= today && today <= m.to);
  const next = calendar.filter((m) => m.from > today && m.kind !== "academic").sort((a, b) => a.from.localeCompare(b.from))[0];
  const age = daysBetween(meta.researched, today);
  const over = daysBetween(seasonEnd(cycle), today) > 0;
  const shown = new Set(items.map((i) => i.mark));

  return (
    <section className="trail" aria-labelledby="trail-h">
      <h2 id="trail-h" className="label">the season so far · {live ? fmtDate(today, { year: true }) : `as of ${fmtDate(meta.researched, { year: true })}`}</h2>
      {over && <p className="warn">The {cycle}–{Number(cycle) + 1 - 2000} season has ended. This guide hasn&apos;t been updated for the next one yet.</p>}
      {live && age > 10 && !over && (
        <p className="warn">Postings were last checked {fmtDate(meta.researched)} ({age} days ago). Confirm on the careers site before you count on anything here.</p>
      )}
      {/* Both layouts render; CSS shows the right one from the first paint (no flash before JS measures width). */}
      <div ref={ref} className="trail-h">{W >= 320 && <HorizontalTrail items={items} W={W} todayWk={todayWk} live={live} onPick={(id) => select(id, { reveal: true })} />}</div>
      <div className="trail-v"><VerticalTrail items={items} todayWk={todayWk} live={live} onPick={(id) => select(id, { reveal: true })} /></div>
      <MarkLegend marks={MARK_ORDER.filter((m) => shown.has(m))} />
      {(current.length > 0 || next) && (
        <p className="gsb-line">
          <span className="label">at the gsb</span>{" "}
          {current.map((m) => <span key={m.id}>{m.label} until {fmtDate(m.to!)} · </span>)}
          {next && <span>next: {next.label}, {fmtDate(next.from)}</span>}
        </p>
      )}
    </section>
  );
}

function HorizontalTrail({ items, W, todayWk, live, onPick }: { items: TrailItem[]; W: number; todayWk: number; live: boolean; onPick: (id: string) => void }) {
  const m = { l: 14, r: 14 };
  const first = Math.min(...items.map((i) => i.week), todayWk);
  const last = Math.max(...items.map((i) => i.week), todayWk);
  const i0 = Math.max(0, [...SEASON_MONTHS.keys()].findLast((i) => monthStartWeek(i, cycle) <= first - 1) ?? 0);
  const i1 = Math.min(SEASON_MONTHS.length - 1, ([...SEASON_MONTHS.keys()].find((i) => monthStartWeek(i, cycle) > last + 1) ?? SEASON_MONTHS.length) - 1);
  const w0 = monthStartWeek(i0, cycle), w1 = i1 + 1 < SEASON_MONTHS.length ? monthStartWeek(i1 + 1, cycle) : last + 2;
  const x = (wk: number) => m.l + ((wk - w0) / (w1 - w0)) * (W - m.l - m.r);

  // Pack tags into lanes above (posted) and below (not yet) the path so labels never overlap.
  const ends: Record<"up" | "down", number[]> = { up: [], down: [] };
  const placed = items.map((it) => {
      const side = it.posted ? "up" : "down";
      const text = `${it.company.name}${note(it) ? ` ${note(it)}` : ""}`;
      const width = text.length * 6.9 + 22;
      const left = Math.min(W - m.r - width, Math.max(m.l, x(it.week) - 7));
      let lane = ends[side].findIndex((end) => end + 6 < left);
      if (lane < 0) lane = ends[side].push(0) - 1;
      ends[side][lane] = left + width;
      return { it, side, lane, left, width, text };
  });

  const upLanes = Math.max(1, ...placed.filter((p) => p.side === "up").map((p) => p.lane + 1));
  const downLanes = Math.max(1, ...placed.filter((p) => p.side === "down").map((p) => p.lane + 1));
  const mid = 18 + upLanes * LANE + 8;
  const H = mid + 16 + downLanes * LANE + 26;
  const bands = calendar.filter((c) => c.timeline && c.to && (c.kind === "quiet" || c.kind === "interviews"));

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="trail-svg" role="group" aria-label="Companies placed on the recruiting season. Above the path: posted this cycle. Below: not posted yet.">
      {bands.map((b) => (
        <rect key={b.id} x={x(weekOf(b.from, cycle))} width={Math.max(2, x(weekOf(b.to!, cycle) + 1 / 7) - x(weekOf(b.from, cycle)))} y={mid - 5} height={10}
          className={`band band-${b.kind}`}><title>{`${b.label}: ${fmtDate(b.from)} – ${fmtDate(b.to!)}`}</title></rect>
      ))}
      <line x1={m.l} x2={W - m.r} y1={mid} y2={mid} className="path" />
      {SEASON_MONTHS.slice(i0, i1 + 1).map((mo, k) => {
        const mx = x(monthStartWeek(i0 + k, cycle));
        return (
          <g key={mo}>
            <line x1={mx} x2={mx} y1={mid - 4} y2={mid + 4} className="month-tick" />
            <text x={mx + 4} y={mid + 15} className="month">{mo}</text>
          </g>
        );
      })}
      {placed.map(({ it, side, lane, left, width, text }) => {
        const y = side === "up" ? mid - 14 - lane * LANE : mid + 30 + lane * LANE;
        const px = x(it.week);
        return (
          <g key={it.company.id}>
            <line x1={px} x2={px} y1={mid} y2={side === "up" ? y + 5 : y - 15} className="stem" />
            <circle cx={px} cy={mid} r={2.5} className={`foot m-${it.mark}`} />
            <g className={`tag m-${it.mark}`} transform={`translate(${left},${y - 14})`} role="button" tabIndex={0}
              aria-label={`${it.company.name}: ${MARK[it.mark].label}, ${detail(it)}`}
              onClick={() => onPick(it.company.id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(it.company.id); } }}>
              <rect width={width} height={19} rx={3} />
              <text x={7} y={13.5}><tspan className="glyph">{MARK[it.mark].glyph}</tspan> {text}</text>
            </g>
          </g>
        );
      })}
      {live && todayWk >= w0 && todayWk <= w1 && (
        <g className="here">
          <line x1={x(todayWk)} x2={x(todayWk)} y1={8} y2={H - 16} />
          <text x={x(todayWk) + 5} y={H - 4}>you are here</text>
        </g>
      )}
    </svg>
  );
}

function VerticalTrail({ items, todayWk, live, onPick }: { items: TrailItem[]; todayWk: number; live: boolean; onPick: (id: string) => void }) {
  const split = items.findIndex((it) => it.week > todayWk);
  const before = split < 0 ? items : items.slice(0, split);
  const after = split < 0 ? [] : items.slice(split);
  const row = (it: TrailItem) => (
    <li key={it.company.id}>
      <button className={`vrow m-${it.mark}`} onClick={() => onPick(it.company.id)} aria-label={`${it.company.name}: ${MARK[it.mark].label}, ${detail(it)}`}>
        <span className="glyph" aria-hidden>{MARK[it.mark].glyph}</span>
        <span className="vname">{it.company.name}</span>
        <span className="vmeta">{detail(it)}</span>
      </button>
    </li>
  );
  return (
    <ol className="vtrail">
      {before.map(row)}
      {live && <li className="vhere" aria-label="You are here"><span>you are here</span></li>}
      {after.map(row)}
    </ol>
  );
}
