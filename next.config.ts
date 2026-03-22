import type { NextConfig } from "next";
import { readFileSync } from "fs";
import { resolve } from "path";

const { version } = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf-8")
) as { version: string };

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/wealth-management",
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
};

export default nextConfig;
