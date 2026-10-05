import { ImageResponse } from "next/og";
import { companies, companyById, hiring, meta } from "@/data";
import { companyPath, snapshot } from "@/lib/share";
import { C, Frame, OG_SIZE, SeasonBars, ogFonts } from "@/lib/og";

// The preview card for a company's link (/c/<id>/og.png): its name, where it stood at the last check, and its
// past cycles. Wired up in ../page.tsx's metadata; see src/lib/og.tsx for why this isn't an opengraph-image file.

export const dynamic = "force-static";
export const dynamicParams = false;
export const generateStaticParams = () => companies.map((c) => ({ id: c.id }));

const cycle = meta.currentCycle;

export async function GET(_req: Request, { params }: RouteContext<"/c/[id]/og.png">) {
  const { id } = await params;
  const c = companyById[id], h = hiring[id];
  const s = snapshot(h, cycle);
  const years = h.windows.map((w) => w.cycle).sort();
  return new ImageResponse(
    (
      <Frame path={companyPath(id)} right={`${h.hasProgram ? "past cycles" : "company facts"} · sources · field notes`}>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30 }}>
          <div style={{ fontFamily: "Newsreader", fontSize: 112, lineHeight: 1, letterSpacing: -1 }}>{c.name}</div>
          <div style={{ fontFamily: "Newsreader", fontSize: 44, color: C.cardinal, marginTop: 18 }}>{s.status}</div>
          {s.usual && <div style={{ fontFamily: "Newsreader", fontStyle: "italic", fontSize: 38, color: C.ink2, marginTop: 6 }}>{s.usual[0].toUpperCase() + s.usual.slice(1)}</div>}
        </div>
        {years.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", marginTop: "auto", paddingTop: 16, paddingBottom: 22 }}>
            <div style={{ fontFamily: "IBM Plex Mono", fontSize: 19, color: C.cardinal, marginBottom: 8 }}>
              {`when applications opened · ${years[0]}–${years.at(-1)}${years.includes(cycle) ? " · black = this cycle" : ""}`}
            </div>
            <SeasonBars h={h} cycle={cycle} />
          </div>
        )}
      </Frame>
    ),
    { ...OG_SIZE, fonts: await ogFonts() },
  );
}
