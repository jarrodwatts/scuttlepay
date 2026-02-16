import "~/styles/globals.css";

import { type Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";

import { env } from "~/env";
import { Providers } from "./providers";

const APP_BRIDGE_URL = `https://cdn.shopify.com/shopifycloud/app-bridge.js?apiKey=${env.NEXT_PUBLIC_SHOPIFY_APP_API_KEY ?? ""}`;

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
  title: { default: "ScuttlePay", template: "%s | ScuttlePay" },
  description: "A bank account for AI agents",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    siteName: "ScuttlePay",
    type: "website",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${geist.variable} ${geistMono.variable}`}>
      <body>
        <Script src={APP_BRIDGE_URL} strategy="beforeInteractive" />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
