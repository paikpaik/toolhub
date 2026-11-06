"use client";

import {
  addGoal,
  addGroup,
  addPlanItem,
  chunkGroupOf,
  GOAL_MAX,
  GROUP_COLORS,
  GROUP_NAME_MAX,
  NOTE_MAX,
  parseAutoGoalId,
  goalsInGroup,
  mondayOf,
  moveGoal,
  moveGoalToNextWeek,
  parseGoalInput,
  PLAN_ITEM_MAX,
  removeGoal,
  removeGroup,
  removePlanItem,
  setWeekTitle,
  shiftDay,
  updateGoal,
  updateGroup,
  updatePlanItem,
  WEEK_TITLE_MAX,
  WEEKDAYS,
  type ChunkState,
  type WeekGoal,
} from "@toolhub/tasks/chunks";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { groupColor, type ChunkActions } from "./chunks-app";
import { CheckMark } from "./today-view";

const DRAG_TYPE = "text/chunk-goal";

/** 끌어다 놓는 곳: 그룹 칸(그룹만 바꾸고 요일은 그대로) 또는 요일 칸 */
type Zone = { group: string } | { day: number };
const zoneKey = (zone: Zone) => ("group" in zone ? `g:${zone.group}` : `d:${zone.day}`);
/** 카드 위에 놓을 때: 그 카드 앞·뒤 (같은 칸이면 순서만, 다른 칸이면 그룹·요일도) */
type CardDrop = { id: string; place: "before" | "after" };

