import { allFeed, companyFeed, feedIds } from "@/lib/export";

// Calendar feeds, written as static files at build time: /cal/all.ics and /cal/<id>.ics.
export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return ["all", ...feedIds].map((id) => ({ file: `${id}.ics` }));
}

export async function GET(_req: Request, { params }: RouteContext<"/cal/[file]">) {
  const { file } = await params;
  const id = file.replace(/\.ics$/, "");
  return new Response(id === "all" ? allFeed() : companyFeed(id), { headers: { "Content-Type": "text/calendar; charset=utf-8" } });
}
