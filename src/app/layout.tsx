import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";
import GlobalErrorListener from "@/components/GlobalErrorListener";
import LocalhostServiceWorkerCleanup from "@/components/LocalhostServiceWorkerCleanup";

export const metadata: Metadata = {
  title: "Canisterr",
  description: "Share movies with people who matter",
  applicationName: "Canisterr",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Canisterr",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#090909",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT;

  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        {adsenseClient ? (
          <Script
            async
            crossOrigin="anonymous"
            data-cine-adsense="true"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsenseClient}`}
          />
        ) : null}
        <LocalhostServiceWorkerCleanup />
        <HydrationFix>{children}</HydrationFix>
        <GlobalErrorListener />
      </body>
    </html>
  );
}
