import { format } from "d3-format";
import { fmtDate } from "./season";

export const fmtCap = (b: number) => (b >= 1000 ? `$${format(".2~r")(b / 1000)}T` : `$${format(".3~r")(b)}B`);
export const fmtCount = (n: number) => format(".3~s")(n).replace("k", "K");
export const fmtPct = (n: number) => `${format(".3~r")(n)}%`;

/** A value with its plausible range, e.g. "18% (10–25%)". */
export function fmtWithRange(m: { value: number; low?: number; high?: number }, f: (n: number) => string) {
  return m.low !== undefined && m.high !== undefined && m.high > m.low ? `${f(m.value)} (range ${f(m.low)}–${f(m.high)})` : f(m.value);
}

/** The most recent of a list of ISO dates, formatted. */
export function latest(dates: (string | undefined | null)[]) {
  const d = dates.filter(Boolean).sort().at(-1);
  return d ? fmtDate(d, { year: true }) : "unknown";
}

/** Data notes are written with ISO dates; show them as "Aug 25, 2026" (year dropped when it's the current one). */
export function prose(text: string | null | undefined, currentYear?: number) {
  if (!text) return "";
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (iso, y) => fmtDate(iso, { year: Number(y) !== currentYear }));
}
