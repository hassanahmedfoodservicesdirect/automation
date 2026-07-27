import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Agency Sales Engine",
  description:
    "Internal platform for lead ingestion, GEO audits, outreach generation, and proposal workflows."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
