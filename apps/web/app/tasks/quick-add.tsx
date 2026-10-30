"use client";

import { formatDue, parseQuickAdd, PRIORITY_LABELS, REPEAT_LABELS, type Project } from "@toolhub/tasks/model";
import { forwardRef, useState } from "react";
import { Icon } from "../icons";

/**
 * 자연어 빠른 추가. 입력하는 동안 해석 결과(날짜·시간·우선순위·태그·프로젝트·반복)를 칩으로 보여준다.
 * hint: 보기에 따라 기본으로 붙는 값 (예: 오늘 보기 → 오늘 날짜)
 */
export const QuickAdd = forwardRef<
  HTMLInputElement,
  {
    today: string;
    projects: Project[];
    hint: string | null;
    onAdd: (text: string) => Promise<boolean>;
  }
>(function QuickAdd({ today, projects, hint, onAdd }, ref) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parsed = text.trim()
    ? parseQuickAdd(
        text,
        today,
        projects.map((p) => p.name),
      )
    : null;
  const projectExists = parsed?.projectName && projects.some((p) => p.name.toLowerCase() === parsed.projectName!.toLowerCase());

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    if (await onAdd(text)) setText("");
    setBusy(false);
  };

  return (
    <form className="quick-add" onSubmit={submit}>
      <div className="quick-add-input">
        <Icon name="plus" />
        <input
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && (e.currentTarget.blur(), setText(""))}
          placeholder="할 일 추가 — 예: 내일 오후 3시 글 발행 #블로그 @블로그운영 !높음 매주   (단축키 C)"
          aria-label="할 일 빠르게 추가"
        />
        {text.trim() && (
          <button type="submit" className="button primary small" disabled={busy}>
            추가
          </button>
        )}
      </div>
      {parsed ? (
        <div className="quick-add-preview">
          <span className="preview-title">{parsed.title || "제목 없음"}</span>
          {parsed.dueDate && <span className="chip">📅 {formatDue(parsed.dueDate, parsed.dueTime, today)}</span>}
          {parsed.repeat && <span className="chip">🔁 {REPEAT_LABELS[parsed.repeat]}</span>}
          {parsed.priority > 0 && <span className="chip">우선순위 {PRIORITY_LABELS[parsed.priority]}</span>}
          {parsed.projectName && (
            <span className="chip">
              @{parsed.projectName}
              {!projectExists && " (새 프로젝트)"}
            </span>
          )}
          {parsed.labels.map((l) => (
            <span key={l} className="chip">
              #{l}
            </span>
          ))}
          {!parsed.dueDate && hint && <span className="chip muted">{hint}</span>}
        </div>
      ) : (
        hint && <div className="quick-add-preview muted">{hint}</div>
      )}
    </form>
  );
});
