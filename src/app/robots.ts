import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/movie/",
          "/tv/",
          "/profile/",
          "/posts/",
          "/lists/",
          "/privacy",
          "/terms",
        ],
        disallow: [
          "/api/",
          "/auth/",
          "/dashboard",
          "/profile/edit",
          "/profile/settings/",
          "/notifications",
          "/scan",
          "/share",
          "/taste",
          "/movie-matcher",
          "/friends",
          "/all-movies",
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
