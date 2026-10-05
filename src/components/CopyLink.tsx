"use client";

import { useEffect, useState } from "react";
import { companyUrl } from "@/lib/share";

/** Copies a company's own link (/c/<id>/), the one to paste into Slack or WhatsApp. */
export function CopyLink({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const url = companyUrl(id);
  useEffect(() => {
    if (state !== "copied") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState("copied");
    } catch {
      setState("failed"); // no clipboard access (old browser, insecure context): show the link to copy by hand
    }
  };
  return (
    <span className="copylink" aria-live="polite">
      {state === "failed" ? <a href={url}>{url.replace(/^https:\/\//, "")}</a>
        : <button type="button" className="linkish quiet" onClick={copy} title={url}>{state === "copied" ? "link copied" : "copy link"}</button>}
    </span>
  );
}
