"use client";

import {
  filterTasks,
  formatDue,
  GROUP_LABELS,
  groupOf,
  isOpen,
  VIEW_LABELS,
  type GroupKey,
  type Project,
  type Status,
  type Task,
  type TaskPatch,
  type View,
} from "@toolhub/tasks/model";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../icons";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { QuickAdd } from "./quick-add";
import { TaskDetail } from "./task-detail";
import { TaskRow } from "./task-row";

const GROUP_ORDER: GroupKey[] = ["overdue", "today", "tomorrow", "week", "later", "nodate"];
/** 다른 곳(Claude 데스크톱 앱의 MCP 등)에서 바꾼 내용을 반영하는 주기 */
const REFRESH_MS = 15_000;

async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data as T;
}

export function TaskApp({
  initialTasks,
  projects,
  today,
  view,
  projectId,
  label,
  initialSelectedId,
}: {
  initialTasks: Task[];
  projects: Project[];
  today: string;
  view: View;
  projectId: string | null;
  label: string | null;
  /** 주소의 ?task=12 — 그 할 일의 상세를 열어 둔 채로 시작 */
  initialSelectedId: number | null;
}) {
  const router = useRouter();
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId);
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const quickAddRef = useRef<HTMLInputElement>(null);

  // 서버에서 새로 받은 목록으로 맞춘다 (저장 후 새로고침, 주기적 새로고침)
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  // 다른 곳에서 바꾼 내용 반영: 창으로 돌아올 때 + 주기적으로
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && router.refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [router]);

  // 단축키: C 새 할 일, Esc 상세 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && e.target.closest("input, textarea, select, [contenteditable]");
      if (e.key === "Escape") setSelectedId(null);
      if (!typing && !e.metaKey && !e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "ㅊ")) {
        e.preventDefault();
        quickAddRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const project = projects.find((p) => p.id === projectId);
  const filter = projectId ? { projectId } : label ? { label } : {};
  const scoped = useMemo(() => filterTasks(tasks, { view: "board", ...filter }, today), [tasks, projectId, label, today]); // eslint-disable-line react-hooks/exhaustive-deps

  // 보기마다 새 할 일에 기본으로 붙일 값
  const defaults: TaskPatch = {
    ...(projectId ? { projectId } : {}),
    ...(label ? { labels: [label] } : {}),
    ...(view === "today" ? { dueDate: today } : {}),
    ...(view === "calendar" && pickedDate ? { dueDate: pickedDate } : {}),
  };
  const hint =
    defaults.dueDate && view === "calendar"
      ? `날짜를 안 쓰면 ${formatDue(defaults.dueDate, null, today)}에 추가`
      : view === "today"
        ? "날짜를 안 쓰면 오늘로 추가"
        : project
          ? `${project.name} 프로젝트에 추가`
          : label
            ? `#${label} 태그로 추가`
            : null;

  const add = async (text: string) => {
    try {
      const created = await api<Task>("/api/tasks", "POST", { text, defaults });
      setTasks((prev) => [...prev, created]);
      router.refresh();
      return true;
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  const update = useCallback(
    async (id: number, patch: TaskPatch) => {
      // 먼저 화면에 반영하고, 실패하면 서버 상태로 되돌린다
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
      try {
        const { task, next } = await api<{ task: Task; next: Task | null }>(`/api/tasks/${id}`, "PATCH", patch);
        setTasks((prev) => [...prev.map((t) => (t.id === id ? task : t)), ...(next ? [next] : [])]);
        if (next) notify(`반복 할 일 — 다음 회차를 ${formatDue(next.dueDate!, next.dueTime, today)}에 만들었어요`);
        router.refresh();
      } catch (e) {
        notify(e instanceof Error ? e.message : String(e));
        router.refresh();
      }
    },
    [router, today],
  );

  const remove = async (id: number) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setSelectedId(null);
    try {
      await api(`/api/tasks/${id}`, "DELETE");
      router.refresh();
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e));
      router.refresh();
    }
  };

  const toggle = (t: Task) => update(t.id, { status: t.status === "done" ? "todo" : "done" });

  const deleteProject = async () => {
    if (!project || !confirm(`"${project.name}" 프로젝트를 삭제할까요? 할 일은 지워지지 않고 프로젝트 없음으로 옮겨집니다.`)) return;
    await api(`/api/projects/${project.id}`, "DELETE");
    router.push("/tasks?view=all");
    router.refresh();
  };

  const renameProject = async () => {
    const name = project && prompt("프로젝트 이름", project.name);
    if (!project || !name?.trim()) return;
    await api(`/api/projects/${project.id}`, "PATCH", { name });
    router.refresh();
  };

  const selected = tasks.find((t) => t.id === selectedId) ?? null;
  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId);

  // ── 목록 보기 ──
  const listView = view !== "board" && view !== "calendar";
  const listed = listView ? filterTasks(tasks, { view: projectId || label ? "all" : view, ...filter }, today) : [];
  const closedInScope = projectId || label ? scoped.filter((t) => !isOpen(t)) : [];
  const groups =
    view === "done" || view === "inbox"
      ? [{ key: null, items: listed }]
      : GROUP_ORDER.map((key) => ({ key, items: listed.filter((t) => groupOf(t, today) === key) })).filter((g) => g.items.length);

  const title = project ? project.name : label ? `#${label}` : VIEW_LABELS[view];
  // 제목 옆 개수: 목록 보기는 지금 보이는 할 일 수, 보드·캘린더는 범위 안의 남은 할 일 수
  const countLabel = listView ? `${listed.length}개` : `남은 할 일 ${scoped.filter(isOpen).length}개`;

  const renderRow = (t: Task) => (
    <TaskRow
      key={t.id}
      task={t}
      project={projectOf(t)}
      today={today}
      selected={t.id === selectedId}
      showProject={!projectId}
      onSelect={() => setSelectedId(t.id === selectedId ? null : t.id)}
      onToggle={() => toggle(t)}
    />
  );

  return (
    <div className={`tasks-shell${selected ? " with-detail" : ""}`}>
      <div className="tasks-main">
        <header className="tasks-header">
          <h1>
            {project && <span className="project-dot large" style={{ background: project.color }} />}
            {title}
            <small>{countLabel}</small>
          </h1>
          {project && (
            <div className="tasks-header-actions">
              <button type="button" className="button small" onClick={renameProject}>
                이름 바꾸기
              </button>
              <button type="button" className="button small" onClick={deleteProject}>
                삭제
              </button>
            </div>
          )}
        </header>

        {view !== "done" && <QuickAdd ref={quickAddRef} today={today} projects={projects} hint={hint} onAdd={add} />}

        {view === "board" && (
          <BoardView tasks={scoped} projects={projects} today={today} selectedId={selectedId} onSelect={setSelectedId} onMove={(id, status: Status) => update(id, { status })} />
        )}

        {view === "calendar" && (
          <CalendarView
            tasks={scoped}
            projects={projects}
            today={today}
            selectedDate={pickedDate}
            onPickDate={(date) => {
              setPickedDate(date);
              quickAddRef.current?.focus();
            }}
            onSelect={setSelectedId}
            onMoveDate={(id, dueDate) => update(id, { dueDate })}
          />
        )}

        {listView && (
          <div className="task-list">
            {listed.length === 0 && (
              <div className="empty-state">
                <Icon name={view === "done" ? "done" : "today"} size={28} />
                <p>{view === "done" ? "완료한 할 일이 없습니다." : view === "today" ? "오늘 할 일을 모두 끝냈어요." : "할 일이 없습니다."}</p>
                {view !== "done" && <p className="muted">위 입력창에 바로 적거나 C 키를 눌러 추가하세요.</p>}
              </div>
            )}
            {groups.map((g) => (
              <section key={g.key ?? "all"} className="task-group">
                {g.key && (
                  <h2 className={`group-title${g.key === "overdue" ? " overdue" : ""}`}>
                    {GROUP_LABELS[g.key]} <span className="side-count">{g.items.length}</span>
                  </h2>
                )}
                {g.items.map(renderRow)}
              </section>
            ))}
            {closedInScope.length > 0 && (
              <section className="task-group">
                <button type="button" className="group-toggle" onClick={() => setShowDone(!showDone)}>
                  {showDone ? "▾" : "▸"} 완료·취소 {closedInScope.length}개
                </button>
                {showDone && closedInScope.map(renderRow)}
              </section>
            )}
          </div>
        )}
      </div>

      {selected && (
        <TaskDetail
          key={selected.id}
          task={selected}
          projects={projects}
          onUpdate={(patch) => update(selected.id, patch)}
          onDelete={() => remove(selected.id)}
          onClose={() => setSelectedId(null)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
