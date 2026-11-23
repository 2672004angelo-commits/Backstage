import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@resvg/resvg-js", "mongodb", "harfbuzzjs"],
  outputFileTracingIncludes: {
    "/api/**": ["./public/fonts/NotoSansArabic.ttf", "./node_modules/harfbuzzjs/dist/harfbuzz.wasm"],
    "/api/admin/payments/*": ["./public/fonts/NotoSansArabic.ttf"],
    "/api/admin/tickets/*": ["./public/fonts/NotoSansArabic.ttf"],
    "/api/bookings/search": ["./public/fonts/NotoSansArabic.ttf"],
  },
};

export default nextConfig;
