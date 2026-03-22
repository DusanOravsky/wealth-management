import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/wealth-management",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
