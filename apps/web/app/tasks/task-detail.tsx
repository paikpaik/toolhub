"use client";

import {
  PRIORITIES,
  PRIORITY_LABELS,
  REPEAT_LABELS,
  REPEATS,
  STATUS_LABELS,
  type Priority,
  type Project,
  type Repeat,
  type Status,
  type Subtask,
  type Task,
  type TaskPatch,
} from "@toolhub/tasks/model";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { PriorityIcon, STATUS_ORDER, StatusCircle } from "./ui";

/** 오른쪽 상세 패널. 제목·메모·태그는 입력을 마치면(blur) 저장하고, 선택 항목은 바꾸는 즉시 저장한다 */
export function TaskDetail({
  task,
  projects,
  onUpdate,
  onDelete,
  onClose,
}: {
  task: Task;
  projects: Project[];
  onUpdate: (patch: TaskPatch) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  // 다른 할 일을 열 때만 입력값을 다시 채운다 (주기적 새로고침이 작성 중인 내용을 덮어쓰지 않게)
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes);
  const [labels, setLabels] = useState(task.labels.join(", "));
  const [newSubtask, setNewSubtask] = useState("");
  useEffect(() => {
    setTitle(task.title);
    setNotes(task.notes);
    setLabels(task.labels.join(", "));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const saveTitle = () => title.trim() && title !== task.title && onUpdate({ title });
  const saveNotes = () => notes !== task.notes && onUpdate({ notes });
  const saveLabels = () => {
    const next = [...new Set(labels.split(/[,\s]+/).map((l) => l.replace(/^#/, "").trim()).filter(Boolean))];
    if (next.join(",") !== task.labels.join(",")) onUpdate({ labels: next });
  };
  const setSubtasks = (subtasks: Subtask[]) => onUpdate({ subtasks });

  const addSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtask.trim()) return;
    setSubtasks([...task.subtasks, { id: crypto.randomUUID().slice(0, 8), text: newSubtask.trim(), done: false }]);
    setNewSubtask("");
  };

  return (
    <aside className="task-detail" aria-label={`#${task.id} 상세`}>
      <div className="detail-head">
        <span className="task-id">#{task.id}</span>
        <div className="detail-head-actions">
          <button
            type="button"
            className="icon-button ghost"
            title="삭제"
            aria-label="삭제"
            onClick={() => confirm(`"${task.title}"을(를) 삭제할까요?`) && onDelete()}
          >
            <Icon name="trash" />
          </button>
          <button type="button" className="icon-button ghost" title="닫기 (Esc)" aria-label="닫기" onClick={onClose}>
            <Icon name="close" />
          </button>
        </div>
      </div>

      <div className="detail-title">
        <StatusCircle task={task} onToggle={() => onUpdate({ status: task.status === "done" ? "todo" : "done" })} />
        <textarea
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, " "))}
          onBlur={saveTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
          aria-label="제목"
        />
      </div>

      <div className="detail-props">
        <label>
          <span>상태</span>
          <select value={task.status} onChange={(e) => onUpdate({ status: e.target.value as Status })}>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>우선순위</span>
          <span className="prop-with-icon">
            <PriorityIcon priority={task.priority} />
            <select value={task.priority} onChange={(e) => onUpdate({ priority: Number(e.target.value) as Priority })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </span>
        </label>
        <label>
          <span>마감일</span>
          <span className="prop-row">
            <input type="date" value={task.dueDate ?? ""} onChange={(e) => onUpdate({ dueDate: e.target.value || null, ...(e.target.value ? {} : { dueTime: null, repeat: null }) })} />
            <input
              type="time"
              value={task.dueTime ?? ""}
              disabled={!task.dueDate}
              onChange={(e) => onUpdate({ dueTime: e.target.value || null })}
              aria-label="시간"
            />
          </span>
        </label>
        <label>
          <span>반복</span>
          <select
            value={task.repeat ?? ""}
            disabled={!task.dueDate}
            title={task.dueDate ? undefined : "마감일을 정하면 반복을 설정할 수 있어요"}
            onChange={(e) => onUpdate({ repeat: (e.target.value || null) as Repeat | null })}
          >
            <option value="">반복 안 함</option>
            {REPEATS.map((r) => (
              <option key={r} value={r}>
                {REPEAT_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>프로젝트</span>
          <select value={task.projectId ?? ""} onChange={(e) => onUpdate({ projectId: e.target.value || null })}>
            <option value="">없음</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>태그</span>
          <input value={labels} onChange={(e) => setLabels(e.target.value)} onBlur={saveLabels} placeholder="쉼표로 구분" />
        </label>
        <label>
          <span>링크</span>
          <span className="prop-row">
            <input
              defaultValue={task.link ?? ""}
              key={`${task.id}-link`}
              onBlur={(e) => e.target.value.trim() !== (task.link ?? "") && onUpdate({ link: e.target.value })}
              placeholder="초안·키워드 분석 주소 등"
            />
            {task.link && (
              <a className="icon-button ghost" href={task.link} target={task.link.startsWith("/") ? undefined : "_blank"} rel="noreferrer" title="열기">
                <Icon name="link" />
              </a>
            )}
          </span>
        </label>
      </div>

      <section className="detail-section">
        <h3>
          하위 할 일{" "}
          {task.subtasks.length > 0 && (
            <small>
              {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </small>
          )}
        </h3>
        <ul className="subtasks">
          {task.subtasks.map((s) => (
            <li key={s.id} className={s.done ? "done" : undefined}>
              <input
                type="checkbox"
                checked={s.done}
                onChange={() => setSubtasks(task.subtasks.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                aria-label={s.text}
              />
              <span>{s.text}</span>
              <button type="button" className="icon-button ghost small" aria-label="삭제" onClick={() => setSubtasks(task.subtasks.filter((x) => x.id !== s.id))}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={addSubtask} className="subtask-add">
          <input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="+ 하위 할 일 추가" />
        </form>
      </section>

      <section className="detail-section">
        <h3>메모</h3>
        <textarea className="notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} placeholder="자세한 내용, 참고 링크 등" rows={6} />
      </section>

      <p className="detail-foot">
        만든 날 {new Date(task.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}
        {task.completedAt && ` · 완료 ${new Date(task.completedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}`}
      </p>
    </aside>
  );
}
