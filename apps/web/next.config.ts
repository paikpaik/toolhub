import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 워크스페이스 패키지를 TypeScript 소스 그대로 가져다 쓴다
  transpilePackages: ["@toolhub/collector", "@toolhub/tasks"],
  experimental: {
    // next dev의 내장 MCP 서버(AI 에이전트용, toolhub MCP와 무관)는 브라우저 로그를 .next/dev/logs/에 기록하는데,
    // 이 파일 변경이 다시 컴파일 → 브라우저 새로고침 → 로그 기록으로 이어져 무한 새로고침이 생긴다.
    // 화면 전환이 끝나지 않아 개발 표시기에 Rendering이 계속 뜨고 페이지가 느려진다.
    // (logging.browserToTerminal: false는 터미널 출력만 끄고 파일 기록은 막지 못한다)
    mcpServer: false,
  },
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
