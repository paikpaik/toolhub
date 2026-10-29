import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 워크스페이스 패키지를 TypeScript 소스 그대로 가져다 쓴다
  transpilePackages: ["@toolhub/collector"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
};

export default nextConfig;
