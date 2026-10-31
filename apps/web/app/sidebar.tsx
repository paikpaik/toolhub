"use client";

import type { Project } from "@toolhub/tasks/model";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "./icons";

export interface SidebarData {
  projects: (Project & { count: number })[];
  labels: { name: string; count: number }[];
  counts: { today: number; overdue: number; week: number; inbox: number };
}

interface Item {
  href: string;
  label: string;
  icon: IconName;
  count?: number;
  /** 강조 숫자 (지난 일정 등) */
  alert?: boolean;
}

function NavItem({ item, active }: { item: Item; active: boolean }) {
  return (
    <Link href={item.href} className={`side-item${active ? " active" : ""}`}>
      <Icon name={item.icon} />
      <span className="side-label">{item.label}</span>
      {item.count ? <span className={`side-count${item.alert ? " alert" : ""}`}>{item.count}</span> : null}
    </Link>
  );
}

export function Sidebar({ data }: { data: SidebarData }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [projectName, setProjectName] = useState("");

  // 다른 페이지로 이동하면 모바일 메뉴를 닫는다
  useEffect(() => setOpen(false), [pathname, params]);

  const view = params.get("view") ?? "today";
  const project = params.get("project");
  const label = params.get("label");
  const onTasks = pathname === "/tasks";
  const isTaskView = (v: string) => onTasks && !project && !label && view === v;

  const taskItems: Item[] = [
    { href: "/tasks?view=today", label: "오늘", icon: "today", count: data.counts.today, alert: data.counts.overdue > 0 },
    { href: "/tasks?view=week", label: "다음 7일", icon: "week", count: data.counts.week },
    { href: "/tasks?view=inbox", label: "날짜 없음", icon: "inbox", count: data.counts.inbox },
    { href: "/tasks?view=all", label: "전체", icon: "list" },
    { href: "/tasks?view=board", label: "보드", icon: "board" },
    { href: "/tasks?view=calendar", label: "캘린더", icon: "calendar" },
    { href: "/tasks?view=done", label: "완료됨", icon: "done" },
  ];
  const blogItems: Item[] = [
    { href: "/blog", label: "실시간", icon: "live" },
    { href: "/blog/history", label: "키워드 기록", icon: "history" },
    { href: "/blog/keyword", label: "키워드 분석", icon: "search" },
    { href: "/blog/drafts", label: "초안", icon: "file" },
    { href: "/blog/thumbnail", label: "썸네일", icon: "image" },
    { href: "/blog/guide", label: "작성 가이드", icon: "book" },
  ];

  const addProject = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    if (!name) return setAdding(false);
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setProjectName("");
    setAdding(false);
    if (res.ok) {
      const created: Project = await res.json();
      router.push(`/tasks?project=${created.id}`);
      router.refresh();
    }
  };

  return (
    <>
      <div className="mobile-bar">
        <button type="button" className="icon-button ghost" onClick={() => setOpen(!open)} aria-label="메뉴">
          <Icon name="menu" />
        </button>
        <span className="brand">toolhub</span>
      </div>
      <aside className={`sidebar${open ? " open" : ""}`}>
        <Link href="/tasks" className="brand side-brand">
          <span className="brand-mark">t</span> toolhub
        </Link>

        <nav aria-label="일정 관리">
          <div className="side-section">일정 관리</div>
          {taskItems.map((item) => (
            <NavItem key={item.href} item={item} active={isTaskView(new URL(item.href, "http://x").searchParams.get("view")!)} />
          ))}

          <div className="side-section with-action">
            프로젝트
            <button type="button" className="side-action" onClick={() => setAdding(true)} aria-label="프로젝트 추가" title="프로젝트 추가">
              <Icon name="plus" size={14} />
            </button>
          </div>
          {data.projects.map((p) => (
            <Link key={p.id} href={`/tasks?project=${p.id}`} className={`side-item${onTasks && project === p.id ? " active" : ""}`}>
              <span className="project-dot" style={{ background: p.color }} />
              <span className="side-label">{p.name}</span>
              {p.count ? <span className="side-count">{p.count}</span> : null}
            </Link>
          ))}
          {adding && (
            <form onSubmit={addProject} className="side-add">
              <input
                autoFocus
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                onBlur={addProject}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder="프로젝트 이름"
              />
            </form>
          )}
          {!data.projects.length && !adding && <p className="side-empty">빠른 추가에서 @이름 으로도 만들 수 있어요</p>}

          {data.labels.length > 0 && (
            <>
              <div className="side-section">태그</div>
              {data.labels.map((l) => (
                <Link key={l.name} href={`/tasks?label=${encodeURIComponent(l.name)}`} className={`side-item${onTasks && label === l.name ? " active" : ""}`}>
                  <Icon name="hash" />
                  <span className="side-label">{l.name}</span>
                  <span className="side-count">{l.count}</span>
                </Link>
              ))}
            </>
          )}
        </nav>

        <nav aria-label="블로그 자동화">
          <div className="side-section">블로그 자동화</div>
          {blogItems.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              active={item.href === "/blog" ? pathname === "/blog" : pathname.startsWith(item.href)}
            />
          ))}
        </nav>
      </aside>
      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}
    </>
  );
}
