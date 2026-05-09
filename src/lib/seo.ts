import type { Metadata } from "next";

export const BASE_URL = "https://www.canisterr.com";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";
const DEFAULT_OG_IMAGE = `${BASE_URL}/logo.png`;

// Converts any string into a URL-safe slug.
// "The Dark Knight" → "the-dark-knight"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Builds a full canonical URL.
export function canonical(path: string): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

// Builds a TMDB image URL at the requested size.
// size: "w300" | "w500" | "w780" | "original"
export function tmdbImage(path: string | null | undefined, size = "w780"): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

// Base Open Graph + Twitter metadata shared by all pages.
export function baseMetadata(overrides: Partial<Metadata> = {}): Metadata {
  return {
    metadataBase: new URL(BASE_URL),
    title: {
      default: "Canisterr",
      template: "%s | Canisterr",
    },
    description: "Log, rate, and share movies with people who matter.",
    keywords: ["movies", "film", "reviews", "letterboxd alternative", "movie tracker", "canisterr"],
    authors: [{ name: "Canisterr" }],
    creator: "Canisterr",
    openGraph: {
      siteName: "Canisterr",
      locale: "en_US",
      type: "website",
      images: [{ url: DEFAULT_OG_IMAGE, width: 512, height: 512, alt: "Canisterr" }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@canisterr",
      images: [DEFAULT_OG_IMAGE],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    },
    ...overrides,
  };
}

// Metadata for a movie page — call with raw TMDB response.
export function movieMetadata(movie: {
  id: number;
  title: string;
  overview: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  backdrop_path?: string | null;
  genres?: { name: string }[];
}): Metadata {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const title = year ? `${movie.title} (${year})` : movie.title;
  const description = movie.overview
    ? movie.overview.slice(0, 155)
    : `See reviews, ratings, and logs for ${movie.title} on Canisterr.`;

  const ogImage = tmdbImage(movie.backdrop_path ?? movie.poster_path, "w780");
  const posterImage = tmdbImage(movie.poster_path, "w500");
  const path = `/movie/${movie.id}`;

  const genreKeywords = (movie.genres ?? []).map((g) => g.name.toLowerCase());

  return baseMetadata({
    title,
    description,
    keywords: ["movie", movie.title, ...(year ? [String(year)] : []), ...genreKeywords],
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "website",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(path),
      title,
      description,
      images: ogImage
        ? [{ url: ogImage, width: 780, height: 439, alt: title }]
        : posterImage
          ? [{ url: posterImage, width: 500, height: 750, alt: title }]
          : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : posterImage ? [posterImage] : undefined,
    },
  });
}

// Metadata for a TV show page — call with raw TVMaze response.
export function tvMetadata(show: {
  id: number;
  name: string;
  summary?: string | null;
  image?: { medium?: string; original?: string } | null;
  premiered?: string | null;
  genres?: string[];
}): Metadata {
  const year = show.premiered ? new Date(show.premiered).getFullYear() : null;
  const title = year ? `${show.name} (${year})` : show.name;
  // TVMaze summary includes HTML tags — strip them.
  const description = show.summary
    ? show.summary.replace(/<[^>]+>/g, "").slice(0, 155)
    : `See reviews and logs for ${show.name} on Canisterr.`;
  const image = show.image?.original ?? show.image?.medium ?? null;
  const path = `/tv/${show.id}`;

  return baseMetadata({
    title,
    description,
    keywords: ["tv show", show.name, ...(year ? [String(year)] : []), ...(show.genres ?? [])],
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "website",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(path),
      title,
      description,
      images: image ? [{ url: image, alt: title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  });
}

// Metadata for a user profile page.
export function profileMetadata(username: string, displayName?: string | null, bio?: string | null): Metadata {
  const name = displayName || `@${username}`;
  const title = `${name}'s Profile`;
  const description = bio
    ? bio.slice(0, 155)
    : `See ${name}'s movie logs, reviews, and lists on Canisterr.`;
  const path = `/profile/${username}`;

  return baseMetadata({
    title,
    description,
    alternates: { canonical: canonical(path) },
    openGraph: {
      type: "profile",
      siteName: "Canisterr",
      locale: "en_US",
      url: canonical(path),
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  });
}

// JSON-LD schema builders

export function movieSchema(movie: {
  id: number;
  title: string;
  overview?: string | null;
  release_date?: string | null;
  poster_path?: string | null;
  runtime?: number | null;
  genres?: { name: string }[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Movie",
    name: movie.title,
    description: movie.overview ?? undefined,
    datePublished: movie.release_date ?? undefined,
    image: tmdbImage(movie.poster_path, "w500") ?? undefined,
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
    genre: (movie.genres ?? []).map((g) => g.name),
    url: canonical(`/movie/${movie.id}`),
  };
}

export function tvSchema(show: {
  id: number;
  name: string;
  summary?: string | null;
  premiered?: string | null;
  image?: { original?: string; medium?: string } | null;
  genres?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "TVSeries",
    name: show.name,
    description: show.summary?.replace(/<[^>]+>/g, "") ?? undefined,
    startDate: show.premiered ?? undefined,
    image: show.image?.original ?? show.image?.medium ?? undefined,
    genre: show.genres ?? [],
    url: canonical(`/tv/${show.id}`),
  };
}

export function breadcrumbSchema(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Canisterr",
    url: BASE_URL,
    description: "Log, rate, and share movies with people who matter.",
    potentialAction: {
      "@type": "SearchAction",
      target: `${BASE_URL}/discover?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}
