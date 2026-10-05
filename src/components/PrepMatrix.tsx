"use client";

import { Fragment, useState } from "react";
import { prep, roles } from "@/data";
import { fmtDate } from "@/lib/season";
import { Cite } from "./Sources";

const roleName = (key: string) => roles.find((r) => r.prepKey === key)?.name ?? key;
const SCORE = ["no real coverage", "light coverage", "solid coverage", "deep coverage"];

export default function PrepMatrix() {
  const [role, setRole] = useState(prep.roles[0]);
  const [open, setOpen] = useState<{ skill: string; source: string } | null>(null);
  const cols = prep.columns.length;

  return (
    <div>
      <div className="controls" role="group" aria-label="Choose a role">
        {prep.roles.map((r) => (
          <button key={r} className="chip" aria-pressed={r === role} onClick={() => { setRole(r); setOpen(null); }}>{roleName(r)}</button>
        ))}
      </div>
      <p className="chart-key">
        Dots show how deeply each kind of prep covers a skill, from none to three (our judgment). Tap a cell for the exact modules.
      </p>
      {prep.notes.filter((n) => n.highlight).map((n) => (
        <p key={n.text} className="callout">{n.text} <Cite ids={n.sources} /></p>
      ))}
      <table className="matrix">
        <caption className="sr-only">Prep resources for {roleName(role)}: coverage of each interview skill, 0 to 3</caption>
        <thead>
          <tr><th scope="col">skill</th>{prep.columns.map((s) => <th key={s} scope="col">{s}</th>)}</tr>
        </thead>
        <tbody>
          {prep.skills.map((sk) => {
            const detail = open?.skill === sk ? prep.matrix[role][sk][open.source] : null;
            return (
              <Fragment key={sk}>
                <tr>
                  <th scope="row">{sk}</th>
                  {prep.columns.map((src) => {
                    const c = prep.matrix[role][sk][src];
                    const isOpen = open?.skill === sk && open.source === src;
                    return (
                      <td key={src} className={isOpen ? "open" : undefined}>
                        <button className="cell" aria-expanded={isOpen} aria-controls={`prep-${sk}`}
                          onClick={() => setOpen(isOpen ? null : { skill: sk, source: src })}>
                          <span className="dots" aria-hidden>{[0, 1, 2].map((i) => <i key={i} className={i < c.score ? "on" : ""} />)}</span>
                          <span className="sr-only">{src}, {sk}: {SCORE[c.score]}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
                {detail && open && (
                  <tr className="detail" id={`prep-${sk}`}>
                    <td colSpan={cols + 1}>
                      <div className="label">{open.source} · {sk.toLowerCase()} · {SCORE[detail.score]}</div>
                      {detail.items.length ? <ul>{detail.items.map((it) => <li key={it}>{it}</li>)}</ul> : <p>Nothing strong here.</p>}
                      {detail.note && <p className="muted">{detail.note}</p>}
                      {detail.url && <a href={detail.url} target="_blank" rel="noreferrer">Open {open.source} ↗</a>}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="caveat">
        Module names and links checked {fmtDate(prep.checked, { year: true })}. Ratings are our judgment of coverage; nothing here is sponsored.{" "}
        {prep.notes.filter((n) => !n.highlight).map((n) => <span key={n.text}>{n.text} <Cite ids={n.sources} /> </span>)}
      </div>
    </div>
  );
}
