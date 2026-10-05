"use client";

import { useState } from "react";
import Script from "next/script";
import { meta } from "@/data";
import { flush, goatcounterEndpoint, track } from "@/lib/analytics";

/** GoatCounter's script, only when meta.json turns analytics on. It counts the page view itself. */
export default function Analytics() {
  const a = meta.analytics;
  if (!a) return null;
  return <Script src="https://gc.zgo.at/count.js" data-goatcounter={goatcounterEndpoint(a.code)} strategy="afterInteractive" onLoad={flush} />;
}

/** "Useful? yes / not really", sent as an anonymous event. Shown only when analytics is on, so a click always counts. */
export function Useful() {
  const [answered, setAnswered] = useState(false);
  if (!meta.analytics) return null;
  const answer = (v: "yes" | "no") => {
    track(`useful/${v}`, v === "yes" ? "Useful: yes" : "Useful: not really");
    setAnswered(true);
  };
  return (
    <p className="useful" aria-live="polite">
      {answered ? "thanks, noted." : (
        <>
          was this useful?{" "}
          <button type="button" className="linkish quiet" onClick={() => answer("yes")}>yes</button>{" / "}
          <button type="button" className="linkish quiet" onClick={() => answer("no")}>not really</button>
          <span className="muted"> · counted anonymously, no cookies</span>
        </>
      )}
    </p>
  );
}
