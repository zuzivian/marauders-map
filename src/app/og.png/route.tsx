import { ImageResponse } from "next/og";
import { companies, hiring, meta } from "@/data";
import { fmtDate } from "@/lib/season";
import { trailItems, type Mark } from "@/lib/marks";
import { C, Frame, OG_SIZE, ogFonts } from "@/lib/og";

// The preview card for the site's own link (/og.png). Counts are pinned to the last check, since the image is
// fixed at build. Wired up in ../layout.tsx's metadata.

export const dynamic = "force-static";

const cycle = meta.currentCycle;

export async function GET() {
  const items = trailItems(companies, hiring, meta.researched, cycle);
  const n = (...marks: Mark[]) => items.filter((i) => marks.includes(i.mark)).length;
  const counts = [[n("open", "closing"), "open"], [n("due"), "due any day"], [n("late"), "running late"]] as const;
  const line = counts.filter(([k]) => k > 0).map(([k, w]) => `${k} ${w}`).join(" · ");
  return new ImageResponse(
    (
      <Frame path="/" right={`${companies.length} companies · every date sourced`}>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 44 }}>
          <div style={{ fontFamily: "Newsreader", fontSize: 96, lineHeight: 1, letterSpacing: -1 }}>The Marauder&apos;s Map</div>
          <div style={{ fontFamily: "Newsreader", fontStyle: "italic", fontSize: 96, lineHeight: 1.05, color: C.cardinal }}>of big tech recruiting</div>
          <div style={{ fontFamily: "Newsreader", fontSize: 36, lineHeight: 1.35, color: C.ink2, marginTop: 28 }}>
            Who&apos;s hiring MBA interns in big tech, for what, and when.
          </div>
        </div>
        <div style={{ display: "flex", marginTop: "auto", paddingBottom: 24, fontFamily: "IBM Plex Mono", fontSize: 24, color: C.ink }}>
          <span style={{ color: C.cardinal, marginRight: 16 }}>{`as of ${fmtDate(meta.researched, { year: true }).toLowerCase()}`}</span>
          <span>{line}</span>
        </div>
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
