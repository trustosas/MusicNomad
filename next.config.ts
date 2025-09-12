import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Enable the latest Next.js features
    turbo: {
      rules: {
        "*.svg": {
          loaders: ["@svgr/webpack"],
          as: "*.js",
        },
      },
    },
    // Allow Builder.io preview/screenshot proxy origins during development
    allowedDevOrigins: [
      'https://vivacious-smoke.net',
      'https://*.vivacious-smoke.net',
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
