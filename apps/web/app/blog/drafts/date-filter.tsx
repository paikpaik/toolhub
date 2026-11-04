"use client";

import { monthGrid, shiftMonth, WEEKDAY_NAMES, weekday } from "@toolhub/tasks/model";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../../icons";

const WEEK_HEADER = ["월", "화", "수", "목", "금", "토", "일"];

/** 2026-11-03 → 11월 3일(화) */
export const dateLabel = (date: string) => `${Number(date.slice(5, 7))}월 ${Number(date.slice(8))}일(${WEEKDAY_NAMES[weekday(date)]})`;

/**
 * 작성일 고르기: 버튼을 누르면 달력이 열리고, 초안이 있는 날에는 개수가 보인다. 날을 누르면 그날 초안만 보인다.
 * counts는 지금 상태 탭으로 거른 초안 기준이라, 상태와 함께 걸러 볼 수 있다
 */
export function DateFilter({ counts, value, onChange }: { counts: Map<string, number>; value: string | null; onChange: (date: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const latest = [...counts.keys()].sort().at(-1);
  const [month, setMonth] = useState((value ?? latest ?? new Date().toISOString()).slice(0, 7));
  const ref = useRef<HTMLDivElement>(null);

  // 바깥을 누르거나 Esc면 닫는다
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const toggle = () => {
    // 열 때는 고른 날(없으면 가장 최근 초안)의 달부터
    if (!open) setMonth((value ?? latest ?? month).slice(0, 7));
    setOpen(!open);
  };
  const pick = (date: string | null) => {
    onChange(date);
    setOpen(false);
  };
  const monthTotal = [...counts].filter(([d]) => d.startsWith(month)).reduce((sum, [, n]) => sum + n, 0);

  return (
    <div className="date-filter" ref={ref}>
      <button type="button" className={`date-filter-button${value ? " on" : ""}`} onClick={toggle} aria-expanded={open}>
        <Icon name="calendar" size={14} />
        작성일 {value ? dateLabel(value) : "전체"}
      </button>
      {value && (
        <button type="button" className="date-filter-clear" onClick={() => pick(null)} aria-label="작성일 거르기 풀기" title="전체 기간">
          <Icon name="close" size={12} />
        </button>
      )}
      {open && (
        <div className="date-filter-popover" role="dialog" aria-label="작성일 고르기">
          <div className="calendar-nav">
            <button type="button" className="icon-button ghost" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달">
              <Icon name="chevronLeft" />
            </button>
            <strong>
              {month.slice(0, 4)}년 {Number(month.slice(5))}월 <small>{monthTotal}개</small>
            </strong>
            <button type="button" className="icon-button ghost" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달">
              <Icon name="chevronRight" />
            </button>
          </div>
          <div className="mini-calendar">
            {WEEK_HEADER.map((w) => (
              <span key={w} className="mini-weekday">
                {w}
              </span>
            ))}
            {monthGrid(month).map((date) => {
              const count = counts.get(date) ?? 0;
              const classes = ["mini-day", date.startsWith(month) ? "" : "outside", count ? "has" : "", date === value ? "selected" : ""].filter(Boolean).join(" ");
              return (
                <button key={date} type="button" className={classes} disabled={!count} onClick={() => pick(date)} title={count ? `${dateLabel(date)} · ${count}개` : undefined}>
                  {Number(date.slice(8))}
                  {count > 0 && <small>{count}</small>}
                </button>
              );
            })}
          </div>
          <button type="button" className="button small" onClick={() => pick(null)}>
            전체 기간
          </button>
        </div>
      )}
    </div>
  );
}
