"use client";

import {
  addGoal,
  addGroup,
  chunkGroupOf,
  GOAL_MAX,
  GROUP_COLORS,
  GROUP_NAME_MAX,
  mondayOf,
  moveGoalToNextWeek,
  parseGoalInput,
  removeGoal,
  shiftDay,
  updateGoal,
  updateGroup,
  WEEKDAYS,
  type ChunkState,
  type WeekGoal,
} from "@toolhub/tasks/chunks";
import { useState } from "react";
import { Icon } from "../icons";
import { groupColor, type ChunkActions } from "./chunks-app";
import { CheckMark } from "./today-view";

const DRAG_TYPE = "text/chunk-goal";

/** 끌어다 놓는 곳: 그룹 칸(요일 미배정으로) 또는 요일 칸 */
type Zone = { group: string } | { day: number };
const zoneKey = (zone: Zone) => ("group" in zone ? `g:${zone.group}` : `d:${zone.day}`);

function weekLabel(monday: string) {
  const end = shiftDay(monday, 6);
  const [y, m, d] = monday.split("-").map(Number);
  const endMonth = Number(end.slice(5, 7));
  return `${y}년 ${m}월 ${d}일 – ${endMonth !== m ? `${endMonth}월 ` : ""}${Number(end.slice(8))}일`;
}

