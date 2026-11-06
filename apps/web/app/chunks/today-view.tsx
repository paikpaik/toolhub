"use client";

import {
  autoGoalId,
  chunkCount,
  addChunk,
  BASE_CHUNKS,
  chunkGroupOf,
  dayChunks,
  DAY_END_MAX,
  MAX_CHUNKS,
  mondayOf,
  monthSummary,
  NOTE_MAX,
  setDayEnd,
  removeChunk,
  shiftDay,
  TIME_MAX,
  updateChunk,
  updateGoal,
  weekdayOf,
  writeGoalToSlot,
  type ChunkState,
} from "@toolhub/tasks/chunks";
import { useState } from "react";
import { Icon } from "../icons";
import { groupColor, type ChunkActions } from "./chunks-app";

/** 달력은 일요일 시작 */
const CALENDAR_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const SLOT_PLACEHOLDERS = ["한 일 한 줄 (예: 릴스 촬영+편집)", "한 일 한 줄 (예: 원데이 클래스 3시간)"];

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
  const chunks = dayChunks(state.days[selected]);
  const slots = chunks.map((_, i) => i + 1);
  const isToday = selected === today;

  const monday = mondayOf(selected);
  const assigned = (state.weeks[monday] ?? []).filter((g) => g.d === weekdayOf(selected));
  const assignedDone = assigned.filter((g) => g.done).length;
  /** 이 날 몇 번 덩어리에서 생긴 카드인지 (아니면 0) */
  const fromSlot = (goalId: string) => slots.find((slot) => goalId === autoGoalId(selected, slot)) ?? 0;

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
      <div className="chunk-date">
        <h2>{longDate(selected)}</h2>
        <span className={isToday ? "chunk-is-today" : "muted"}>{isToday ? "오늘" : "지난 기록"}</span>
        {!isToday && (
          <button type="button" className="button chunk-small" onClick={() => select(today)}>
            오늘로
          </button>
        )}
        <label className="chunk-day-end" title="이 시각 전까지 적은 기록은 전날로 들어가요. 늦게 자는 날이 많으면 늦춰 두세요.">
          하루 끝
          <select value={state.dayEnd} onChange={(e) => actions.commit((s) => setDayEnd(s, Number(e.target.value)))}>
            {Array.from({ length: DAY_END_MAX + 1 }, (_, hour) => (
              <option key={hour} value={hour}>
                {hour === 0 ? "자정" : `새벽 ${hour}시`}
              </option>
            ))}
          </select>
        </label>
      </div>

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
                    {fromSlot(g.id) ? (
                      <p className="chunk-hint">이 날 덩어리 {fromSlot(g.id)}에서 생긴 카드</p>
                    ) : (
                      <div className="chunk-assign-actions">
                        {slots.map((slot) => (
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

      <section aria-label="하루 기록">
        <h2>덩어리</h2>
        <div className="chunk-blocks">
          {chunks.map(({ done, note, group, time }, i) => {
            const slot = i + 1;
            return (
              <div key={slot} className="chunk-block" style={groupColor(state, group)}>
                {slot > BASE_CHUNKS && (
                  <button
                    type="button"
                    className="chunk-remove"
                    aria-label={`덩어리 ${slot} 지우기`}
                    title="이 칸 지우기"
                    onClick={() => actions.commit((s) => removeChunk(s, selected, slot))}
                  >
                    <Icon name="close" size={12} />
                  </button>
                )}
                <button
                  type="button"
                  className={`chunk-check${done ? " on" : ""}`}
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`덩어리 ${slot} 완료`}
                  onClick={() => actions.commit((s) => updateChunk(s, selected, slot, { done: !done }, true))}
                >
                  <CheckMark />
                </button>
                <div>
                  <div className="chunk-slot-head">
                    <label htmlFor={`chunk-note-${slot}`}>덩어리 {slot}</label>
                    {/* 시간은 글자 그대로 적어 두는 라벨 (예: 9-12시, 오후) */}
                    <input
                      className="chunk-time"
                      type="text"
                      maxLength={TIME_MAX}
                      autoComplete="off"
                      placeholder="+ 시간"
                      value={time ?? ""}
                      size={Math.max(5, (time ?? "").length + 1)}
                      onChange={(e) => actions.editChunk(selected, slot, { time: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      onBlur={() => actions.flush(selected)}
                      aria-label={`덩어리 ${slot} 시간`}
                    />
                  </div>
                  <input
                    id={`chunk-note-${slot}`}
                    type="text"
                    maxLength={NOTE_MAX}
                    autoComplete="off"
                    placeholder={SLOT_PLACEHOLDERS[i] ?? "한 일 한 줄"}
                    value={note}
                    onChange={(e) => actions.editChunk(selected, slot, { note: e.target.value })}
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
                        onClick={() => actions.commit((s) => updateChunk(s, selected, slot, { group: g.id === group ? "" : g.id }))}
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
          {chunks.length < MAX_CHUNKS && (
            <button type="button" className="chunk-add" onClick={() => actions.commit((s) => addChunk(s, selected))}>
              <Icon name="plus" size={14} />
              덩어리 추가
            </button>
          )}
        </div>
      </section>

      <div className="chunk-month">
        <section className="chunk-log-side" aria-label="한 일 목록">
          <h2>{Number(month.slice(5))}월에 한 일</h2>
          {logged.length ? (
            <ul className="chunk-log">
              {logged.map((key) => {
                const day = state.days[key]!;
                return (
                  <li key={key}>
                    <button
                      type="button"
                      className={key === selected ? "selected" : undefined}
                      onClick={() => {
                        setSelected(key);
                        window.scrollTo(0, 0);
                      }}
                    >
                      <span className="chunk-when">
                        {Number(key.slice(5, 7))}/{Number(key.slice(8))} ({dayOfWeek(key)})
                      </span>
                      <span className="chunk-lines">
                        {day.chunks.map(
                          (c, i) =>
                            c.done && (
                              <span key={i}>
                                <b style={groupColor(state, c.group)}>덩어리 {i + 1}</b> {c.time && <span className="muted">{c.time}</span>}{" "}
                                {c.note || <span className="muted">메모 없음</span>}
                              </span>
                            ),
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted chunk-note">아직 체크한 날이 없어요.</p>
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
            <span className="chunk-total">
              <b>{summary.total}</b> 덩어리 · 일한 날 {summary.worked}일 · {BASE_CHUNKS}덩어리 이상 {summary.full}일
            </span>
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
              const cellChunks = dayChunks(state.days[key]);
              return (
                <button
                  key={key}
                  type="button"
                  className={`chunk-cell${key === selected ? " selected" : ""}${key === today ? " today" : ""}`}
                  disabled={key > today}
                  aria-pressed={key === selected}
                  aria-current={key === today ? "date" : undefined}
                  aria-label={`${Number(key.slice(5, 7))}월 ${Number(key.slice(8))}일, ${chunkCount(state.days[key])}덩어리`}
                  onClick={() => setSelected(key)}
                >
                  <span className="chunk-cell-date">{Number(key.slice(8))}</span>
                  {/* 칸 수만큼 세로로 나눠 한 덩어리를 그룹 색으로 칠한다 */}
                  <span className="chunk-bricks" style={{ gridTemplateColumns: `repeat(${cellChunks.length}, minmax(0, 1fr))` }}>
                    {cellChunks.map((c, i) => (
                      <i key={i} className={c.done ? "on" : undefined} style={groupColor(state, c.group)} />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
