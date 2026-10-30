import { filterTasks, isOpen, readStore, todayKst } from "@toolhub/tasks";
import type { Metadata } from "next";
import { DATA_DIR } from "../lib/data";
import "./globals.css";
import { Sidebar, type SidebarData } from "./sidebar";

export const metadata: Metadata = {
  title: "toolhub",
};

// 사이드바의 할 일 개수가 매번 최신이어야 하므로 캐시하지 않는다
export const dynamic = "force-dynamic";

async function sidebarData(): Promise<SidebarData> {
  const store = await readStore(DATA_DIR);
  const today = todayKst();
  const open = store.tasks.filter(isOpen);
  const labelCounts = new Map<string, number>();
  for (const t of open) for (const l of t.labels) labelCounts.set(l, (labelCounts.get(l) ?? 0) + 1);
  return {
    projects: store.projects.map((p) => ({ ...p, count: open.filter((t) => t.projectId === p.id).length })),
    labels: [...labelCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    counts: {
      today: filterTasks(store.tasks, { view: "today" }, today).length,
      overdue: open.filter((t) => t.dueDate && t.dueDate < today).length,
      week: filterTasks(store.tasks, { view: "week" }, today).length,
      inbox: filterTasks(store.tasks, { view: "inbox" }, today).length,
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app">
          {/* 모든 페이지가 요청마다 렌더링되므로 Suspense 없이 본문과 함께 그린다 (메뉴가 늦게 나타나 화면이 밀리지 않게) */}
          <Sidebar data={await sidebarData()} />
          <div className="app-main">{children}</div>
        </div>
      </body>
    </html>
  );
}
