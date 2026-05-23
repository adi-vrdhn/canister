import type { Metadata } from "next";
import { tvMetadata, tvSchema, breadcrumbSchema, BASE_URL } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function fetchTvMazeShow(id: string) {
  try {
    const res = await fetch(`https://api.tvmaze.com/shows/${id}`, {
      next: { revalidate: 60 * 60 * 24 }, // Cache 24 hours
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = await fetchTvMazeShow(id);
  if (!show) return { title: "TV Show | Canisterr" };
  return tvMetadata(show);
}

export default async function TvLayout({ params, children }: Props) {
  const { id } = await params;
  const show = await fetchTvMazeShow(id);

  return (
    <>
      {show && (
        <>
          <JsonLd data={tvSchema(show)} />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", url: BASE_URL },
              { name: "TV Shows", url: `${BASE_URL}/dashboard` },
              { name: show.name, url: `${BASE_URL}/tv/${id}` },
            ])}
          />
        </>
      )}
      {children}
    </>
  );
}
