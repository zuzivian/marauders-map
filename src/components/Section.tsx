"use client";

import type { ReactNode } from "react";
import { useInitialCompany } from "./Guide";

interface Props {
  id: string;
  title: string;
  /** One line computed from the data: what's inside, before you open it. */
  line: string;
  /** How to read the section, shown once it's open. */
  dek?: string;
  /** Start open: the timing section always; the companies section on a company's own page. */
  open?: boolean | "on-company-page";
  children: ReactNode;
}

/**
 * A section of the guide. Folded sections are a native <details>: the whole heading is the control, it works with
 * the keyboard and screen readers as is, and the content stays in the page, so find-in-page and links still reach it
 * (see lib/reveal). The "open"/"close" cue is drawn by CSS from the details' own state.
 */
export default function Section({ id, title, line, dek, open = false, children }: Props) {
  const company = useInitialCompany();
  const head = (
    <>
      <h2 id={`${id}-h`}>{title}</h2>
      <p className="section-line">{line}</p>
    </>
  );
  if (open === true)
    return (
      <section id={id} className="section" aria-labelledby={`${id}-h`}>
        <div className="section-head">
          <h2 id={`${id}-h`}>{title}</h2>
          <p className="section-line">{line}{dek && ` ${dek}`}</p>
        </div>
        {children}
      </section>
    );
  return (
    <section id={id} className="section" aria-labelledby={`${id}-h`}>
      <details className="fold" open={open === "on-company-page" && company !== null ? true : undefined}>
        <summary className="section-head">
          {head}
          <span className="fold-cue" aria-hidden />
        </summary>
        <div className="fold-body">
          {dek && <p className="section-dek">{dek}</p>}
          {children}
        </div>
      </details>
    </section>
  );
}
