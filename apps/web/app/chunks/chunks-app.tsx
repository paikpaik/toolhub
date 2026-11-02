"use client";

import { chunkToday, docOf, emptyDay, GROUP_COLORS, updateDay, type ChunkChange, type ChunkDay, type ChunkState } from "@toolhub/tasks/chunks";
import { useCallback, useEffect, useRef, useState } from "react";
import { TodayView } from "./today-view";
import { CHUNK_VIEWS, VIEW_LABELS, type ChunkView } from "./views";
import { WeekView } from "./week-view";

/** 메모를 치는 동안은 모아 두었다가 잠시 멈추면 저장한다 */
const MEMO_SAVE_DELAY_MS = 700;

export interface ChunkActions {
  /** 상태를 바꾸고 바뀐 문서를 저장한다 */
  commit: (fn: (state: ChunkState) => ChunkChange) => void;
  /** 메모 입력 중: 화면만 바꾸고 저장(과 주간 카드 맞추기)은 잠시 뒤 */
  editDay: (day: string, patch: Partial<ChunkDay>) => void;
  /** 미뤄 둔 메모 저장을 바로 한다 */
  flush: (day: string) => void;
}

/** 그룹 색을 CSS 변수(--gc)로 */
export const groupColor = (state: ChunkState, groupId: string) => {
  const group = state.groups.find((g) => g.id === groupId);
  return group ? ({ "--gc": GROUP_COLORS[group.c] } as React.CSSProperties) : undefined;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** 문서별로 순서대로 저장한다. 보낼 때의 최신 상태를 보내므로 여러 번 쌓여도 마지막 내용이 남는다 */
function useChunkStore(initial: ChunkState) {
  const [state, setState] = useState(initial);
  const ref = useRef(initial);
  const queues = useRef(new Map<string, Promise<void>>());
  const inFlight = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const [status, setStatus] = useState<SaveStatus>("idle");

  const save = useCallback((id: string) => {
    inFlight.current++;
    setStatus("saving");
    const prev = queues.current.get(id) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        // keepalive: 다른 메뉴로 옮기거나 탭을 닫는 순간의 저장도 끝까지 보낸다
        const res = await fetch(`/api/chunks/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(docOf(ref.current, id)),
          keepalive: true,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? `저장 실패 (${res.status})`);
      })
      .then(
        () => {
          if (--inFlight.current === 0) setStatus((s) => (s === "error" ? s : "saved"));
        },
        () => {
          inFlight.current--;
          setStatus("error");
        },
      );
    queues.current.set(id, next);
  }, []);

  const commit = useCallback(
    (fn: (state: ChunkState) => ChunkChange) => {
      const change = fn(ref.current);
      ref.current = change.state;
      setState(change.state);
      change.changed.forEach(save);
    },
    [save],
  );

  const flush = useCallback(
    (day: string) => {
      const timer = timers.current.get(day);
      if (!timer) return;
      clearTimeout(timer);
      timers.current.delete(day);
      commit((s) => updateDay(s, day, {}));
    },
    [commit],
  );

  const editDay = useCallback(
    (day: string, patch: Partial<ChunkDay>) => {
      const next = { ...ref.current, days: { ...ref.current.days, [day]: { ...emptyDay(), ...ref.current.days[day], ...patch } } };
      ref.current = next;
      setState(next);
      clearTimeout(timers.current.get(day));
      timers.current.set(
        day,
        setTimeout(() => flush(day), MEMO_SAVE_DELAY_MS),
      );
    },
    [flush],
  );

  // 탭을 숨기거나 다른 메뉴로 옮기면 미뤄 둔 메모를 바로 저장한다
  useEffect(() => {
    const flushAll = () => [...timers.current.keys()].forEach(flush);
    const onHide = () => document.visibilityState === "hidden" && flushAll();
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      flushAll();
    };
  }, [flush]);

  return { state, status, actions: { commit, editDay, flush } satisfies ChunkActions };
}

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: "data/chunks.json에 저장돼요.",
  saving: "저장하는 중…",
  saved: "저장했어요 (data/chunks.json).",
  error: "저장하지 못했어요. toolhub 웹이 켜져 있는지 확인하고 다시 고쳐 보세요.",
};

export function ChunksApp({ initial, today: serverToday, initialView }: { initial: ChunkState; today: string; initialView: ChunkView }) {
  const { state, status, actions } = useChunkStore(initial);
  const [view, setView] = useState(initialView);
  const [today, setToday] = useState(serverToday);

  // 페이지를 켜 둔 채 새벽 5시를 넘기면 "오늘"을 바꾼다
  useEffect(() => {
    const id = setInterval(() => setToday(chunkToday()), 60_000);
    return () => clearInterval(id);
  }, []);

  const show = (next: ChunkView) => {
    setView(next);
    // 새로고침해도 같은 화면이 보이도록 주소에만 남긴다 (서버를 다시 부르지 않음)
    window.history.replaceState(null, "", next === "today" ? "/chunks" : `/chunks?view=${next}`);
    window.scrollTo(0, 0);
  };

  return (
    <main className={`chunks chunks-${view}`}>
      <header>
        <h1>
          덩어리 기록 <small>하루 3~4시간 집중 2덩어리 · 그룹별 주간 목표</small>
        </h1>
      </header>
      <nav className="chunk-tabs" role="tablist" aria-label="덩어리 기록 화면">
        {CHUNK_VIEWS.map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "active" : ""} onClick={() => show(v)}>
            {VIEW_LABELS[v]}
          </button>
        ))}
      </nav>

      {view === "today" && <TodayView key={today} state={state} today={today} actions={actions} onGoWeek={() => show("week")} />}
      {view === "week" && <WeekView state={state} today={today} actions={actions} />}
      {view === "help" && <ChunkHelp />}

      <footer className="chunk-footer">
        <p className={status === "error" ? "chunk-error" : undefined} role="status">
          {STATUS_TEXT[status]}
        </p>
        <p>새벽 5시에 하루가 바뀌어요. 한 주는 월요일부터예요.</p>
      </footer>
    </main>
  );
}

function ChunkHelp() {
  return (
    <div className="chunk-help">
      <section className="card">
        <h3>두 화면이 이어지는 방식</h3>
        <ol className="chunk-flow">
          <li>
            <b>오늘</b> 덩어리 메모 + 그룹
          </li>
          <li className="chunk-flow-arrow">↓ 메모와 그룹을 고르면 주간 보드의 그 요일 칸에 카드가 생겨요</li>
          <li>
            <b>주간 보드</b> 그룹별 목표 · 요일 칸
          </li>
          <li className="chunk-flow-arrow">↑ 요일 칸에 놓은 카드는 오늘 화면의 &quot;배정된 목표&quot;에 떠요</li>
        </ol>
      </section>
      <section className="card">
        <h3>오늘</h3>
        <ol className="chunk-steps">
          <li>덩어리 1·2 칸에 한 일을 한 줄 적어요. 한 덩어리 = 3~4시간, 한 가지 일에 집중한 것.</li>
          <li>그룹(공방·집·SNS)을 고르면 색이 붙고, 주간 보드에도 카드가 하나 생겨요.</li>
          <li>다 하면 동그라미를 눌러 체크해요. 1덩어리만 해도 일한 날이에요.</li>
          <li>&quot;배정된 목표&quot;의 [덩어리에 적기]를 누르면 목표가 메모로 들어가고, 체크하면 목표도 완료돼요.</li>
        </ol>
      </section>
      <section className="card">
        <h3>주간 보드</h3>
        <ol className="chunk-steps">
          <li>
            입력창에 목표를 써요. <code>릴스 3개 올리기 #공방 @수</code>처럼 #그룹, @요일을 붙일 수 있어요.
          </li>
          <li>카드를 요일 칸으로 끌어다 놓아요. 폰에서는 카드를 눌러 요일을 골라요.</li>
          <li>그룹 이름 옆 동그라미를 누르면 색을, 이름을 누르면 이름을 바꿀 수 있어요.</li>
          <li>못 끝낸 카드는 눌러서 [다음 주로] 보내요.</li>
        </ol>
      </section>
    </div>
  );
}
