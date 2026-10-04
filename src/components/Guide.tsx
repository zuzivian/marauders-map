"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { companies, meta } from "@/data";
import { useToday } from "@/lib/useToday";

interface GuideState {
  selected: string;
  /** Select a company and, when asked, bring the company explorer into view. */
  select: (id: string, opts?: { reveal?: boolean }) => void;
  /** The reader's date, or the last data check while prerendering. */
  today: string;
  live: boolean; // false until the browser has supplied today's date
}

const Ctx = createContext<GuideState | null>(null);

export function GuideProvider({ children }: { children: ReactNode }) {
  const clientToday = useToday();
  const [selected, setSelected] = useState(companies[0].id);
  const select = useCallback((id: string, opts?: { reveal?: boolean }) => {
    setSelected(id);
    if (opts?.reveal) document.getElementById("companies")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
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
