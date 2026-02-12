import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ScuttlePay",
  description: "A bank account for AI agents",
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
