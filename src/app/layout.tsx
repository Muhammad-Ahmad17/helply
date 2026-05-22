import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Helply — AI chat for your website",
  description:
    "Paste a URL, get an AI chatbot trained on your content. Embed it anywhere with one line of code.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  openGraph: {
    title: "Helply — AI chat for your website",
    description: "Paste a URL, get an AI chatbot trained on your content.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
