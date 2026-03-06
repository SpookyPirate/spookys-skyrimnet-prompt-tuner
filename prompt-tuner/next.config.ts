import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Standalone output bundles the server + minimal node_modules for packaging.
  // Does not affect `next dev` — only applies to `next build`.
  output: "standalone",

  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
