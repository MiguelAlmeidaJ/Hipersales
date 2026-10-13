import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hipersales — Gestão Comercial",
    short_name: "Hipersales",
    description: "Portal comercial e gestão de propostas.",
    id: "/app/painel",
    start_url: "/app/painel",
    scope: "/",
    display: "standalone",
    background_color: "#fcfcfc",
    theme_color: "#0767b4",
    icons: [
      { src: "/assets/appicon-pwa.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/assets/logoapp.png", sizes: "any", type: "image/png", purpose: "any" },
    ],
  };
}
