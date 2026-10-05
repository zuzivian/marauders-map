"use client";

import { useEffect, useRef, useState } from "react";
import { companies, meta } from "@/data";

// The corrections form posts to whichever backend meta.json names:
//  - "formspree": Formspree (https://formspree.io), sent with fetch so the reader gets a real success or error;
//    submissions are kept in the Formspree dashboard as well as emailed. Without JS it falls back to a plain POST.
//  - "google": a Google Form's formResponse endpoint, submitted into a hidden iframe so the reader stays here.
//    Google emails the form's owner on each response and keeps them in a sheet.
//  - "formsubmit": FormSubmit (https://formsubmit.co), which emails each submission after a one-time activation.
// Field names map our four fields onto the backend's (Google uses entry.<id>).

export const CORRECTIONS_EVENT = "maraudersmap:correction";

/** Open the corrections form, optionally about a specific company. */
export function openCorrection(about?: string) {
  window.dispatchEvent(new CustomEvent(CORRECTIONS_EVENT, { detail: about }));
}

export default function Corrections() {
  const cfg = meta.corrections;
  const ref = useRef<HTMLDetailsElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sent = useRef(false);
  const [about, setAbout] = useState("General");
  const [next, setNext] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");

  useEffect(() => {
    const url = new URL(window.location.href);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading the URL is only possible after mount
    setThanks(url.searchParams.get("thanks") === "1");
    url.search = "?thanks=1";
    url.hash = "corrections";
    setNext(url.toString());
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<string | undefined>).detail;
      if (detail) setAbout(detail);
      if (ref.current) ref.current.open = true;
      document.getElementById("corrections")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(CORRECTIONS_EVENT, onOpen);
    return () => window.removeEventListener(CORRECTIONS_EVENT, onOpen);
  }, []);

  if (!cfg) return null;
  const google = cfg.kind === "google";
  const formspree = cfg.kind === "formspree";
  const f = cfg.fields;

  // Formspree: send in the background and report what actually happened.
  const submitFetch = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(cfg.action, { method: "POST", body: new FormData(e.currentTarget), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      setState("idle");
      setThanks(true);
      formRef.current?.reset();
      if (ref.current) ref.current.open = false;
    } catch {
      setState("error");
    }
  };
  return (
    <section id="corrections" className="corrections" aria-labelledby="corrections-h">
      {thanks && <p className="callout" role="status">Thanks, your correction was sent.</p>}
      <details ref={ref}>
        <summary id="corrections-h">Spot something wrong or out of date? Send a correction</summary>
        <form ref={formRef} action={cfg.action} method="POST" target={google ? "corrections-sink" : undefined}
          onSubmit={formspree ? submitFetch : () => { sent.current = true; }}>
          {formspree && (
            <>
              <input type="hidden" name="_subject" value={`Marauder's Map correction: ${about}`} />
              <input type="text" name="_gotcha" className="honey" tabIndex={-1} autoComplete="off" aria-hidden />
            </>
          )}
          {cfg.kind === "formsubmit" && (
            <>
              <input type="hidden" name="_subject" value={`Marauder's Map correction: ${about}`} />
              <input type="hidden" name="_template" value="table" />
              {next && <input type="hidden" name="_next" value={next} />}
              <input type="text" name="_honey" className="honey" tabIndex={-1} autoComplete="off" aria-hidden />
            </>
          )}
          <label>
            <span className="label">about</span>
            <select className="field" name={f.about} value={about} onChange={(e) => setAbout(e.target.value)}>
              <option>General</option>
              {companies.map((c) => <option key={c.id}>{c.name}</option>)}
              <option>GSB calendar</option>
              <option>Role titles</option>
              <option>Prep resources</option>
            </select>
          </label>
          <label>
            <span className="label">what&apos;s wrong, and what&apos;s right</span>
            <textarea className="field" name={f.correction} required rows={4} maxLength={4000}
              placeholder="Which date, title or number is off, and what it should be." />
          </label>
          <label>
            <span className="label">source, if you have one</span>
            <input className="field" type="url" name={f.source} placeholder="https://…" />
          </label>
          <label>
            <span className="label">your email, only if you&apos;d like a reply</span>
            <input className="field" type="email" name={f.email} autoComplete="email" />
          </label>
          <button className="send" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send correction"}</button>
          {state === "error" && <p className="small" role="alert" style={{ color: "var(--cardinal)" }}>That didn&apos;t go through. Try again in a minute.</p>}
          <p className="small muted">
            {formspree ? "Goes to the site's maintainer through Formspree." : google ? "Goes to the site's maintainer through Google Forms." : "Sent by email to the site's maintainer through FormSubmit, which keeps submissions for 30 days."} Nothing is published automatically.
          </p>
        </form>
        {google && (
          // Google answers with its own page; landing it in a hidden frame keeps the reader on the map.
          <iframe name="corrections-sink" title="Corrections form response" className="sink" tabIndex={-1} aria-hidden
            onLoad={() => { if (sent.current) { sent.current = false; setThanks(true); formRef.current?.reset(); if (ref.current) ref.current.open = false; } }} />
        )}
      </details>
    </section>
  );
}
