import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Wedding Hub",
    short_name: "Wedding Hub",
    description: "Private wedding planning app for Jamie & Bryony",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF9F4",
    theme_color: "#3F4F30",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
