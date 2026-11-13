import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "HEXORCIST // Universal CAN-Bus & FinTech Escrow Chimera",
  description:
    "Kiroween 2026 Frankenstein Chimera: SAE J1979 OBD-II + ISO 14229 UDS Hex Engine, Virtual Road Dyno, Google Cloud Vertex AI Necromancer & Autonomous Repair Escrow Vault.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-screen bg-[#06070A] text-[#E6EDF3] font-sans selection:bg-[#00FF9D]/25 selection:text-[#00FF9D]">
        {children}
      </body>
    </html>
  );
}
