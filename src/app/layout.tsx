import type { Metadata, Viewport } from "next";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";

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
        <HydrationFix>{children}</HydrationFix>
      </body>
    </html>
  );
}
