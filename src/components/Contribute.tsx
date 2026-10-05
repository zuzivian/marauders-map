"use client";

import { useEffect, useRef, useState } from "react";
import { companies, companyById, meta, roles } from "@/data";
import { LIMITS, PATHS, PATH_LABEL, TEAM_MATCH } from "@/lib/firsthand";

// The first-hand notes form. Same mechanics as Corrections: Formspree, sent with fetch so the contributor gets a real
// success or error (a plain POST without JS). The fields mirror firsthand.json, so scripts/add-firsthand.mjs can turn
// a submission into a report as-is. Nothing is published until the maintainer runs that script.
// It opens from a company's field notes, or from a shareable link: ?contribute=<companyId> or #contribute.

export const CONTRIBUTE_EVENT = "maraudersmap:contribute";

/** Open the first-hand notes form, optionally about a specific company (by id). */
export function openContribute(companyId?: string) {
  window.dispatchEvent(new CustomEvent(CONTRIBUTE_EVENT, { detail: companyId }));
}

const cycle = Number(meta.currentCycle);
const CLASSES = [cycle + 1, cycle, cycle - 1]; // this year's MBA2s first
/** The role a company's MBA titles point at most, as a starting guess. */
const firstRole = (id: string) => {
  const name = companyById[id]?.name;
  return [...roles].sort((a, b) => b.titles.filter((t) => t.company === name).length - a.titles.filter((t) => t.company === name).length)[0].id;
};

