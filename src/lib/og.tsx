import type { ReactNode } from "react";
import type { Hiring } from "@/data/types";
import { SEASON_MONTHS, SEASON_WEEKS, monthStartWeek, span } from "./season";

// Link-preview images (1200×630), drawn at build time by next/og in the site's own look: paper, ink, cardinal,
// Newsreader for headlines and IBM Plex for labels. Satori lays out flexbox only, so every box is display: flex
// and every text node is a single string.
//
// They're route handlers named og.png rather than opengraph-image files: under a static export, opengraph-image
// is written as a file with no extension, which a static host serves as application/octet-stream, and some link
// unfurlers then skip the image. A real .png is served as image/png anywhere.

export const OG_SIZE = { width: 1200, height: 630 };

/** Metadata for a page's preview image. The version query makes Slack and friends refetch after a data refresh. */
export const ogImage = (path: string, alt: string, version: string) =>
  [{ url: `${path}og.png?v=${version}`, ...OG_SIZE, alt, type: "image/png" }];
export const C = {
  paper: "#f5f1e8", paper2: "#ece6d8", ink: "#1c1a16", ink2: "#4a463e", ink3: "#6b665b", rule: "#d6cfbf", cardinal: "#8c1515", stone: "#b6ae9e",
};
const OPACITY = { strong: 0.95, medium: 0.6, weak: 0.3 };

// next/font only ships woff2, which Satori can't read, so fetch the same families as TTF from Google Fonts
// (it serves TTF to clients that don't ask for woff2). Once per build worker.
const FAMILIES = [
  { name: "Newsreader", css: "Newsreader:ital@0;1" },
  { name: "IBM Plex Sans", css: "IBM+Plex+Sans" },
  { name: "IBM Plex Mono", css: "IBM+Plex+Mono" },
];
type Font = { name: string; data: ArrayBuffer; weight: 400; style: "normal" | "italic" };
let fonts: Promise<Font[]> | null = null;
export function ogFonts() {
  fonts ??= (async () => {
    const css = await fetch(`https://fonts.googleapis.com/css2?${FAMILIES.map((f) => `family=${f.css}`).join("&")}`).then((r) => {
      if (!r.ok) throw new Error(`Google Fonts CSS: ${r.status}`);
      return r.text();
    });
    const faces = [...css.matchAll(/font-family: '([^']+)';\s*font-style: (normal|italic);[\s\S]*?src: url\(([^)]+)\) format\('truetype'\)/g)];
    if (faces.length < FAMILIES.length) throw new Error("Google Fonts CSS: expected TrueType faces for the OG images");
    return Promise.all(faces.map(async ([, name, style, url]) => {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`Font ${name}: ${r.status}`);
      return { name, data: await r.arrayBuffer(), weight: 400 as const, style: style as Font["style"] };
    }));
  })();
  return fonts;
}

/** The shared frame: masthead line on top, a rule, the body, and the address at the foot. */
export function Frame({ path, children, right }: { path: string; children: ReactNode; right?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: C.paper, color: C.ink, fontFamily: "IBM Plex Sans", padding: "52px 72px 44px", position: "relative" }}>
      {/* Faint fold creases, as on the page. */}
      <div style={{ position: "absolute", left: 400, top: 0, bottom: 0, width: 1, background: "rgba(28,26,22,0.05)" }} />
      <div style={{ position: "absolute", left: 800, top: 0, bottom: 0, width: 1, background: "rgba(28,26,22,0.05)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 315, height: 1, background: "rgba(28,26,22,0.04)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "IBM Plex Mono", fontSize: 21, color: C.ink3, paddingBottom: 14, borderBottom: `3px solid ${C.ink}` }}>
        <span>the marauder&apos;s map of big tech recruiting</span>
        <span style={{ color: C.cardinal }}>gsb mba1s</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "IBM Plex Mono", fontSize: 20, color: C.ink3, borderTop: `1px solid ${C.rule}`, paddingTop: 14 }}>
        <span>{`marauders-map.natwong.dev${path === "/" ? "" : path}`}</span>
        {right && <span>{right}</span>}
      </div>
    </div>
  );
}

/** Past cycles on one May–Mar axis, like the field notes' season bar. Black is this cycle. */
export function SeasonBars({ h, cycle }: { h: Hiring; cycle: string }) {
  const W = 1056, ROW = 21;
  const x = (wk: number) => (Math.max(0, Math.min(SEASON_WEEKS, wk)) / SEASON_WEEKS) * W;
  const rows = [...h.windows].sort((a, b) => a.cycle.localeCompare(b.cycle));
  return (
    <div style={{ display: "flex", flexDirection: "column", width: W }}>
      <div style={{ display: "flex", position: "relative", width: W, height: ROW * rows.length + 8, background: C.paper2 }}>
        {rows.map((o, i) => {
          const [a, b] = span(o);
          return (
            <div key={o.cycle} style={{ position: "absolute", top: 4 + i * ROW, left: x(a), width: Math.max(14, x(b) - x(a)), height: ROW - 6, borderRadius: 8,
              background: o.cycle === cycle ? C.ink : C.cardinal, opacity: OPACITY[o.evidence] }} />
          );
        })}
      </div>
      <div style={{ display: "flex", position: "relative", width: W, height: 26, fontFamily: "IBM Plex Mono", fontSize: 18, color: C.ink3 }}>
        {SEASON_MONTHS.map((m, i) => <span key={m} style={{ position: "absolute", left: x(monthStartWeek(i, cycle)), top: 4 }}>{m}</span>)}
      </div>
    </div>
  );
}
