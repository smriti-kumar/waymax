import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Waymax",
  description: "Helping people with memory loss know who is here, what today holds, and where they are.",
};

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
