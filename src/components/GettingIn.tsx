"use client";

import { calendar, firsthand, hiring, meta } from "@/data";
import type { Company } from "@/data/types";
import { planOf } from "@/lib/plan";
import { PATH_LABEL, aggregate, byline } from "@/lib/firsthand";
import { useGuide } from "./Guide";
import { Cite } from "./Sources";
import { openContribute } from "./Contribute";

const cycle = meta.currentCycle;

/** How to get in: a plan computed from past windows and the GSB calendar, then what second-years say, kept apart. */
export default function GettingIn({ company: c }: { company: Company }) {
  const { today } = useGuide();
  const plan = planOf(hiring[c.id], calendar, today, cycle);
  const notes = aggregate(firsthand[c.id] ?? []);
  const invite = meta.firsthand && (
    <button className="linkish" onClick={() => openContribute(c.id)}>{notes ? "Add yours" : "Add a note"}</button>
  );

  return (
    <>
      <h4>Getting in</h4>
      {plan && (
        <div className="gi-plan">
          <p className="gi-act">{plan.action}{plan.rule && <> <span className="gi-rot">rule of thumb: {plan.rule}</span></>}</p>
          {plan.history && <p className="small muted">{plan.history}</p>}
          {plan.gsb && <p className="small">{plan.gsb.text} <Cite ids={plan.gsb.sources} /></p>}
        </div>
      )}

      <div className="gi-firsthand">
        {notes && notes.summers.length === 0 ? (
          // Nothing shows until two people from the same summer have written in, so a lone note can't be traced.
          <p className="small">
            {notes.n === 1 ? "One note in so far" : `${notes.n} notes in so far`}; they show once two people from the same summer have written in.
            {invite && <> Interned here? {invite}</>}
          </p>
        ) : notes ? (
          <>
            <div className="label">First-hand, from {notes.n} second-year{notes.n === 1 ? "" : "s"}. Not verified by the company.</div>
            <p className="small">
              {notes.n === 1 ? "One second-year" : notes.paths.length === 1 ? `All ${notes.n} second-years` : `${notes.n} second-years`} got in by{" "}
              {notes.paths.map(([p, k]) => (notes.paths.length === 1 ? PATH_LABEL[p] : `${PATH_LABEL[p]} (${k})`)).join(", ")}.
              {notes.stages.length > 0 && ` ${notes.n === 1 ? "Stages" : "Common stages"}: ${notes.stages.join(" → ")}.`}
              {notes.weeks !== null && ` About ${notes.weeks} weeks from first contact to offer (median).`}
            </p>
            {notes.summers.map(({ summer, reports }) => (
              <details key={summer} className="why">
                <summary>Their advice, summer {summer} ({reports.length} notes)</summary>
                <ul className="gi-advice">
                  {reports.map((r, i) => <li key={i}><q>{r.advice}</q> <span className="muted">— {byline(r)}</span></li>)}
                </ul>
                <div className="label">What mattered, in their words</div>
                <ul className="gi-advice">{reports.map((r, i) => <li key={i}>{r.whatMattered} <span className="muted">— {byline(r)}</span></li>)}</ul>
              </details>
            ))}
            {invite && <p className="small">{invite}</p>}
          </>
        ) : (
          <p className="small">
            No first-hand notes yet.
            {invite && <> Interned here? {invite}: 3 minutes, anonymous by default.</>}
          </p>
        )}
      </div>
    </>
  );
}