/** 그룹 삭제 확인 문구: 목표가 어디로 가는지 알려 준다 */
function deleteConfirmText(state: ChunkState, groupId: string) {
  const moving = goalsInGroup(state, groupId);
  const fallback = state.groups.find((g) => g.id !== groupId)!.name;
  return moving ? `정말 삭제 (목표 ${moving}개는 ${fallback}으로)` : "정말 삭제";
}

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
  const [colorOpen, setColorOpen] = useState<string | null>(null);
  const [confirmGroupDelete, setConfirmGroupDelete] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [overCard, setOverCard] = useState<CardDrop | null>(null);

  // 열어 둔 카드 밖을 누르면 닫는다 (다른 카드를 누르면 그 카드가 열린다)
  useEffect(() => {
    if (!openId) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.(`[data-goal-id="${CSS.escape(openId)}"]`)) setOpenId(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openId]);

  const goals = state.weeks[monday] ?? [];
  const done = goals.filter((g) => g.done).length;

  const goWeek = (next: string) => {
    setMonday(next);
    setOpenId(null);
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
    actions.commit((s) => updateGoal(s, monday, id, "group" in zone ? { g: zone.group } : { d: zone.day }));

  const zonePatch = (zone: Zone) => ("group" in zone ? { g: zone.group } : { d: zone.day });

  /** 카드 위: 마우스가 카드 위쪽 절반이면 앞, 아래쪽이면 뒤에 놓는다 */
  const cardDropProps = (zone: Zone, target: WeekGoal) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      e.stopPropagation();
      const box = e.currentTarget.getBoundingClientRect();
      const place = e.clientY < box.top + box.height / 2 ? "before" : "after";
      setOver(zoneKey(zone));
      if (overCard?.id !== target.id || overCard.place !== place) setOverCard({ id: target.id, place });
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const place = overCard?.id === target.id ? overCard.place : "after";
      setOver(null);
      setOverCard(null);
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id && id !== target.id) actions.commit((s) => moveGoal(s, monday, id, target.id, place, zonePatch(zone)));
    },
  });

  const dropProps = (zone: Zone) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
      e.preventDefault();
      setOver(zoneKey(zone));
      // 카드 사이 빈 곳: 카드 앞·뒤 표시를 지운다 (놓으면 칸 끝으로)
      if (overCard) setOverCard(null);
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
        setOver(null);
        setOverCard(null);
      }
    },
    onDrop: (e: React.DragEvent) => {
      setOver(null);
      setOverCard(null);
      const id = e.dataTransfer.getData(DRAG_TYPE);
      if (id) drop(zone, id);
    },
  });

  const card = (g: WeekGoal, zone: Zone, { showGroup, showDay }: { showGroup: boolean; showDay: boolean }) => (
    <GoalCard
      key={g.id}
      goal={g}
      state={state}
      showGroup={showGroup}
      showDay={showDay}
      open={openId === g.id}
      dropMark={overCard?.id === g.id && over === zoneKey(zone) ? overCard.place : null}
      dropProps={cardDropProps(zone, g)}
      onDragEnd={() => {
        setOver(null);
        setOverCard(null);
      }}
      onToggleOpen={() => setOpenId(openId === g.id ? null : g.id)}
      onDone={() => actions.commit((s) => updateGoal(s, monday, g.id, { done: !g.done }))}
      onDay={(d) => actions.commit((s) => updateGoal(s, monday, g.id, { d }))}
      onRename={(t) => actions.commit((s) => updateGoal(s, monday, g.id, { t }))}
      onNextWeek={() => {
        setOpenId(null);
        actions.commit((s) => moveGoalToNextWeek(s, monday, g.id));
      }}
      onDelete={() => {
        setOpenId(null);
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

      <WeekPlanCard key={monday} monday={monday} state={state} actions={actions} />

      {/* 그룹을 먼저 고르고 목표를 적는다 (#그룹으로 적으면 그쪽이 먼저) */}
      <form className="chunk-addbar" onSubmit={submitGoal}>
        <select value={addGroupId} onChange={(e) => setAddGroupId(e.target.value)} aria-label="그룹" style={groupColor(state, addGroupId)}>
          {state.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          maxLength={GOAL_MAX}
          autoComplete="off"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="목표 추가 — 예: 릴스 3개 올리기 @수"
          aria-label="목표 추가"
        />
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
            // 순서는 끌어다 놓은 순서 그대로 (배열 순서)
            const items = goals.filter((g) => chunkGroupOf(state, g.g).id === group.id);
            const zone = { group: group.id };
            return (
              <section key={group.id} className={`chunk-col${over === zoneKey(zone) ? " over" : ""}`} style={groupColor(state, group.id)} {...dropProps(zone)}>
                <header>
                  <button
                    type="button"
                    className="chunk-dot"
                    aria-label="그룹 색 바꾸기"
                    aria-expanded={colorOpen === group.id}
                    onClick={() => {
                      setColorOpen(colorOpen === group.id ? null : group.id);
                      setConfirmGroupDelete(null);
                    }}
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
                    {state.groups.length > 1 && (
                      <button
                        type="button"
                        className="chunk-group-delete"
                        onClick={() => {
                          if (confirmGroupDelete !== group.id) return setConfirmGroupDelete(group.id);
                          setColorOpen(null);
                          setConfirmGroupDelete(null);
                          if (addGroupId === group.id) setAddGroupId(state.groups.find((g) => g.id !== group.id)!.id);
                          actions.commit((s) => removeGroup(s, group.id));
                        }}
                      >
                        {confirmGroupDelete === group.id ? deleteConfirmText(state, group.id) : "그룹 삭제"}
                      </button>
                    )}
                  </div>
                )}
                <div className="chunk-cards" role="list">
                  {items.length ? items.map((g) => card(g, zone, { showGroup: false, showDay: true })) : <p className="board-empty">목표를 추가하거나 여기로 끌어다 놓기</p>}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <section aria-label="요일별 계획">
        <h2>
          요일 <small>카드를 요일 칸으로 끌어다 놓아요. 카드 위·아래에 놓으면 순서가 바뀌어요. 폰에서는 카드를 눌러 요일을 골라요.</small>
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
                  {items.length ? items.map((g) => card(g, zone, { showGroup: true, showDay: false })) : <p className="board-empty">여기로 끌어다 놓기</p>}
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
  dropMark,
  dropProps,
  onDragEnd,
  onToggleOpen,
  onDone,
  onDay,
  onRename,
  onNextWeek,
  onDelete,
}: {
  goal: WeekGoal;
  state: ChunkState;
  showGroup: boolean;
  showDay: boolean;
  open: boolean;
  /** 끌어 온 카드를 놓을 자리 표시 */
  dropMark: "before" | "after" | null;
  dropProps: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void };
  onDragEnd: () => void;
  onToggleOpen: () => void;
  onDone: () => void;
  onDay: (d: number) => void;
  onRename: (title: string) => void;
  onNextWeek: () => void;
  onDelete: () => void;
}) {
  const group = chunkGroupOf(state, goal.g);
  const scheduled = showDay && goal.d >= 0;
  // 덩어리에서 생긴 카드: 그날 한 일이라 요일·다음 주로는 바꾸지 않는다
  const fromChunk = parseAutoGoalId(goal.id);
  return (
    <article
      className={`board-card chunk-card${goal.done ? " done" : ""}${open ? " selected" : ""}${scheduled ? " scheduled" : ""}${dropMark ? ` drop-${dropMark}` : ""}`}
      data-goal-id={goal.id}
      role="listitem"
      tabIndex={0}
      draggable
      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, goal.id)}
      onDragEnd={onDragEnd}
      {...dropProps}
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
          <input
            // 다른 곳에서 이름이 바뀌면 입력칸도 새로 그린다
            key={goal.t}
            className="chunk-rename"
            type="text"
            maxLength={fromChunk ? NOTE_MAX : GOAL_MAX}
            defaultValue={goal.t}
            aria-label="목표 이름"
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                e.currentTarget.value = goal.t;
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const title = e.currentTarget.value.trim();
              if (!title) e.currentTarget.value = goal.t;
              else if (title !== goal.t) onRename(title);
            }}
          />
          {fromChunk ? (
            <p className="chunk-hint">덩어리에서 생긴 카드라 요일은 그날로 고정이에요. 이름·그룹·완료는 그날 덩어리에도 같이 반영돼요.</p>
          ) : (
            <div className="chunk-day-chips" role="group" aria-label="요일 배정">
              {[-1, 0, 1, 2, 3, 4, 5, 6].map((d) => (
                <button key={d} type="button" className={`chip${goal.d === d ? " on" : ""}`} aria-pressed={goal.d === d} onClick={() => onDay(d)}>
                  {d < 0 ? "미배정" : WEEKDAYS[d]}
                </button>
              ))}
            </div>
          )}
          <div className="chunk-card-actions">
            {!fromChunk && (
              <button type="button" onClick={onNextWeek}>
                다음 주로
              </button>
            )}
            <button type="button" className="danger" onClick={onDelete}>
              삭제
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

