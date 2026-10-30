"use client";

import { addDays, isOpen, weekday, type Project, type Task } from "@toolhub/tasks/model";
import { useState } from "react";
import { Icon } from "../icons";
import { priorityColor } from "./ui";

const WEEK_HEADER = ["월", "화", "수", "목", "금", "토", "일"];
const MAX_CHIPS = 3;

/** 월요일 시작 6주 달력 */
function monthGrid(month: string) {
  const first = `${month}-01`;
  const start = addDays(first, -((weekday(first) + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

/** TickTick식 월간 캘린더. 날짜를 누르면 그 날짜로 추가, 할 일을 다른 날짜로 끌면 마감일이 바뀐다 */
export function CalendarView({
  tasks,
  projects,
  today,
  selectedDate,
  onPickDate,
  onSelect,
  onMoveDate,
}: {
  tasks: Task[];
  projects: Project[];
  today: string;
  selectedDate: string | null;
  onPickDate: (date: string) => void;
  onSelect: (id: number) => void;
  onMoveDate: (id: number, date: string) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [over, setOver] = useState<string | null>(null);
  const days = monthGrid(month);
  const byDate = new Map<string, Task[]>();
  for (const t of tasks) if (t.dueDate) byDate.set(t.dueDate, [...(byDate.get(t.dueDate) ?? []), t]);

  return (
    <div className="calendar">
      <div className="calendar-nav">
        <button type="button" className="icon-button ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
          <Icon name="chevronLeft" />
        </button>
        <strong>
          {month.slice(0, 4)}년 {Number(month.slice(5))}월
        </strong>
        <button type="button" className="icon-button ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">
          <Icon name="chevronRight" />
        </button>
        {month !== today.slice(0, 7) && (
          <button type="button" className="button small" onClick={() => setMonth(today.slice(0, 7))}>
            오늘
          </button>
        )}
      </div>
      <div className="calendar-grid">
        {WEEK_HEADER.map((d, i) => (
          <div key={d} className={`calendar-head${i >= 5 ? " weekend" : ""}`}>
            {d}
          </div>
        ))}
        {days.map((date) => {
          const items = (byDate.get(date) ?? []).sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99"));
          const classes = [
            "calendar-cell",
            date.slice(0, 7) !== month && "other-month",
            date === today && "is-today",
            date === selectedDate && "picked",
            over === date && "over",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={date}
              className={classes}
              onClick={() => onPickDate(date)}
              onDragOver={(e) => (e.preventDefault(), setOver(date))}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                setOver(null);
                const id = Number(e.dataTransfer.getData("text/task-id"));
                if (id) onMoveDate(id, date);
              }}
            >
              <span className="calendar-date">{Number(date.slice(8))}</span>
              {items.slice(0, MAX_CHIPS).map((t) => {
                const project = projects.find((p) => p.id === t.projectId);
                return (
                  <button
                    key={t.id}
                    type="button"
                    className={`calendar-chip${isOpen(t) ? "" : " closed"}`}
                    style={{ borderLeftColor: project?.color ?? priorityColor(t.priority) }}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/task-id", String(t.id))}
                    onClick={(e) => (e.stopPropagation(), onSelect(t.id))}
                    title={t.title}
                  >
                    {t.dueTime && <span className="chip-time">{t.dueTime}</span>}
                    {t.title}
                  </button>
                );
              })}
              {items.length > MAX_CHIPS && <span className="calendar-more">+{items.length - MAX_CHIPS}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
