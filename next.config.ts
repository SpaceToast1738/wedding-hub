import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // v2.8.0: read_file_content's PDF extraction. pdf-parse drags in
  // pdfjs-dist plus the native @napi-rs/canvas addon — webpack must not
  // try to bundle that tree (native .node binaries + dynamic requires
  // break it). External packages are require()d from node_modules at
  // runtime and traced into the standalone output by Next's file tracing.
  serverExternalPackages: ["pdf-parse"],
  experimental: {
    serverActions: {
      // Headroom for the file upload action — see src/lib/uploads.ts where
      // MAX_UPLOAD_BYTES (25 MB) is enforced after the request reaches us.
      // Caddy also caps inbound bodies at 4 MB by default, so the practical
      // ceiling is whichever is lower; raise the Caddyfile `request_body
      // max_size` if you want to use the full 26 MB.
      bodySizeLimit: "26mb",
    },
  },
  // Caddy handles security headers; keep one defensive default here too.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