/** 이 주의 큰 목표(제목)와 상세 계획 체크리스트. 목표 추가 위에 둔다 */
function WeekPlanCard({ monday, state, actions }: { monday: string; state: ChunkState; actions: ChunkActions }) {
  const plan = state.plans[monday] ?? { title: "", items: [] };
  const [item, setItem] = useState("");
  const done = plan.items.filter((p) => p.done).length;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;
    actions.commit((s) => addPlanItem(s, monday, item));
    setItem("");
  };

  return (
    <section className="chunk-plan" aria-label="이번 주 큰 목표">
      <div className="chunk-plan-head">
        <input
          // 다른 곳에서 바뀌면 입력칸도 새로 그린다
          key={plan.title}
          className="chunk-plan-title"
          type="text"
          maxLength={WEEK_TITLE_MAX}
          defaultValue={plan.title}
          placeholder="이번 주 큰 목표 — 예: 겨울 신상 3종 출시 준비"
          aria-label="이번 주 큰 목표"
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              e.currentTarget.value = plan.title;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => actions.commit((s) => setWeekTitle(s, monday, e.currentTarget.value))}
        />
        {plan.items.length > 0 && (
          <span className="muted">
            {done}/{plan.items.length}
          </span>
        )}
      </div>
      {plan.items.length > 0 && (
        <ul className="chunk-plan-items">
          {plan.items.map((p) => (
            <li key={p.id} className={p.done ? "done" : undefined}>
              <button
                type="button"
                className={`chunk-tick${p.done ? " on" : ""}`}
                role="checkbox"
                aria-checked={p.done}
                aria-label="계획 완료"
                onClick={() => actions.commit((s) => updatePlanItem(s, monday, p.id, { done: !p.done }))}
              >
                <CheckMark />
              </button>
              <input
                key={p.t}
                type="text"
                maxLength={PLAN_ITEM_MAX}
                defaultValue={p.t}
                aria-label="계획 내용"
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                onBlur={(e) => {
                  const t = e.currentTarget.value.trim();
                  if (!t) e.currentTarget.value = p.t;
                  else if (t !== p.t) actions.commit((s) => updatePlanItem(s, monday, p.id, { t }));
                }}
              />
              <button type="button" className="icon-button" aria-label="계획 지우기" title="지우기" onClick={() => actions.commit((s) => removePlanItem(s, monday, p.id))}>
                <Icon name="close" size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="chunk-plan-add" onSubmit={submit}>
        <Icon name="plus" size={14} />
        <input
          type="text"
          maxLength={PLAN_ITEM_MAX}
          autoComplete="off"
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="상세 계획 한 줄 추가 후 Enter — 예: 도안 확정, 샘플 촬영"
          aria-label="상세 계획 추가"
        />
      </form>
    </section>
  );
}
