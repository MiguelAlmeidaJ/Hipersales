import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hipersales",
  description: "Gestão comercial Hipersales",
  icons: { icon: "/assets/iconapp.png" },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
