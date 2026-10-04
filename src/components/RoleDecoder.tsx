"use client";

import { useMemo, useState } from "react";
import { roles } from "@/data/roles";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

export default function RoleDecoder() {
  const [q, setQ] = useState("");
  const n = norm(q);

  const hits = useMemo(() => {
    if (!n) return null;
    return roles.map((r) => ({
      id: r.id,
      titles: r.titles.filter((t) => norm(t.title).includes(n) || norm(t.company).includes(n)),
      self: norm(r.name).includes(n),
    })).filter((h) => h.titles.length || h.self);
  }, [n]);

  const match = (id: string) => hits?.find((h) => h.id === id);
  const summary = !hits ? "" : !hits.length ? "No match yet. Try a fragment like “partner”, “ops”, or “technical”."
    : hits.map((h) => roles.find((r) => r.id === h.id)!.name).join(" · ");

  return (
    <div>
      <input className="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Paste a title from a posting — “PM-T”, “Strategy & Operations”…" aria-label="Search job titles" />
      <div className="search-out">{hits ? <>Really means: <span className="note">{summary}</span></> : <span className="label">or just read the page — every role is below</span>}</div>
      <div className="dict">
        {roles.map((r) => {
          const m = match(r.id);
          return (
            <article key={r.id} className={`entry${hits && !m ? " dim" : ""}`}>
              <div className="hw">{r.name}</div>
              <div className="ep">n. · {r.epithet}</div>
              <p>{r.definition}</p>
              <p style={{ fontSize: 13 }}>
                <span className="label">technical</span><span className="meter"><span style={{ width: `${r.technical}%` }} /></span>
                <span className="label" style={{ marginLeft: 8 }}>leads to</span> {r.leadsTo}
              </p>
              <div className="aka">
                <span className="label">also posted as</span><br />
                {r.titles.map((t, i) => {
                  const on = m?.titles.includes(t);
                  return (
                    <span key={i}>{i > 0 && " · "}{on ? <mark>{t.title}</mark> : t.title} <span style={{ color: "var(--ink-3)" }}>{t.company}</span></span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
      <div className="caveat">Titles change every cycle. If you see one that isn&apos;t here, tell us and we&apos;ll add it.</div>
    </div>
  );
}
