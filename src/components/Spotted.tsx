"use client";

import { useState } from "react";
import { meta } from "@/data";
import { LIMITS } from "@/lib/spotted";
import { track } from "@/lib/analytics";

// "Seen it posted?" for companies the daily watcher can't check (watch.json kind "manual"). Same mechanics as
// Corrections and Contribute: Formspree, sent with fetch so the reader gets a real success or error. Nothing is
// published until the maintainer checks the link and runs scripts/add-spotted.mjs.

export default function Spotted({ id, name }: { id: string; name: string }) {
  const cfg = meta.spotted;
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "error" | "sent">("idle");

  if (!cfg) return null;
  const f = cfg.fields;

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setState("sending");
    try {
      const res = await fetch(cfg.action, { method: "POST", body: new FormData(e.currentTarget), headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(String(res.status));
      setState("sent");
      track(`spotted/${id}`, "Reported a posting");
    } catch {
      setState("error");
    }
  };
  if (state === "sent") return <p className="small spotted" role="status">Thanks — it&apos;ll show here once someone checks the link.</p>;
  return (
    <div className="spotted corrections">
      <p className="small">
        We can&apos;t check {name}&apos;s careers site by script. Seen its MBA internship posted?{" "}
        {!open && <button type="button" className="linkish" onClick={() => setOpen(true)}>Tell us where</button>}
      </p>
      {open && (
        <form action={cfg.action} method="POST" onSubmit={submit}>
          <input type="hidden" name="kind" value="spotted" />
          <input type="hidden" name={f.company} value={id} />
          <input type="hidden" name="_subject" value={`Marauder's Map it's live: ${name}`} />
          <input type="text" name="_gotcha" className="honey" tabIndex={-1} autoComplete="off" aria-hidden />
          <label>
            <span className="label">link to the posting</span>
            <input className="field" type="url" name={f.url} required maxLength={LIMITS.url} pattern="https://.*" placeholder="https://…" />
          </label>
          <label>
            <span className="label">title, if you can copy it (optional)</span>
            <input className="field" type="text" name={f.title} maxLength={LIMITS.title} autoComplete="off" />
          </label>
          <label>
            <span className="label">your email, only if you&apos;d like a reply (optional)</span>
            <input className="field" type="email" name={f.email} autoComplete="email" />
          </label>
          <button className="send" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send link"}</button>
          {state === "error" && <p className="small" role="alert" style={{ color: "var(--cardinal)" }}>That didn&apos;t go through. Try again in a minute.</p>}
          <p className="small muted">Goes to the site&apos;s maintainer through Formspree. It shows here only after the link is checked.</p>
        </form>
      )}
    </div>
  );
}
