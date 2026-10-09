import type { MetadataRoute } from "next";
export default function manifest():MetadataRoute.Manifest {
 return {
  name:"Hipersales — Gestão Comercial",
  short_name:"Hipersales",
  description:"Portal comercial e gestão de propostas.",
  start_url:"/",
  scope:"/",
  display:"standalone",
  background_color:"#ffffff",
  theme_color:"#0d6fd8",
  icons:[{src:"/assets/logoapp.png",sizes:"any",type:"image/png",purpose:"any"}]
 };
}
