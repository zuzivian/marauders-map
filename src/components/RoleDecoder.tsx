"use client";

import { useMemo, useState } from "react";
import { companies, companyByName, roles } from "@/data";
import { createSearch, titleHits } from "@/lib/search";
import { useGuide } from "./Guide";

const search = createSearch(roles, companies.map((c) => c.name));
const TECH = { low: 1, some: 2, high: 3 } as const;
const EXAMPLES = ["Product Manager Technical (PMT) Intern", "Strategy & Operations", "PM-T", "Corp Dev"];

export default function RoleDecoder() {
  const { select } = useGuide();
  const [q, setQ] = useState("");
  const result = useMemo(() => search(q), [q]);
  const hit = new Set(result?.matches.map((m) => m.role.id));
  const [top, second] = result?.matches ?? [];

  return (
    <div>
      <label className="sr-only" htmlFor="title-search">Paste a job title</label>
      <input id="title-search" className="search" value={q} onChange={(e) => setQ(e.target.value)} type="search" autoComplete="off"
        placeholder="Paste a title from a posting…" aria-describedby="title-search-out" />
      <div id="title-search-out" className="search-out" aria-live="polite">
        {!result ? (
          <span className="label">try {EXAMPLES.map((e, i) => (
            <span key={e}>{i > 0 && " · "}<button className="linkish" onClick={() => setQ(e)}>{e}</button></span>
          ))}</span>
        ) : result.confidence === "none" ? (
          <>No match in our list yet. Try one distinctive word, like “partnerships”, “finance”, or “marketing”.</>
        ) : !result.matches[0].phrases.length && result.companies.length ? (
          <>{result.companies.join(", ")} posts MBA internships as: <span className="note">{result.matches.map((m) => m.role.name).join(" · ")}</span></>
        ) : (
          <>
            {result.confidence === "ambiguous" ? "Could be either " : result.confidence === "likely" ? "Probably " : "Really means: "}
            <a className="note" href={`#role-${top.role.id}`}>{top.role.name}</a>
            {result.confidence === "ambiguous" && second && <> or <a className="note" href={`#role-${second.role.id}`}>{second.role.name}</a></>}
            {top.phrases.length > 0 && <span className="muted"> · matched “{top.phrases.join("”, “")}”</span>}
            {top.closest && top.closest.similarity >= 0.4 && (
              <div className="muted small">Closest title we&apos;ve seen: “{top.closest.title}” at {top.closest.company}</div>
            )}
          </>
        )}
      </div>

      <div className="dict">
        {roles.map((r) => {
          const posters = [...new Set(r.titles.map((t) => t.company))];
          return (
            <article key={r.id} id={`role-${r.id}`} className={`entry${result && result.confidence !== "none" && !hit.has(r.id) ? " dim" : ""}`}>
              <h3 className="hw">{r.name}</h3>
              <div className="ep">n. · {r.epithet}</div>
              <p>{r.definition}</p>
              <p className="small">
                <span className="label">how technical</span>{" "}
                <span className="dots" role="img" aria-label={`${r.technical} (our read)`}>
                  {[1, 2, 3].map((i) => <i key={i} className={i <= TECH[r.technical] ? "on" : ""} />)}
                </span>
                <span className="label" style={{ marginLeft: 12 }}>leads to</span> {r.leadsTo}
              </p>
              <div className="aka">
                <span className="label">also posted as</span><br />
                {r.titles.map((t, i) => (
                  <span key={`${t.company}${t.title}`}>{i > 0 && " · "}
                    {result && titleHits(result, r.id, t) ? <mark>{t.title}</mark> : t.title} <span className="muted">{t.company}</span>
                  </span>
                ))}
              </div>
              <div className="posters">
                <span className="label">who hires for it</span>
                {posters.map((p) => companyByName[p.toLowerCase()] && (
                  <button key={p} className="chip" onClick={() => select(companyByName[p.toLowerCase()].id, { reveal: true })}>{p}</button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <div className="caveat">
        Titles are as posted on company career sites in the last two cycles; each links to a source in the company&apos;s field notes. Titles change every cycle.
        &ldquo;How technical&rdquo; is our read of the role, not a company rating.
      </div>
    </div>
  );
}
