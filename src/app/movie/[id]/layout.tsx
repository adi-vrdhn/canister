import type { Metadata } from "next";
import { movieMetadata, movieSchema, breadcrumbSchema, BASE_URL } from "@/lib/seo";
import JsonLd from "@/components/JsonLd";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

async function fetchTmdbMovie(id: string) {
  const apiKey = process.env.NEXT_PUBLIC_TMDB_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${id}?api_key=${apiKey}&language=en-US`,
      { next: { revalidate: 60 * 60 * 24 } } // Cache 24 hours
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movie = await fetchTmdbMovie(id);
  if (!movie) return { title: "Movie | Canisterr" };
  return movieMetadata(movie);
}

export default async function MovieLayout({ params, children }: Props) {
  const { id } = await params;
  const movie = await fetchTmdbMovie(id);

  return (
    <>
      {movie && (
        <>
          <JsonLd data={movieSchema(movie)} />
          <JsonLd
            data={breadcrumbSchema([
              { name: "Home", url: BASE_URL },
              { name: "Movies", url: `${BASE_URL}/all-movies` },
              { name: movie.title, url: `${BASE_URL}/movie/${id}` },
            ])}
          />
        </>
      )}
      {children}
    </>
  );
}
