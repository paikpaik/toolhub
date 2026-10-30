"use client";

import { STATUS_LABELS, type Project, type Status, type Task } from "@toolhub/tasks/model";
import { useState } from "react";
import { DueBadge, LabelChips, PriorityIcon, ProjectChip, STATUS_ORDER, StatusCircle } from "./ui";

/** 완료·취소 칸은 최근 것만 */
const CLOSED_LIMIT = 20;

/** Linear식 상태별 보드. 카드를 다른 칸으로 끌어 놓으면 상태가 바뀐다 */
export function BoardView({
  tasks,
  projects,
  today,
  selectedId,
  onSelect,
  onMove,
}: {
  tasks: Task[];
  projects: Project[];
  today: string;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onMove: (id: number, status: Status) => void;
}) {
  const [over, setOver] = useState<Status | null>(null);
  const projectOf = (t: Task) => projects.find((p) => p.id === t.projectId);

  return (
    <div className="board">
      {STATUS_ORDER.map((status) => {
        const column = tasks.filter((t) => t.status === status);
        const shown = status === "done" || status === "canceled" ? column.slice(0, CLOSED_LIMIT) : column;
        return (
          <section
            key={status}
            className={`board-column${over === status ? " over" : ""}`}
            onDragOver={(e) => (e.preventDefault(), setOver(status))}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              setOver(null);
              const id = Number(e.dataTransfer.getData("text/task-id"));
              if (id) onMove(id, status);
            }}
          >
            <header>
              <StatusCircle task={{ status, priority: 0 } as Task} />
              {STATUS_LABELS[status]}
              <span className="side-count">{column.length}</span>
            </header>
            <div className="board-cards">
              {shown.map((t) => (
                <article
                  key={t.id}
                  className={`board-card${selectedId === t.id ? " selected" : ""}`}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(t.id))}
                  onClick={() => onSelect(t.id)}
                >
                  <div className="board-card-top">
                    <span className="task-id">#{t.id}</span>
                    <PriorityIcon priority={t.priority} />
                  </div>
                  <div className="board-card-title">{t.title}</div>
                  <div className="task-meta">
                    <LabelChips labels={t.labels} />
                    <ProjectChip project={projectOf(t)} />
                    <DueBadge task={t} today={today} />
                  </div>
                </article>
              ))}
              {column.length > shown.length && <p className="side-empty">외 {column.length - shown.length}개</p>}
              {column.length === 0 && <p className="board-empty">여기로 끌어다 놓기</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}
