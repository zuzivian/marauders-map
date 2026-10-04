"use client";

import { useState } from "react";
import prep from "@/data/prep.json";

type Cell = { score: number; items: string[]; url: string };
const matrix = prep.matrix as Record<string, Record<string, Record<string, Cell>>>;
const ROLE_LABEL: Record<string, string> = {
  "Product Manager (incl. TPM)": "Product manager",
  "Product Marketing Manager": "Product marketing",
  "Strategy & BizOps": "Strategy and BizOps",
  "Partnerships/BD": "Partnerships and BD",
};
const SOURCE_LABEL: Record<string, string> = { "Exponent (Aced)": "Exponent (now Aced)", RocketBlocks: "RocketBlocks", Books: "Books", "Free/other": "Free" };

export default function PrepMatrix() {
  const [role, setRole] = useState(prep.roles[0]);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <div className="controls">
        {prep.roles.map((r) => (
          <button key={r} className="chip" aria-pressed={r === role} onClick={() => { setRole(r); setOpen(null); }}>{ROLE_LABEL[r]}</button>
        ))}
        <span className="label" style={{ marginLeft: "auto" }}>click a cell to see the exact modules</span>
      </div>
      <div className="matrix" role="table" aria-label={`Prep resources for ${ROLE_LABEL[role]}`}>
        <div className="h">skill</div>
        {prep.sources.map((s) => <div key={s} className="h">{SOURCE_LABEL[s].toLowerCase()}</div>)}
        {prep.skills.map((sk) => (
          <div key={sk} style={{ display: "contents" }}>
            <div className="sk">{sk.replace("/design", "").replace("&", "and")}</div>
            {prep.sources.map((src) => {
              const c = matrix[role][sk][src];
              const id = `${sk}|${src}`;
              const isOpen = open === id;
              return (
                <div key={src} className={`cell${isOpen ? " open" : ""}`} onClick={() => setOpen(isOpen ? null : id)}
                  role="button" tabIndex={0} aria-expanded={isOpen} aria-label={`${src}, ${sk}: ${c.score} of 3`}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen(isOpen ? null : id)}>
                  <span className="dots">{[0, 1, 2].map((i) => <i key={i} className={i < c.score ? "on" : ""} />)}</span>
                  {isOpen && (
                    <div className="items">
                      {c.items.length ? c.items.map((it) => <div key={it}>{it}</div>) : <div>Nothing strong here.</div>}
                      {c.url && <a href={c.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Open ↗</a>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="caveat">
        Module names checked against both catalogs on Oct 3, 2026. Exponent rebranded as Aced in Aug 2026. Ratings are our judgment of coverage, not sponsored.
        RocketBlocks lists Stanford GSB as a partner school; ask the CMC about access before paying.
      </div>
    </div>
  );
}
