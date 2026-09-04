import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Pin the workspace root; a lockfile higher up the drive otherwise wins.
  outputFileTracingRoot: path.resolve(process.cwd()),
  // node:sqlite is a Node builtin; keep it out of the bundler's module graph.
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
