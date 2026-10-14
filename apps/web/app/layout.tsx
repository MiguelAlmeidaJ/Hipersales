import type { Metadata, Viewport } from "next";
import "./globals.css";
import FeedbackPopup from "@/components/ui/feedback-popup";

export const metadata: Metadata = {
  title: "Hipersales",
  description: "Gestão comercial Hipersales",
  icons: { icon: "/assets/favicon.ico" },
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0d6fd8" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}<FeedbackPopup /></body>
    </html>
  );
}
