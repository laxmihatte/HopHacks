import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Out-of-Pocket Cost Estimator & Aid Navigator",
  description:
    "Estimate cycle-by-cycle out-of-pocket cancer treatment cost from published CMS payment limits, and find the assistance programs a household qualifies for.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
