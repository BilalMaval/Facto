import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Default 1MB is too small for photo/payment-proof uploads (server
    // actions receive the file as part of the request body) — compression
    // brings files down a lot, but a busy screenshot can still land in the
    // low single-digit MB range.
    serverActions: {
      bodySizeLimit: '8mb',
    },
  },
};

export default nextConfig;
