import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Void | Premium Video & Audio Downloader",
  description: "A premium, ad-free web tool to download videos and playlists from YouTube, Twitter, Facebook, TikTok, Instagram, and more instantly with real-time progress.",
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
