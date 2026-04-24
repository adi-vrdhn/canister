import type { Metadata } from "next";
import "./globals.css";
import HydrationFix from "@/components/HydrationFix";

export const metadata: Metadata = {
  title: "Canisterr",
  description: "Share movies with people who matter",
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
