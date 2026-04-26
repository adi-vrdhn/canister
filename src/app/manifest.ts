import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Canisterr",
    short_name: "Canisterr",
    description: "Share movies with people who matter",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#ff7a1a",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
