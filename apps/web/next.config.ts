import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 워크스페이스 패키지를 TypeScript 소스 그대로 가져다 쓴다
  transpilePackages: ["@toolhub/collector", "@toolhub/tasks"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
  async redirects() {
    // 첫 화면은 일정 관리. 블로그 메뉴를 /blog 아래로 옮기기 전 주소로 들어와도 새 주소로 보낸다 (쿼리는 유지됨)
    return [
      { source: "/", destination: "/tasks", permanent: false },
      { source: "/history", destination: "/blog/history", permanent: false },
      { source: "/keyword", destination: "/blog/keyword", permanent: false },
      { source: "/drafts/:path*", destination: "/blog/drafts/:path*", permanent: false },
      { source: "/thumbnail", destination: "/blog/thumbnail", permanent: false },
    ];
  },
};

export default nextConfig;
