"use client";

import { Fragment, useMemo, useState } from "react";
import { companies, companyByName, hiring, meta, roles, type Company, type Role } from "@/data";
import { createSearch, titleHits } from "@/lib/search";
import { MARK, roleMark, trailItems, type TrailItem } from "@/lib/marks";
import { useGuide } from "./Guide";
import { MarkIcon, MarkKey } from "./MarkIcon";
import { MyListBar, MyListEmpty, useMyListFilter } from "./MyList";

const cycle = meta.currentCycle;
const search = createSearch(roles, companies.map((c) => c.name));
const EXAMPLES = ["PM-T", "Strategy & Operations", "Corp Dev", "FLDP"];
type Pick = { role: string; company?: string } | null;

export default function RoleDecoder() {
  const { select, today } = useGuide();
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<Pick>(null);
  const result = useMemo(() => search(q), [q]);
  const items = useMemo(() => trailItems(companies, hiring, today, cycle), [today]);
  const itemOf = (c: Company) => items.find((i) => i.company.id === c.id);
  const { only, keep } = useMyListFilter();
  const cols = items.map((i) => i.company).filter((c) => keep(c.id)); // same order as the trail: by when they open
  const hide = only && !cols.length ? " mylist-hidden" : "";
  const hits = new Set(result && result.confidence !== "none" ? result.matches.map((m) => m.role.id) : []);
  const active: Pick = pick ?? (result && result.confidence !== "none" ? { role: result.matches[0].role.id } : null);
  const toggle = (p: NonNullable<Pick>) => setPick((cur) => (cur && cur.role === p.role && cur.company === p.company ? null : p));

  const cell = (r: Role, c: Company) => {
    const mk = roleMark(r, c, itemOf(c), cycle);
    const on = active?.role === r.id && active.company === c.name;
    const key = `${r.id}-${c.id}`;
    if (!mk) return <td key={key} className="nope" aria-label={`${c.name} doesn't post ${r.name} internships`} />;
    return (
      <td key={key} className={on ? "on" : undefined}>
        <button className={`dotcell m-${mk}`} onClick={() => toggle({ role: r.id, company: c.name })} aria-pressed={on}
          aria-label={`${r.name} at ${c.name}: ${MARK[mk].label}`}><MarkIcon mark={mk} size={14} /></button>
      </td>
    );
  };
  const rowHead = (r: Role) => (
    <th scope="row" className={hits.has(r.id) ? "hit" : undefined}>
      <button className="rolehead" onClick={() => toggle({ role: r.id })} aria-pressed={active?.role === r.id && !active.company}>
        <span className="rn">{r.name}</span><span className="re">{r.epithet}</span>
      </button>
    </th>
  );

  return (
    <div>
      <label className="sr-only" htmlFor="title-search">Paste a job title</label>
      <input id="title-search" className="search" value={q} type="search" autoComplete="off" placeholder="Paste a title from a posting…"
        onChange={(e) => { setQ(e.target.value); setPick(null); }} aria-describedby="title-search-out" />
      <div id="title-search-out" className="search-out" aria-live="polite">
        {!result ? (
          <span className="muted">Try {EXAMPLES.map((e, i) => <span key={e}>{i > 0 && (i === EXAMPLES.length - 1 ? " or " : ", ")}<button className="linkish" onClick={() => setQ(e)}>{e}</button></span>)}.</span>
        ) : result.confidence === "none" ? (
          <>No match yet. Try one distinctive word, like “partnerships” or “finance”.</>
        ) : !result.matches[0].phrases.length && result.companies.length ? (
          <>{result.companies.join(", ")} posts: <span className="note">{result.matches.map((m) => m.role.name).join(" · ")}</span></>
        ) : (
          <>{result.confidence === "ambiguous" ? "Could be " : result.confidence === "likely" ? "Probably " : "Really means "}
            <span className="note">{result.matches[0].role.name}</span>
            {result.confidence === "ambiguous" && result.matches[1] && <> or <span className="note">{result.matches[1].role.name}</span></>}</>
        )}
      </div>

      {/* Both orientations render; CSS picks one by screen width so phones never see a squeezed wide table. */}
      <MyListBar />
      {hide && <MyListEmpty />}
      <div className={`who-wrap who-wide-wrap${hide}`}>
        <table className={`who${hits.size ? " searching" : ""}`}>
          <caption className="sr-only">Which companies hire MBA interns for which roles, and where each stands this cycle</caption>
          <thead><tr><th />{cols.map((c) => <th key={c.id} scope="col" className="co"><span>{c.name}</span></th>)}</tr></thead>
          <tbody>{roles.map((r) => (
            <tr key={r.id} className={hits.size && !hits.has(r.id) ? "dim" : undefined}>{rowHead(r)}{cols.map((c) => cell(r, c))}</tr>
          ))}</tbody>
        </table>
      </div>
      <div className={`who-wrap who-narrow-wrap${hide}`}>
        <table className="who narrow">
          <caption className="sr-only">Which roles each company hires MBA interns for, and where each stands this cycle</caption>
          <thead><tr><th />{roles.map((r) => (
            <th key={r.id} scope="col" className={hits.has(r.id) ? "hit" : undefined}>
              <button className="colhead" onClick={() => toggle({ role: r.id })} aria-label={r.name}>{r.short}</button>
            </th>
          ))}</tr></thead>
          <tbody>{cols.map((c) => (
            <tr key={c.id}><th scope="row" className="co">{c.name}</th>{roles.map((r) => cell(r, c))}</tr>
          ))}</tbody>
        </table>
      </div>
      <MarkKey tail="A blank means the company doesn't post that role. Tap a mark for the exact titles, or a role for what it means." />

      {active && <Detail role={roles.find((r) => r.id === active.role)!} company={active.company} result={result}
        onClose={() => setPick(null)} onCompany={(name) => select(companyByName[name.toLowerCase()].id, { reveal: true })} itemOf={itemOf} />}
    </div>
  );
}

