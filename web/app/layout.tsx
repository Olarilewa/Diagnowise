import type { Metadata } from "next";
// Self-hosted variable fonts (npm packages), so no request goes to Google when building or when a patient opens a page.
import "@fontsource-variable/inter";
import "@fontsource-variable/manrope";
import "./globals.css";

export const metadata: Metadata = {
  title: "Diagnowise",
  description: "The second pair of eyes in clinical reasoning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-porcelain text-graphite antialiased">{children}</body>
    </html>
  );
}
