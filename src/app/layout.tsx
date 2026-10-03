import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Designed by the Braille Institute for low-vision readers: distinct letterforms (Il1, O0).
const legible = Atkinson_Hyperlegible_Next({ subsets: ["latin"], variable: "--font-legible", display: "swap" });

export const metadata: Metadata = {
  title: "Waymax",
  description: "Helping people with memory loss know who is here, what today holds, and where they are.",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${legible.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
