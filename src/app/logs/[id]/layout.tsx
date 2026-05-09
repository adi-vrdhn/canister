import type { Metadata } from "next";
import { baseMetadata, canonical } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  return baseMetadata({
    title: "Movie Log",
    description: "See this movie log on Canisterr.",
    alternates: { canonical: canonical(`/logs/${id}`) },
  });
}

export default function LogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
