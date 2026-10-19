import { visa, type Company } from "@/data";
import type { LcaFamily } from "@/data/types";
import { Cite } from "./Sources";

const FAMILY = { pm: "Product managers", program: "Program managers, incl. TPM", pmm: "Product marketing" } as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const month = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const k = (n: number) => `$${Math.round(n / 1000)}K`;
const count = (n: number) => n.toLocaleString("en-US");

function Family({ label, f }: { label: string; f: LcaFamily }) {
  return (
    <li>
      {label}: <strong>{count(f.n)}</strong>
      {f.wage && <span className="muted"> · median {k(f.wage.median)} a year (middle half {k(f.wage.low)}–{k(f.wage.high)})</span>}
    </li>
  );
}

/** Whether the company files H-1Bs for the full-time jobs an MBA intern converts into, from the Labor Department's data. */
export default function H1bRecord({ company: c }: { company: Company }) {
  const v = visa.companies[c.id];
  if (visa.fy === null || !v?.roles || v.all === undefined) return null;
  const fams = (Object.keys(FAMILY) as (keyof typeof FAMILY)[]).map((key) => ({ key, f: v.roles![key] }));
  const any = fams.some(({ f }) => f.n > 0);
  const period = `${month(visa.from!)} to ${month(visa.through!)}`;
  return (
    <>
      <h4>H-1B filings for product roles</h4>
      {v.all === 0 ? (
        <p className="small">No certified H-1B filings under {c.name}&apos;s employer names, {period}. <Cite ids={v.sources ?? []} /></p>
      ) : (
        <>
          <p className="small">
            {any ? `Certified H-1B filings by job title, ${period}:` : `None for these titles, ${period}, out of ${count(v.all)} across every role.`} <Cite ids={v.sources ?? []} />
          </p>
          {any && (
            <ul className="pulse">
              {fams.map(({ key, f }) => <Family key={key} label={FAMILY[key]} f={f} />)}
              <li className="muted">{count(v.all)} across every role at {c.name}.</li>
            </ul>
          )}
        </>
      )}
      <details className="why">
        <summary>What these numbers are</summary>
        <p>
          Each is a Labor Condition Application the Labor Department certified, the first step of an H-1B petition. It shows the
          company files for these titles. It isn&apos;t a count of visas granted, and one filing can cover more than one worker.
          These are full-time jobs, so the record bears on a return offer, not on the internship itself.
        </p>
        <p className="muted">
          Counted from fiscal year {visa.fy} through quarter {visa.quarter}, matching employer names
          {v.employers?.length ? ` (${v.employers.join("; ")})` : ""} and job titles containing “product manag”, “program manag”
          or “product marketing”. Wages are the offered minimum, as a yearly figure; no spread is shown under five filings.
        </p>
      </details>
    </>
  );
}
