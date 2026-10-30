"use client";

import type { Project, Task } from "@toolhub/tasks/model";
import { Icon } from "../icons";
import { DueBadge, LabelChips, PriorityIcon, ProjectChip, StatusCircle } from "./ui";

export function TaskRow({
  task,
  project,
  today,
  selected,
  showProject,
  onSelect,
  onToggle,
}: {
  task: Task;
  project: Project | undefined;
  today: string;
  selected: boolean;
  showProject: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const subDone = task.subtasks.filter((s) => s.done).length;
  const closed = task.status === "done" || task.status === "canceled";
  return (
    <div
      role="button"
      tabIndex={0}
      className={`task-row${selected ? " selected" : ""}${closed ? " closed" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect())}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(task.id))}
    >
      <StatusCircle task={task} onToggle={onToggle} />
      <span className="task-id">#{task.id}</span>
      <PriorityIcon priority={task.priority} />
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {task.subtasks.length > 0 && (
          <span className="chip muted" title="하위 할 일">
            <Icon name="checklist" size={12} /> {subDone}/{task.subtasks.length}
          </span>
        )}
        {task.notes && <span className="note-dot" title="메모 있음" />}
        {task.link && <Icon name="link" size={13} className="faint" />}
        <LabelChips labels={task.labels} />
        {showProject && <ProjectChip project={project} />}
        <DueBadge task={task} today={today} />
      </span>
    </div>
  );
}
