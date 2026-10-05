import type { Mark } from "@/lib/marks";

// Drawn marks instead of Unicode glyphs, so every state is the same size whatever font the reader has.
// Shapes paint with currentColor; set `color: var(--mk)` (the .m-* classes) on a parent.

/**
 * The mark's shape centred at (cx, cy) with radius r, for use inside any SVG. Three shapes only: a filled dot is
 * posted, a ring is not posted yet, a cross is closed. The finer states (closing soon, due any day, running late) are
 * said in words beside the mark wherever there's room, and shown by colour (the .m-* classes) where there isn't.
 */
export function markShape(mark: Mark, cx: number, cy: number, r: number) {
  switch (mark) {
    case "open":
    case "closing":
      return <circle cx={cx} cy={cy} r={r} fill="currentColor" />;
    case "due":
    case "late":
    case "later":
      return <circle cx={cx} cy={cy} r={r * 0.86} fill="none" stroke="currentColor" strokeWidth={r * 0.32} />;
    case "closed": {
      const d = r * 0.72;
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

/** The three shapes in words, under views with no room to spell out each state. */
export function MarkKey({ tail }: { tail?: string }) {
  return (
    <p className="mark-key">
      <span className="m-open"><MarkIcon mark="open" /> open now</span>
      <span className="m-later"><MarkIcon mark="later" /> not posted yet</span>
      <span className="m-closed"><MarkIcon mark="closed" /> closed</span>
      <span>In red: closing soon, or due any day.{tail && ` ${tail}`}</span>
    </p>
  );
}
