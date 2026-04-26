import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";
import GlobalErrorListener from "@/components/GlobalErrorListener";

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
        <Script id="localhost-sw-cleanup" strategy="beforeInteractive">
          {`(() => {
            const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
            if (!isLocalhost || !("serviceWorker" in navigator)) return;

            (async () => {
              let hadRegistrations = false;

              try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                if (registrations.length > 0) {
                  hadRegistrations = true;
                  await Promise.all(registrations.map((registration) => registration.unregister()));
                }
              } catch (error) {
                console.warn("Service worker cleanup failed:", error);
              }

              try {
                if ("caches" in window) {
                  const keys = await caches.keys();
                  if (keys.length > 0) {
                    await Promise.all(keys.map((key) => caches.delete(key)));
                  }
                }
              } catch (error) {
                console.warn("Cache cleanup failed:", error);
              }

              if (hadRegistrations) {
                window.location.reload();
              }
            })();
          })();`}
        </Script>
        <HydrationFix>{children}</HydrationFix>
        <GlobalErrorListener />
      </body>
    </html>
  );
}
