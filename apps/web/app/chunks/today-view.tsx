"use client";

import {
  autoGoalId,
  chunkCount,
  chunkGroupOf,
  emptyDay,
  mondayOf,
  monthSummary,
  NOTE_MAX,
  shiftDay,
  updateDay,
  updateGoal,
  weekdayOf,
  writeGoalToSlot,
  type ChunkSlot,
  type ChunkState,
} from "@toolhub/tasks/chunks";
import { useState } from "react";
import { Icon } from "../icons";
import { groupColor, type ChunkActions } from "./chunks-app";

/** 달력은 일요일 시작 */
const CALENDAR_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_PLACEHOLDERS: Record<ChunkSlot, string> = { 1: "한 일 한 줄 (예: 릴스 촬영+편집)", 2: "한 일 한 줄 (예: 원데이 클래스 3시간)" };

const dayOfWeek = (key: string) => CALENDAR_WEEKDAYS[(weekdayOf(key) + 1) % 7];
const longDate = (key: string) => `${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일 ${dayOfWeek(key)}요일`;

function shiftMonth(month: string, delta: number) {
  const d = new Date(`${month}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 7);
}

export function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function TodayView({ state, today, actions, onGoWeek }: { state: ChunkState; today: string; actions: ChunkActions; onGoWeek: () => void }) {
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(today.slice(0, 7));
  const rec = state.days[selected] ?? emptyDay();
  const count = chunkCount(rec);
  const isToday = selected === today;

  const monday = mondayOf(selected);
  const assigned = (state.weeks[monday] ?? []).filter((g) => g.d === weekdayOf(selected));
  const assignedDone = assigned.filter((g) => g.done).length;
  const fromThisDay = (goalId: string) => goalId === autoGoalId(selected, 1) || goalId === autoGoalId(selected, 2);

  const select = (key: string) => {
    setSelected(key);
    setMonth(key.slice(0, 7));
  };

  // 달력: 1일 앞은 빈칸, 오늘 뒤는 고를 수 없음
  const firstDay = `${month}-01`;
  const lastDate = Number(shiftDay(shiftMonth(month, 1) + "-01", -1).slice(8));
  const blanks = (weekdayOf(firstDay) + 1) % 7;
  const monthDays = Array.from({ length: lastDate }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
  const summary = monthSummary(state.days, month);
  const logged = monthDays.filter((k) => chunkCount(state.days[k]) > 0).reverse();

  return (
    <div className="chunk-today">
      <section aria-label="하루 기록">
        <div className="chunk-date">
          <h2>{longDate(selected)}</h2>
          <span className={isToday ? "chunk-is-today" : "muted"}>{isToday ? "오늘" : "지난 기록"}</span>
          {!isToday && (
            <button type="button" className="button chunk-small" onClick={() => select(today)}>
              오늘로
            </button>
          )}
        </div>

        <div className="chunk-blocks">
          {([1, 2] as const).map((slot) => {
            const done = rec[`b${slot}`];
            const group = rec[`g${slot}`];
            return (
              <div key={slot} className="chunk-block" style={groupColor(state, group)}>
                <button
                  type="button"
                  className={`chunk-check${done ? " on" : ""}`}
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`덩어리 ${slot} 완료`}
                  onClick={() => actions.commit((s) => updateDay(s, selected, { [`b${slot}`]: !done }, slot))}
                >
                  <CheckMark />
                </button>
                <div>
                  <label htmlFor={`chunk-note-${slot}`}>덩어리 {slot}</label>
                  <input
                    id={`chunk-note-${slot}`}
                    type="text"
                    maxLength={NOTE_MAX}
                    autoComplete="off"
                    placeholder={SLOT_PLACEHOLDERS[slot]}
                    value={rec[`n${slot}`]}
                    onChange={(e) => actions.editDay(selected, { [`n${slot}`]: e.target.value })}
                    onBlur={() => actions.flush(selected)}
                  />
                  <div className="chunk-pills" role="group" aria-label={`덩어리 ${slot} 그룹`}>
                    {state.groups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        className={`chunk-pill${g.id === group ? " on" : ""}`}
                        style={groupColor(state, g.id)}
                        aria-pressed={g.id === group}
                        onClick={() => actions.commit((s) => updateDay(s, selected, { [`g${slot}`]: g.id === group ? "" : g.id }))}
                      >
                        <i />
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className={`chunk-verdict${count === 2 ? " full" : ""}`} aria-live="polite">
          {count === 2
            ? "2덩어리. 목표를 채웠어요."
            : count === 1
              ? "1덩어리. 일한 날이에요."
              : isToday
                ? "아직 비어 있어요. 하나만 해도 일한 날이에요."
                : "이 날은 비어 있어요."}
        </p>
        <p className="chunk-hint">한 덩어리 = 3~4시간, 한 가지 일에 집중한 것.</p>
      </section>

      <section aria-label="이 날에 배정된 목표">
        <h2>
          배정된 목표 {assigned.length > 0 && <small>{`${assignedDone}/${assigned.length} 완료`}</small>}
        </h2>
        {assigned.length ? (
          <ul className="chunk-assigned">
            {assigned.map((g) => {
              const group = chunkGroupOf(state, g.g);
              return (
                <li key={g.id} className={g.done ? "done" : undefined}>
                  <button
                    type="button"
                    className={`chunk-tick${g.done ? " on" : ""}`}
                    role="checkbox"
                    aria-checked={g.done}
                    aria-label="목표 완료"
                    onClick={() => actions.commit((s) => updateGoal(s, monday, g.id, { done: !g.done }))}
                  >
                    <CheckMark />
                  </button>
                  <div>
                    <span className="chunk-tag" style={groupColor(state, group.id)}>
                      <i />
                      {group.name}
                    </span>
                    <span className="chunk-title">{g.t}</span>
                    {/* 이 날 덩어리에서 생긴 카드는 이미 적혀 있으므로 적기 버튼을 숨긴다 */}
                    {fromThisDay(g.id) ? (
                      <p className="chunk-hint">이 날 덩어리 {g.id.slice(-1)}에서 생긴 카드</p>
                    ) : (
                      <div className="chunk-assign-actions">
                        {([1, 2] as const).map((slot) => (
                          <button key={slot} type="button" className="chip" onClick={() => actions.commit((s) => writeGoalToSlot(s, selected, slot, g))}>
                            덩어리 {slot}에 적기
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted chunk-note">
            이 날에 배정된 목표가 없어요.{" "}
            <button type="button" className="chunk-link" onClick={onGoWeek}>
              주간 보드
            </button>
            에서 요일 칸에 놓으면 여기에 떠요.
          </p>
        )}
      </section>

      <section aria-label="월간 기록">
        <div className="chunk-monthbar">
          <button type="button" className="icon-button" aria-label="이전 달" onClick={() => setMonth(shiftMonth(month, -1))}>
            <Icon name="chevronLeft" size={14} />
          </button>
          <h2>
            {month.slice(0, 4)}년 {Number(month.slice(5))}월
          </h2>
          <button type="button" className="icon-button" aria-label="다음 달" disabled={month >= today.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>
            <Icon name="chevronRight" size={14} />
          </button>
        </div>
        <div className="chunk-total">
          <span className="chunk-total-num">{summary.total}</span> 덩어리
          <small>
            일한 날 {summary.worked}일 · 2덩어리 {summary.full}일
          </small>
        </div>
        <div className="chunk-calendar" role="group" aria-label="날짜별 덩어리">
          {CALENDAR_WEEKDAYS.map((w) => (
            <span key={w} className="chunk-dow" aria-hidden="true">
              {w}
            </span>
          ))}
          {Array.from({ length: blanks }, (_, i) => (
            <span key={`blank-${i}`} />
          ))}
          {monthDays.map((key) => {
            const day = state.days[key];
            const future = key > today;
            return (
              <button
                key={key}
                type="button"
                className={`chunk-cell${key === selected ? " selected" : ""}${key === today ? " today" : ""}`}
                disabled={future}
                aria-pressed={key === selected}
                aria-current={key === today ? "date" : undefined}
                aria-label={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일, ${chunkCount(day)}덩어리`}
                onClick={() => setSelected(key)}
              >
                <span className="chunk-cell-date">{Number(key.slice(8))}</span>
                <span className="chunk-bars">
                  {([1, 2] as const).map((slot) => (
                    <i key={slot} className={day?.[`b${slot}`] ? "on" : undefined} style={groupColor(state, day?.[`g${slot}`] ?? "")} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-label="한 일 목록">
        <h2>{Number(month.slice(5))}월에 한 일</h2>
        {logged.length ? (
          <ul className="chunk-log">
            {logged.map((key) => {
              const day = state.days[key]!;
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(key);
                      window.scrollTo(0, 0);
                    }}
                  >
                    <span className="chunk-when">
                      {Number(key.slice(5, 7))}/{Number(key.slice(8))} ({dayOfWeek(key)})
                    </span>
                    <span className="chunk-lines">
                      {([1, 2] as const)
                        .filter((slot) => day[`b${slot}`])
                        .map((slot) => (
                          <span key={slot}>
                            <b style={groupColor(state, day[`g${slot}`])}>덩어리 {slot}</b> {day[`n${slot}`] || <span className="muted">메모 없음</span>}
                          </span>
                        ))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted chunk-note">아직 체크한 날이 없어요. 오늘 첫 칸부터 채우면 여기에 쌓여요.</p>
        )}
      </section>
    </div>
  );
}
