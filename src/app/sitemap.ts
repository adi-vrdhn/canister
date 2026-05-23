import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/seo";

// Static routes that are always present and publicly accessible.
// Dynamic routes (movies, profiles, posts) require Firebase Admin SDK to enumerate —
// add those by querying Firebase server-side once you have a service account set up.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  return staticRoutes;
}
