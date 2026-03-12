import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Maya Atlas",
  description: "A web-based interactive atlas of the Maya world."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
