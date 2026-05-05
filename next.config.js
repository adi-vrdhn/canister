/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Dev-only workaround for Turbopack image cache issues with user avatars/data URLs.
    unoptimized: process.env.NODE_ENV === "development",
    formats: ["image/avif", "image/webp"],
    qualities: [75],
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'static.tvmaze.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = nextConfig;
