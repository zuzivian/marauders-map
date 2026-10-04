import { sources } from "@/data";
import { fmtDate } from "@/lib/season";

const uniq = (ids: string[]) => [...new Set(ids)].filter((id) => sources[id]);

/** Compact inline citation: publisher names linking to each source. */
export function Cite({ ids }: { ids: string[] }) {
  const list = uniq(ids);
  if (!list.length) return null;
  return (
    <span className="cite">
      {list.map((id) => {
        const s = sources[id];
        return (
          <a key={id} href={s.url} target="_blank" rel="noreferrer" title={s.quote ? `“${s.quote}” — ${s.title}` : s.title}>
            {s.publisher}
          </a>
        );
      })}
    </span>
  );
}

/** Full citations with the supporting quote visible (works on touch screens, unlike tooltips). */
export function SourceList({ ids, label = "sources" }: { ids: string[]; label?: string }) {
  const list = uniq(ids);
  if (!list.length) return null;
  return (
    <div className="sources">
      <div className="label">{label}</div>
      <ol>
        {list.map((id) => {
          const s = sources[id];
          return (
            <li key={id}>
              <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a>
              <span className="src-meta"> · {s.publisher}{s.published ? `, ${fmtDate(s.published, { year: true })}` : ""}{s.kind === "forum" ? " · forum post" : s.kind === "archive" ? " · archived copy" : ""}{s.gone ? " · since removed" : ""}</span>
              {s.quote && <q>{s.quote}</q>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
