"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { companies, meta } from "@/data";
import { useToday } from "@/lib/useToday";
import { companyPath } from "@/lib/share";

interface GuideState {
  selected: string;
  /** Select a company and, when asked, bring the company explorer into view. */
  select: (id: string, opts?: { reveal?: boolean }) => void;
  /** The reader's date, or the last data check while prerendering. */
  today: string;
  live: boolean; // false until the browser has supplied today's date
}

const Ctx = createContext<GuideState | null>(null);
const InitialCtx = createContext<string | null>(null);

/** Opens the guide inside it with a company already picked (the /c/<id>/ pages). */
export function InitialCompany({ id, children }: { id: string; children: ReactNode }) {
  return <InitialCtx.Provider value={id}>{children}</InitialCtx.Provider>;
}

export function GuideProvider({ children }: { children: ReactNode }) {
  const clientToday = useToday();
  const initial = useContext(InitialCtx);
  const [selected, setSelected] = useState(initial ?? companies[0].id);
  const select = useCallback((id: string, opts?: { reveal?: boolean }) => {
    setSelected(id);
    // Keep the address bar on the company's own page, so whatever the reader copies is the link to share.
    window.history.replaceState(null, "", companyPath(id));
    if (opts?.reveal) document.getElementById("companies")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  // A company's page opens on its field notes. Wait two frames so the charts have measured themselves first,
  // and leave the reader where they are if the browser already restored a scroll position.
  useEffect(() => {
    if (!initial) return;
    let id = requestAnimationFrame(() => (id = requestAnimationFrame(() => {
      if (window.scrollY > 40) return;
      const stacked = window.matchMedia("(max-width: 900px)").matches; // the panel sits under the chart
      document.getElementById(stacked ? "field-notes" : "companies")?.scrollIntoView({ behavior: "instant", block: "start" });
    })));
    return () => cancelAnimationFrame(id);
  }, [initial]);
  const value = useMemo(
    () => ({ selected, select, today: clientToday ?? meta.researched, live: clientToday !== null }),
    [selected, select, clientToday],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGuide() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGuide must be used inside <GuideProvider>");
  return v;
}
