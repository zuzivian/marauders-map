import type { Company, Cycle, Hiring, ISODate } from "@/data/types";
import { fmtDate, monthOf, typicalOpen } from "./season";
import { statusOf } from "./status";

// Shareable links and the text that travels with them (page descriptions, link-preview images, the digest).

export const SITE = "https://marauders-map.natwong.dev";
/** A company's own page. Keep this shape: other places link to it, and here.now serves /c/<id>/index.html. */
export const companyPath = (id: string) => `/c/${id}/`;
export const companyUrl = (id: string) => `${SITE}${companyPath(id)}`;

export interface Snapshot {
  status: string; // e.g. "Not posted as of Oct 4, 2026"; true for good, since it's pinned to a date
  usual: string | null; // e.g. "usually opens mid Oct", from past cycles
  checked: ISODate;
}

/**
 * Where a company stood when its postings were last checked. Link previews and page descriptions are fixed at
 * build time, so unlike the page they can't say "due any day" or "in 3 days"; everything here is dated.
 */
export function snapshot(h: Hiring, cycle: Cycle): Snapshot {
  const checked = h.current.checked;
  const s = statusOf(h, checked, cycle);
  const t = h.hasProgram ? typicalOpen(h, cycle) : null;
  const usual = t ? `usually opens ${monthOf(t.week, cycle)}` : null;
  const now = h.windows.find((w) => w.cycle === cycle);
  const closes = [now?.closes, ...h.current.postings.map((p) => p.closes)].filter(Boolean).sort().at(-1);
  const y = (iso: ISODate) => fmtDate(iso, { year: true });
  const status =
    s.state === "none" ? `No MBA internship as of ${y(checked)}`
    : s.state === "closed" ? `Closed ${y(closes!)}`
    : now && closes ? `Opened ${fmtDate(now.from)}, deadline ${y(closes)}`
    : now ? `Opened ${y(now.from)}, rolling deadline`
    : `Not posted as of ${y(checked)}`;
  return { status, usual, checked };
}

/** The page description for a company's link, e.g. "Google MBA internships: usually opens mid Oct; not posted as of Oct 4, 2026. …" */
export function describe(c: Company, h: Hiring, cycle: Cycle) {
  const { status, usual, checked } = snapshot(h, cycle);
  if (!h.hasProgram) return `${c.name} had no MBA internship as of ${fmtDate(checked, { year: true })}. Company facts, sources and field notes.`;
  const lead = [usual, status[0].toLowerCase() + status.slice(1)].filter(Boolean).join("; ");
  return `${c.name} MBA internships: ${lead}. Past cycles, sources and field notes.`;
}
