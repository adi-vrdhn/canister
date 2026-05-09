import type { Metadata } from "next";
import { baseMetadata, canonical } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  // /logs/[id] is the internal route — mark noindex so Google uses /log/[username]/[slug] as canonical.
  return baseMetadata({
    title: "Movie Log",
    description: "See this movie log on Canisterr.",
    alternates: { canonical: canonical(`/logs/${id}`) },
    robots: { index: false, follow: true },
  });
}

export default function LogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