export function WeekView({ state, today, actions }: { state: ChunkState; today: string; actions: ChunkActions }) {
  const thisMonday = mondayOf(today);
  const [monday, setMonday] = useState(thisMonday);
  const [text, setText] = useState("");
  const [addGroupId, setAddGroupId] = useState(state.groups[0]?.id ?? "");
  const [newGroup, setNewGroup] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [colorOpen, setColorOpen] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);

  const goals = state.weeks[monday] ?? [];
  const done = goals.filter((g) => g.done).length;

  const goWeek = (next: string) => {
    setMonday(next);
    setOpenId(null);
    setConfirmDelete(null);
    setColorOpen(null);
  };

  const submitGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseGoalInput(text, state.groups, addGroupId || state.groups[0]!.id);
    if (!parsed) return;
    actions.commit((s) => addGoal(s, monday, parsed));
    setText("");
  };

  const submitGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    actions.commit((s) => addGroup(s, newGroup));
    setNewGroup("");
  };

  const drop = (zone: Zone, id: string) =>
    actions.commit((s) => updateGoal(s, monday, id, "group" in zone ? { d: -1, g: zone.group } : { d: zone.day }));

  const dropProps = (zone: Zone) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setOver(zoneKey(zone));
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(null);
    },
    onDrop: (e: React.DragEvent) => {
      setOver(null);
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) drop(zone, id);
    },
  });

  const card = (g: WeekGoal, { showGroup, showDay }: { showGroup: boolean; showDay: boolean }) => (
    <GoalCard
      key={g.id}
      goal={g}
      state={state}
      showGroup={showGroup}
      showDay={showDay}
      open={openId === g.id}
      confirmDelete={confirmDelete === g.id}
      onToggleOpen={() => {
        setOpenId(openId === g.id ? null : g.id);
        setConfirmDelete(null);
      }}
      onDone={() => actions.commit((s) => updateGoal(s, monday, g.id, { done: !g.done }))}
      onDay={(d) => {
        setConfirmDelete(null);
        actions.commit((s) => updateGoal(s, monday, g.id, { d }));
      }}
      onNextWeek={() => {
        setOpenId(null);
        actions.commit((s) => moveGoalToNextWeek(s, monday, g.id));
      }}
      onDelete={() => {
        if (confirmDelete !== g.id) return setConfirmDelete(g.id);
        setOpenId(null);
        setConfirmDelete(null);
        actions.commit((s) => removeGoal(s, monday, g.id));
      }}
    />
  );

  return (
    <div className="chunk-week">
      <div className="chunk-week-head">
        <span className="muted">
          남은 목표 {goals.length - done}개 · 완료 {done}/{goals.length}
        </span>
        <div className="chunk-weeknav">
          <button type="button" className="icon-button" aria-label="이전 주" onClick={() => goWeek(shiftDay(monday, -7))}>
            <Icon name="chevronLeft" size={14} />
          </button>
          <span>{weekLabel(monday)}</span>
          <button type="button" className="icon-button" aria-label="다음 주" onClick={() => goWeek(shiftDay(monday, 7))}>
            <Icon name="chevronRight" size={14} />
          </button>
          {monday !== thisMonday && (
            <button type="button" className="button chunk-small" onClick={() => goWeek(thisMonday)}>
              이번 주
            </button>
          )}
        </div>
      </div>

      <form className="chunk-addbar" onSubmit={submitGoal}>
        <Icon name="plus" size={14} />
        <input
          type="text"
          maxLength={GOAL_MAX}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="목표 추가 — 예: 릴스 3개 올리기 #공방 @수"
          aria-label="목표 추가"
        />
        <select value={addGroupId} onChange={(e) => setAddGroupId(e.target.value)} aria-label="그룹">
          {state.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <button type="submit" className="button chunk-primary">
          추가
        </button>
      </form>

      <section aria-label="그룹별 목표">
        <h2 className="chunk-board-title">
          그룹별 목표
          <form className="chunk-group-add" onSubmit={submitGroup}>
            <input
              type="text"
              maxLength={GROUP_NAME_MAX}
              autoComplete="off"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              placeholder="새 그룹 이름"
              aria-label="새 그룹 이름"
            />
            <button type="submit" className="button chunk-small">
              그룹 추가
            </button>
          </form>
        </h2>
        <div className="chunk-board">
          {state.groups.map((group) => {
            const items = goals.filter((g) => chunkGroupOf(state, g.g).id === group.id).sort((a, b) => a.d - b.d);
            const zone = { group: group.id };
            return (
              <section key={group.id} className={`chunk-col${over === zoneKey(zone) ? " over" : ""}`} style={groupColor(state, group.id)} {...dropProps(zone)}>
                <header>
                  <button
                    type="button"
                    className="chunk-dot"
                    aria-label="그룹 색 바꾸기"
                    aria-expanded={colorOpen === group.id}
                    onClick={() => setColorOpen(colorOpen === group.id ? null : group.id)}
                  />
                  <input
                    // 다른 곳에서 이름이 바뀌면 입력칸도 새로 그린다
                    key={group.name}
                    className="chunk-group-name"
                    type="text"
                    maxLength={GROUP_NAME_MAX}
                    defaultValue={group.name}
                    aria-label="그룹 이름"
                    onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                    onBlur={(e) => {
                      const name = e.currentTarget.value.trim();
                      if (!name) e.currentTarget.value = group.name;
                      else if (name !== group.name) actions.commit((s) => updateGroup(s, group.id, { name }));
                    }}
                  />
                  <span className="side-count">{items.length}</span>
                </header>
                {colorOpen === group.id && (
                  <div className="chunk-swatches" role="group" aria-label="그룹 색">
                    {GROUP_COLORS.map((color, c) => (
                      <button
                        key={color}
                        type="button"
                        className={group.c === c ? "on" : undefined}
                        style={{ background: color }}
                        aria-label={`색 ${c + 1}`}
                        aria-pressed={group.c === c}
                        onClick={() => {
                          setColorOpen(null);
                          actions.commit((s) => updateGroup(s, group.id, { c }));
                        }}
                      />
                    ))}
                  </div>
                )}
                <div className="chunk-cards" role="list">
                  {items.length ? items.map((g) => card(g, { showGroup: false, showDay: true })) : <p className="board-empty">목표를 추가하거나 여기로 끌어다 놓기</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section aria-label="요일별 계획">
        <h2>
          요일 <small>카드를 요일 칸으로 끌어다 놓아요. 폰에서는 카드를 눌러 요일을 골라요.</small>
        </h2>
        <div className="chunk-board chunk-days">
          {WEEKDAYS.map((name, d) => {
            const date = shiftDay(monday, d);
            const items = goals.filter((g) => g.d === d);
            const zone = { day: d };
            return (
              <section key={name} className={`chunk-col${over === zoneKey(zone) ? " over" : ""}`} aria-label={`${name}요일`} {...dropProps(zone)}>
                <header>
                  <span>{name}</span>
                  <span className="muted">{Number(date.slice(8))}</span>
                  {date === today && <span className="chunk-is-today">오늘</span>}
                  <span className="side-count">{items.length}</span>
                </header>
                <div className="chunk-cards" role="list">
                  {items.length ? items.map((g) => card(g, { showGroup: true, showDay: false })) : <p className="board-empty">여기로 끌어다 놓기</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function GoalCard({
  goal,
  state,
  showGroup,
  showDay,
  open,
  confirmDelete,
  onToggleOpen,
  onDone,
  onDay,
  onNextWeek,
  onDelete,
}: {
  goal: WeekGoal;
  state: ChunkState;
  showGroup: boolean;
  showDay: boolean;
  open: boolean;
  confirmDelete: boolean;
  onToggleOpen: () => void;
  onDone: () => void;
  onDay: (d: number) => void;
  onNextWeek: () => void;
  onDelete: () => void;
}) {
  const group = chunkGroupOf(state, goal.g);
  const scheduled = showDay && goal.d >= 0;
  return (
    <article
      className={`board-card chunk-card${goal.done ? " done" : ""}${open ? " selected" : ""}${scheduled ? " scheduled" : ""}`}
      role="listitem"
      tabIndex={0}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, goal.id)}
      onClick={onToggleOpen}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget || (e.key !== "Enter" && e.key !== " ")) return;
        e.preventDefault();
        onToggleOpen();
      }}
    >
      <div className="chunk-card-top">
        <button
          type="button"
          className={`chunk-tick${goal.done ? " on" : ""}`}
          role="checkbox"
          aria-checked={goal.done}
          aria-label="완료"
          onClick={(e) => (e.stopPropagation(), onDone())}
        >
          <CheckMark />
        </button>
        <div>
          {showGroup && (
            <span className="chunk-tag" style={groupColor(state, group.id)}>
              <i />
              {group.name}
            </span>
          )}
          {scheduled && <span className="chunk-tag chunk-day-tag">{WEEKDAYS[goal.d]}요일</span>}
          <span className="chunk-title">{goal.t}</span>
        </div>
      </div>
      {open && (
        <div className="chunk-card-menu" onClick={(e) => e.stopPropagation()}>
          <div className="chunk-day-chips" role="group" aria-label="요일 배정">
            {[-1, 0, 1, 2, 3, 4, 5, 6].map((d) => (
              <button key={d} type="button" className={`chip${goal.d === d ? " on" : ""}`} aria-pressed={goal.d === d} onClick={() => onDay(d)}>
                {d < 0 ? "미배정" : WEEKDAYS[d]}
              </button>
            ))}
          </div>
          <div className="chunk-card-actions">
            <button type="button" onClick={onNextWeek}>
              다음 주로
            </button>
            <button type="button" className="danger" onClick={onDelete}>
              {confirmDelete ? "정말 삭제" : "삭제"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
