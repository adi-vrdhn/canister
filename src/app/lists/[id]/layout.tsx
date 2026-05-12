import type { Metadata } from "next";
import { canonical, baseMetadata } from "@/lib/seo";
import { getPublicListWithDetails } from "@/lib/lists-public";
import { normalizeListIdParam } from "@/lib/list-ids";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listId = normalizeListIdParam(id);

  if (!listId) {
    return baseMetadata({
      title: "List",
      description: "Explore movie lists on Canisterr.",
      alternates: { canonical: canonical("/lists") },
    });
  }

  const list = await getPublicListWithDetails(listId);

  if (!list) {
    return baseMetadata({
      title: "List",
      description: "Explore movie lists on Canisterr.",
      alternates: { canonical: canonical(`/lists/${listId}`) },
    });
  }

  const heroImage = list.cover_image_url || list.items[0]?.content.poster_url || null;
  const description =
    list.description || `Explore ${list.name} on Canisterr.`;

  return baseMetadata({
    title: list.name,
    description,
    alternates: { canonical: canonical(`/lists/${listId}`) },
    openGraph: {
      type: "website",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(`/lists/${listId}`),
      title: list.name,
      description,
      images: heroImage
        ? [{ url: heroImage, alt: list.name }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: list.name,
      description,
      images: heroImage ? [heroImage] : undefined,
    },
  });
}

export default function ListLayout({ children }: Props) {
  return children;
}
