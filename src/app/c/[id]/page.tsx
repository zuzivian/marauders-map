import type { Metadata } from "next";
import { companies, companyById, hiring, meta } from "@/data";
import { companyPath, describe } from "@/lib/share";
import { ogImage } from "@/lib/og";
import { InitialCompany } from "@/components/Guide";
import Home from "../../page";

// One page per company, so a link dropped in Slack or WhatsApp opens the whole guide on that company's field notes
// and unfurls with its own title, description and preview image. The guide itself is the home page's.

export const dynamicParams = false;
export const generateStaticParams = () => companies.map((c) => ({ id: c.id }));

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await params;
  const c = companyById[id];
  const title = `${c.name} MBA internships · The Marauder's Map`;
  const description = describe(c, hiring[id], meta.currentCycle);
  const images = ogImage(companyPath(id), `${c.name}: MBA internship status and past application windows`, meta.researched);
  return {
    title,
    description,
    alternates: { canonical: companyPath(id) },
    openGraph: { title, description, url: companyPath(id), type: "website", images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export default async function CompanyPage({ params }: PageProps<"/c/[id]">) {
  const { id } = await params;
  return (
    <InitialCompany id={id}>
      <Home />
    </InitialCompany>
  );
}
