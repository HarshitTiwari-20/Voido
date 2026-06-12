import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Universal Video Downloader | Download from YouTube, Twitter, Instagram, TikTok & more",
  description: "A premium, ad-free web tool to download videos from YouTube, Twitter, Facebook, TikTok, Instagram, and more instantly with real-time progress.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
