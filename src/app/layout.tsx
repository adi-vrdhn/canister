import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";
import AutoPushPrompt from "@/components/AutoPushPrompt";
import { CurrentUserProvider } from "@/components/CurrentUserProvider";
import ForegroundPushListener from "@/components/ForegroundPushListener";
import GlobalErrorListener from "@/components/GlobalErrorListener";
import LocalhostServiceWorkerCleanup from "@/components/LocalhostServiceWorkerCleanup";
import PwaBottomNav from "@/components/PwaBottomNav";

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
  return (
    <html lang="en">
      <body className="antialiased" suppressHydrationWarning>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-N81XQ4GZ9S"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-N81XQ4GZ9S');
        `}
        </Script>
        <LocalhostServiceWorkerCleanup />
        <CurrentUserProvider>
          <HydrationFix>{children}</HydrationFix>
        </CurrentUserProvider>
        <AutoPushPrompt />
        <ForegroundPushListener />
        <GlobalErrorListener />
        <PwaBottomNav />
      </body>
    </html>
  );
}
