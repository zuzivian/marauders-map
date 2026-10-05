import type { Mark } from "@/lib/marks";

// Drawn marks instead of Unicode glyphs, so every state is the same size whatever font the reader has.
// Shapes paint with currentColor; set `color: var(--mk)` (the .m-* classes) on a parent.

/** The mark's shape centred at (cx, cy) with radius r, for use inside any SVG. */
export function markShape(mark: Mark, cx: number, cy: number, r: number) {
  const ring = <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={r * 0.32} />;
  switch (mark) {
    case "open":
      return <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
    case "closing":
      return <>{ring}<circle cx={cx} cy={cy} r={r * 0.48} fill="currentColor" /></>;
    case "due":
      return <>{ring}<path d={`M${cx},${cy - r} A${r},${r} 0 0 0 ${cx},${cy + r} Z`} fill="currentColor" /></>;
    case "late":
      return <>{ring}<path d={`M${cx},${cy - r * 0.62} V${cy} H${cx + r * 0.55}`} fill="none" stroke="currentColor" strokeWidth={r * 0.28} strokeLinecap="round" /></>;
    case "later":
      return ring;
    case "closed": {
      const d = r * 0.78;
      return <path d={`M${cx - d},${cy - d} L${cx + d},${cy + d} M${cx + d},${cy - d} L${cx - d},${cy + d}`} stroke="currentColor" strokeWidth={r * 0.36} strokeLinecap="round" />;
    }
  }
}

/** A mark as an inline icon for HTML text. */
export function MarkIcon({ mark, size = 11 }: { mark: Mark; size?: number }) {
  return (
    <svg className={`mi m-${mark}`} width={size} height={size} viewBox="0 0 12 12" aria-hidden>
      {markShape(mark, 6, 6, 4.4)}
    </svg>
  );
}
