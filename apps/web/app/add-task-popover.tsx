"use client";

import { todayKst, type Project, type Task, type TaskPatch } from "@toolhub/tasks/model";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./icons";
import { QuickAdd } from "./tasks/quick-add";

/** 블로그 화면에서 할 일을 추가할 때 마지막으로 쓴 프로젝트 (다음 번에 미리 채운다) */
const LAST_PROJECT_KEY = "toolhub:blog-task-project";

function lastProject() {
  try {
    return localStorage.getItem(LAST_PROJECT_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * 블로그 화면 곳곳의 "할 일로 추가" 버튼. 새 양식 없이 일정 관리와 같은 자연어 빠른 추가를
 * 문장이 미리 채워진 채로 연다. Enter 한 번이면 추가되고, 링크(키워드 분석·초안)는 자동으로 붙는다.
 */
export function AddTaskPopover({
  text,
  defaults,
  label = "할 일",
  title = "할 일로 추가",
  compact = false,
}: {
  /** 미리 채울 문장. 마지막으로 쓴 @프로젝트가 있으면 뒤에 붙인다 */
  text: string;
  /** 문장 밖에서 붙일 값 (링크, 하위 할 일 등) */
  defaults: TaskPatch;
  label?: string;
  title?: string;
  /** 표의 줄처럼 좁은 곳: 아이콘만 */
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [prefill, setPrefill] = useState(text);
  const [added, setAdded] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // 열 때 프로젝트 목록(@ 미리보기용)과 마지막 프로젝트를 불러온다
  useEffect(() => {
    if (!open) return;
    const project = lastProject();
    setPrefill(project ? `${text} @${project}` : text);
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => {});
  }, [open, text]);

  // 바깥을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => wrapRef.current && !wrapRef.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const add = async (input: string) => {
    setError(null);
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input, defaults }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? "추가하지 못했습니다.");
      return false;
    }
    const task = body as Task;
    // @새프로젝트로 방금 만들어졌을 수 있어 목록을 다시 받아 이름을 찾는다
    const latest = (await fetch("/api/projects").then((r) => r.json()).catch(() => [])) as Project[];
    try {
      const name = latest.find((p) => p.id === task.projectId)?.name;
      if (name) localStorage.setItem(LAST_PROJECT_KEY, name);
    } catch {
      // 기억 못 해도 추가는 됐다
    }
    setAdded(task);
    setOpen(false);
    router.refresh();
    return true;
  };

  return (
    <span className="add-task" ref={wrapRef}>
      {added ? (
        <Link className={compact ? "icon-button added" : "button small added"} href={`/tasks?view=all&task=${added.id}`} title={`할 일 #${added.id} 보기`}>
          {compact ? "✓" : `✓ 할 일 #${added.id}`}
        </Link>
      ) : (
        <button
          type="button"
          className={compact ? "icon-button row-action" : "button small"}
          onClick={() => setOpen(!open)}
          title={title}
          aria-label={title}
          aria-expanded={open}
        >
          <Icon name="plus" size={compact ? 14 : 13} />
          {!compact && ` ${label}`}
        </button>
      )}
      {open && (
        <div className="add-task-popover" role="dialog" aria-label={title}>
          <div className="add-task-head">{title}</div>
          <QuickAdd
            key={prefill}
            today={todayKst()}
            projects={projects}
            hint="날짜·@프로젝트·!우선순위를 고치고 Enter"
            initialText={prefill}
            autoFocus
            onAdd={add}
          />
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </span>
  );
}
