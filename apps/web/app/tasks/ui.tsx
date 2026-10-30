"use client";

import { formatDue, PRIORITY_LABELS, STATUS_LABELS, type Priority, type Project, type Status, type Task } from "@toolhub/tasks/model";
import { Icon } from "../icons";

export const priorityColor = (p: Priority) => `var(--p${p})`;

/** Linear식 상태 원: 할 일(빈 원), 진행 중(반 원), 완료(체크), 취소(가위표). 테두리 색은 우선순위 */
export function StatusCircle({ task, onToggle }: { task: Task; onToggle?: () => void }) {
  const color = task.status === "done" ? "var(--accent)" : task.status === "canceled" ? "var(--faint)" : priorityColor(task.priority);
  const icon = (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      {task.status === "done" ? (
        <>
          <circle cx="8" cy="8" r="7" fill={color} />
          <path d="m5 8.2 2 2 4-4.3" stroke="var(--surface)" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : task.status === "canceled" ? (
        <>
          <circle cx="8" cy="8" r="6.3" stroke={color} strokeWidth="1.4" fill="none" />
          <path d="m5.8 5.8 4.4 4.4m0-4.4-4.4 4.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="8" cy="8" r="6.3" stroke={color} strokeWidth="1.5" fill="none" />
          {task.status === "in_progress" && <path d="M8 3.5a4.5 4.5 0 0 1 0 9z" fill={color} />}
        </>
      )}
    </svg>
  );
  if (!onToggle) return icon;
  return (
    <button
      type="button"
      className="status-circle"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={task.status === "done" ? "완료 취소" : "완료로 표시"}
      title={`${STATUS_LABELS[task.status]} · 눌러서 ${task.status === "done" ? "되돌리기" : "완료"}`}
    >
      {icon}
    </button>
  );
}

/** Linear식 우선순위 막대 (긴급은 느낌표 상자) */
export function PriorityIcon({ priority }: { priority: Priority }) {
  if (priority === 0) return null;
  const color = priorityColor(priority);
  return (
    <span className="priority-icon" title={`우선순위 ${PRIORITY_LABELS[priority]}`}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        {priority === 1 ? (
          <>
            <rect x="1" y="1" width="12" height="12" rx="3" fill={color} />
            <path d="M7 3.8v4M7 10.2v.1" stroke="var(--surface)" strokeWidth="1.8" strokeLinecap="round" />
          </>
        ) : (
          [0, 1, 2].map((i) => (
            <rect key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={3.5 + i * 3} rx="1" fill={i < 5 - priority ? color : "var(--border)"} />
          ))
        )}
      </svg>
    </span>
  );
}

export function DueBadge({ task, today }: { task: Task; today: string }) {
  if (!task.dueDate) return null;
  const overdue = task.status !== "done" && task.status !== "canceled" && task.dueDate < today;
  const isToday = task.dueDate === today;
  return (
    <span className={`due${overdue ? " overdue" : isToday ? " today" : ""}`}>
      {task.repeat && <Icon name="repeat" size={12} />}
      {formatDue(task.dueDate, task.dueTime, today)}
    </span>
  );
}

export function ProjectChip({ project }: { project: Project | undefined }) {
  if (!project) return null;
  return (
    <span className="chip project-chip">
      <span className="project-dot small" style={{ background: project.color }} />
      {project.name}
    </span>
  );
}

export function LabelChips({ labels }: { labels: string[] }) {
  return (
    <>
      {labels.map((l) => (
        <span key={l} className="chip">
          #{l}
        </span>
      ))}
    </>
  );
}

export const STATUS_ORDER: Status[] = ["todo", "in_progress", "done", "canceled"];
