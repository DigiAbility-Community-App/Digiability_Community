import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DigiAbility Admin Dashboard",
  description: "Empowering Communities Through Smart Administration",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Reading the request headers makes every page render per request, which is
  // what lets Next.js stamp middleware.ts's CSP nonce onto its <script> tags.
  // Prerendered pages would be built once with no nonce.
  await headers();

  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
