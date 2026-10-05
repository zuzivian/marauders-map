"use client";

import { calendar, meta } from "@/data";
import type { CalendarMarker } from "@/data/types";
import { SEASON_MONTHS, fmtDate, fmtRange, monthStartWeek, weekOf } from "@/lib/season";
import { prose } from "@/lib/format";
import { useWidth } from "@/lib/useWidth";
import { useGuide } from "./Guide";
import { Cite } from "./Sources";

const cycle = meta.currentCycle;
const key = calendar.filter((m) => m.key);
// Two lanes: what employers may do with you, and the GSB-run recruiting milestones.
const LANES: { label: string; kinds: CalendarMarker["kind"][] }[] = [
  { label: "employer contact", kinds: ["quiet", "events"] },
  { label: "recruiting", kinds: ["blackout", "interviews", "deadline"] },
];
const START = SEASON_MONTHS.indexOf("Sep"), END = SEASON_MONTHS.indexOf("Feb");

/** The GSB calendar as a strip: bands for windows, pins for single dates, the key dates as chips underneath. */
export default function GsbStrip() {
  const { today, live } = useGuide();
  const [ref, W] = useWidth<HTMLDivElement>(1000);
  const w0 = monthStartWeek(START, cycle), w1 = monthStartWeek(END + 1, cycle);
  const LW = W < 520 ? 0 : 118; // lane labels sit above the lanes on phones
  const x = (iso: string) => LW + ((weekOf(iso, cycle) - w0) / (w1 - w0)) * (W - LW - 8);
  const ROW = 34, TOP = 20, H = TOP + LANES.length * ROW + (LW ? 6 : 16);
  const laneY = (i: number) => TOP + i * ROW + (LW ? 0 : 10);
  // Merge the three OCI interview weeks into one chip.
  const chips = key.filter((m) => !(m.key === "OCI interviews" && m.id !== "internship-interviews-week1"));
  const ociEnd = key.filter((m) => m.key === "OCI interviews").map((m) => m.to!).sort().at(-1);

  return (
    <div className="gsb">
      <div ref={ref}>
        {W >= 280 && (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="gsb-svg" role="img" aria-label="GSB recruiting calendar, September to February">
            {SEASON_MONTHS.slice(START, END + 1).map((mo, k) => {
              const mx = LW + ((monthStartWeek(START + k, cycle) - w0) / (w1 - w0)) * (W - LW - 8);
              return <g key={mo}><line x1={mx} x2={mx} y1={TOP - 4} y2={H - 4} className="grid" /><text x={mx + 3} y={12} className="month">{mo}</text></g>;
            })}
            {LANES.map((lane, i) => (
              <g key={lane.label}>
                {LW ? <text x={0} y={laneY(i) + 15} className="lane">{lane.label}</text> : <text x={0} y={laneY(i) - 3} className="lane">{lane.label}</text>}
                {key.filter((m) => lane.kinds.includes(m.kind)).map((m) =>
                  m.to ? (
                    <rect key={m.id} x={x(m.from)} y={laneY(i) + 4} width={Math.max(3, x(m.to) - x(m.from) + (W - LW) / 220)} height={16} className={`b b-${m.kind}`}>
                      <title>{`${m.key}: ${fmtRange(m.from, m.to)}`}</title>
                    </rect>
                  ) : (
                    <g key={m.id} className={`pin p-${m.kind}`}>
                      <line x1={x(m.from)} x2={x(m.from)} y1={laneY(i) + 1} y2={laneY(i) + 23} />
                      <circle cx={x(m.from)} cy={laneY(i) + 12} r={3.5} />
                      <title>{`${m.key}: ${fmtDate(m.from)}`}</title>
                    </g>
                  ),
                )}
              </g>
            ))}
            {live && weekOf(today, cycle) >= w0 && weekOf(today, cycle) <= w1 && (
              <line x1={x(today)} x2={x(today)} y1={TOP - 6} y2={H} className="here" />
            )}
          </svg>
        )}
      </div>
      <ul className="gsb-chips">
        {chips.map((m) => {
          const range = m.key === "OCI interviews" ? fmtRange(m.from, ociEnd!) : m.to ? fmtRange(m.from, m.to) : fmtDate(m.from);
          return (
            <li key={m.id} className={`c-${m.kind}`}><span className="d">{range}</span>{m.key}</li>
          );
        })}
      </ul>
      <details className="why">
        <summary>Full GSB calendar and policy notes</summary>
        <ul className="gsb-key">
          {calendar.map((m) => (
            <li key={m.id}>
              <span className="gsb-date">{m.to ? fmtRange(m.from, m.to) : fmtDate(m.from)}</span>
              <span><strong>{m.label}.</strong> {prose(m.description, Number(cycle))}{m.confidence !== "high" && <span className="flag"> · {m.confidence} confidence</span>} <Cite ids={m.sources} /></span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
