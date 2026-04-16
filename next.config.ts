import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  devIndicators: {
    position: "bottom-right",
  },
  allowedDevOrigins: ["192.168.0.8"],
};

export default nextConfig;