function Counted({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  const [n, setN] = useState(0);
  return (
    <label>
      <span className="label">{label} <span className="gi-count">{n}/{LIMITS.text}</span></span>
      <textarea className="field" name={name} required rows={3} maxLength={LIMITS.text} placeholder={placeholder} onChange={(e) => setN(e.target.value.length)} />
    </label>
  );
}

export default function Contribute() {
  const cfg = meta.firsthand;
  const ref = useRef<HTMLDetailsElement>(null);
  const [round, setRound] = useState(0); // bumped after a send, to clear the form
  const [company, setCompany] = useState(companies[0].id);
  const [role, setRole] = useState(() => firstRole(companies[0].id));
  const [classOf, setClassOf] = useState(CLASSES[0]);
  const [summer, setSummer] = useState(CLASSES[0] - 1);
  const [thanks, setThanks] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  useEffect(() => {
    const show = (id?: string | null) => {
      if (id && companyById[id]) { setCompany(id); setRole(firstRole(id)); }
      if (ref.current) ref.current.open = true;
      document.getElementById("contribute")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    // A shared link (?contribute=google, or #contribute) opens the form straight away.
    const url = new URL(window.location.href);
    if (url.searchParams.has("contribute") || url.hash === "#contribute") show(url.searchParams.get("contribute"));
    const onOpen = (e: Event) => show((e as CustomEvent<string | undefined>).detail);
    const onHash = () => { if (window.location.hash === "#contribute") show(); };
    window.addEventListener(CONTRIBUTE_EVENT, onOpen);
    window.addEventListener("hashchange", onHash);
    return () => { window.removeEventListener(CONTRIBUTE_EVENT, onOpen); window.removeEventListener("hashchange", onHash); };
  }, []);

  if (!cfg) return null;
  const f = cfg.fields;
  const name = companyById[company]?.name ?? company;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(cfg.action, { method: "POST", body: new FormData(e.currentTarget), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      setState("idle");
      setThanks(true);
      setRound((n) => n + 1);
      if (ref.current) ref.current.open = false;
    } catch {
      setState("error");
    }
  };
  return (
    <section id="contribute" className="corrections contribute" aria-labelledby="contribute-h">
      {thanks && <p className="callout" role="status">Thank you. Your note goes up after a quick read, anonymously unless you gave a name.</p>}
      <details ref={ref}>
        <summary id="contribute-h">interned in big tech? add a first-hand note on how you got in</summary>
        <p className="small gi-why">
          Answer once instead of in twenty coffee chats. It takes about 3 minutes and is anonymous by default (&ldquo;a GSB &rsquo;{String(classOf).slice(-2)}&rdquo;).
          Advice and specifics only appear once two people have written in about the same company and summer; until then the site shows a count and the common stages.
        </p>
        <form key={round} action={cfg.action} method="POST" onSubmit={submit}>
          <input type="hidden" name="kind" value="firsthand" />
          <input type="hidden" name="_subject" value={`Marauder's Map first-hand note: ${name}`} />
          <input type="text" name="_gotcha" className="honey" tabIndex={-1} autoComplete="off" aria-hidden />
          <div className="gi-row">
            <label>
              <span className="label">company</span>
              <select className="field" name={f.company} value={company} onChange={(e) => { setCompany(e.target.value); setRole(firstRole(e.target.value)); }}>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              <span className="label">role</span>
              <select className="field" name={f.roleId} value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </label>
          </div>
          <div className="gi-row">
            <label>
              <span className="label">your class</span>
              <select className="field" name={f.classOf} value={classOf} onChange={(e) => { setClassOf(Number(e.target.value)); setSummer(Number(e.target.value) - 1); }}>
                {CLASSES.map((y) => <option key={y} value={y}>GSB &rsquo;{String(y).slice(-2)}</option>)}
              </select>
            </label>
            <label>
              <span className="label">internship summer</span>
              <select className="field" name={f.internshipSummer} value={summer} onChange={(e) => setSummer(Number(e.target.value))}>
                {CLASSES.map((y) => y - 1).map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
          </div>
          <div className="gi-row">
            <label>
              <span className="label">how you got in</span>
              <select className="field" name={f.path} defaultValue="" required>
                <option value="" disabled>choose one</option>
                {PATHS.map((p) => <option key={p} value={p}>{p === "oci" ? "OCI (on-campus interviews)" : PATH_LABEL[p]}</option>)}
              </select>
            </label>
            <label>
              <span className="label">team</span>
              <select className="field" name={f.teamMatch} defaultValue="" required>
                <option value="" disabled>choose one</option>
                {TEAM_MATCH.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label>
            <span className="label">interview stages, one per line</span>
            <textarea className="field" name={f.stages} rows={3} placeholder={"Recruiter screen\nProduct sense\nFinal loop (4 interviews)"} />
          </label>
          <label>
            <span className="label">weeks from first contact to offer, roughly (optional)</span>
            <input className="field" type="number" name={f.firstContactToOffer} min={0} max={LIMITS.weeks} inputMode="numeric" />
          </label>
          <Counted name={f.whatMattered} label="what mattered most" placeholder="What actually moved things: a referral, a club, a story, timing…" />
          <Counted name={f.advice} label="your advice to an MBA1" placeholder="One thing you'd tell someone applying this year." />
          <label>
            <span className="label">name to show (optional; leave blank to stay anonymous)</span>
            <input className="field" type="text" name={f.displayName} maxLength={LIMITS.displayName} autoComplete="off" />
          </label>
          <label>
            <span className="label">your email, only if a follow-up question is OK (never published)</span>
            <input className="field" type="email" name={f.email} autoComplete="email" />
          </label>
          <label className="gi-consent">
            <input type="checkbox" name={f.consent} value="yes" required />
            <span className="small">OK to publish this on the map, without my email, and anonymously unless I gave a name. It may be trimmed to fit.</span>
          </label>
          <button className="send" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send note"}</button>
          {state === "error" && <p className="small" role="alert" style={{ color: "var(--cardinal)" }}>That didn&apos;t go through. Try again in a minute.</p>}
          <p className="small muted">Goes to the site&apos;s maintainer through Formspree. Nothing is published automatically, and notes aren&apos;t checked with the company.</p>
        </form>
      </details>
    </section>
  );
}
