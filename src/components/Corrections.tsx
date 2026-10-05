"use client";

import { useEffect, useRef, useState } from "react";
import { companies, meta } from "@/data";

// A plain HTML form posted to FormSubmit (https://formsubmit.co), which emails each submission to the maintainer.
// It works without JavaScript; JS only adds the return URL and the thank-you note. FormSubmit's reCAPTCHA
// stays on, and `_honey` is a honeypot that bots fill in and people never see.

export const CORRECTIONS_EVENT = "lonetree:correction";

/** Open the corrections form, optionally about a specific company. */
export function openCorrection(about?: string) {
  window.dispatchEvent(new CustomEvent(CORRECTIONS_EVENT, { detail: about }));
}

export default function Corrections() {
  const ref = useRef<HTMLDetailsElement>(null);
  const [about, setAbout] = useState("General");
  const [next, setNext] = useState<string | null>(null);
  const [thanks, setThanks] = useState(false);

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

  if (!meta.correctionsEndpoint) return null;
  return (
    <section id="corrections" className="corrections" aria-labelledby="corrections-h">
      {thanks && <p className="callout" role="status">Thanks, your correction was sent. Mischief managed.</p>}
      <details ref={ref}>
        <summary id="corrections-h">Spot something wrong or out of date? Send a correction</summary>
        <form action={meta.correctionsEndpoint} method="POST">
          <input type="hidden" name="_subject" value={`Lone Tree correction: ${about}`} />
          <input type="hidden" name="_template" value="table" />
          {next && <input type="hidden" name="_next" value={next} />}
          <input type="text" name="_honey" className="honey" tabIndex={-1} autoComplete="off" aria-hidden />

          <label>
            <span className="label">about</span>
            <select className="field" name="about" value={about} onChange={(e) => setAbout(e.target.value)}>
              <option>General</option>
              {companies.map((c) => <option key={c.id}>{c.name}</option>)}
              <option>GSB calendar</option>
              <option>Role titles</option>
              <option>Prep resources</option>
            </select>
          </label>
          <label>
            <span className="label">what&apos;s wrong, and what&apos;s right</span>
            <textarea className="field" name="correction" required rows={4} maxLength={4000}
              placeholder="Which date, title or number is off, and what it should be." />
          </label>
          <label>
            <span className="label">source, if you have one</span>
            <input className="field" type="url" name="source" placeholder="https://…" />
          </label>
          <label>
            <span className="label">your email, only if you&apos;d like a reply</span>
            <input className="field" type="email" name="email" autoComplete="email" />
          </label>
          <button className="send" type="submit">Send correction</button>
          <p className="small muted">
            Sent by email to the site&apos;s maintainer through FormSubmit, which keeps submissions for 30 days. Nothing is published automatically.
          </p>
        </form>
      </details>
    </section>
  );
}