function Detail({ role: r, company, result, onClose, onCompany, itemOf }: {
  role: Role; company?: string; result: ReturnType<typeof search>; onClose: () => void; onCompany: (name: string) => void;
  itemOf: (c: Company) => TrailItem | undefined;
}) {
  const posters = [...new Set(r.titles.map((t) => t.company))];
  if (company) {
    const c = companyByName[company.toLowerCase()];
    const mk = roleMark(r, c, itemOf(c), cycle);
    // This cycle's titles first, then older ones.
    const ts = r.titles.filter((t) => t.company === company).sort((a, b) => Number(b.cycles.includes(cycle)) - Number(a.cycles.includes(cycle)));
    const when = (cs: string[]) => (cs.includes(cycle) ? "this cycle" : `for summer ${Math.max(...cs.map(Number)) + 1}`);
    return (
      <div className="role-detail" role="region" aria-label={`${r.name} at ${company}`}>
        <button className="close linkish" onClick={onClose} aria-label="Close">×</button>
        {mk && <div className={`detail-status m-${mk}`}><MarkIcon mark={mk} /> {MARK[mk].label}</div>}
        <h3>{r.name} <span className="muted">at</span> {company}</h3>
        <ul className="titles">{ts.map((t) => (
          <li key={t.title}>{t.title} <span className="muted">· {when(t.cycles)}</span></li>
        ))}</ul>
        <button className="chip" onClick={() => onCompany(company)}>Open {company} field notes</button>
      </div>
    );
  }
  return (
    <div className="role-detail" role="region" aria-label={r.name}>
      <button className="close linkish" onClick={onClose} aria-label="Close">×</button>
      <h3>{r.name} <span className="ep">n. · {r.epithet}</span></h3>
      <p>{r.definition}</p>
      <p className="small">
        How technical: {r.technical} <span className="muted">(our read)</span>. Where it leads: {r.leadsTo}
      </p>
      <div className="aka">
        <span className="label">Posted as</span>
        <ul>{posters.map((p) => {
          const ts = r.titles.filter((t) => t.company === p);
          const hit = result ? ts.filter((t) => titleHits(result, r.id, t)) : [];
          const show = [...new Set([...hit, ...ts.slice(0, 2)])];
          return (
            <li key={p}><button className="linkish aka-co" onClick={() => onCompany(p)}>{p}</button>{" "}
              {show.map((t, i) => <Fragment key={t.title}>{i > 0 && " · "}{hit.includes(t) ? <mark>{t.title}</mark> : t.title}</Fragment>)}
              {ts.length > show.length && <span className="muted"> +{ts.length - show.length} more</span>}
            </li>
          );
        })}</ul>
      </div>
    </div>
  );
}
