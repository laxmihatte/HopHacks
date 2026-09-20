import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Self-hosted at build time, so the app still renders correctly offline.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Out-of-Pocket Cost Estimator & Aid Navigator",
  description:
    "Estimate cycle-by-cycle out-of-pocket cancer treatment cost from published CMS payment limits, find the assistance programs a household qualifies for, and find the cheapest clinically acceptable start date.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
