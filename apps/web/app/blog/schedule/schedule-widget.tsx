"use client";

import { useEffect, useState } from "react";
import { formatScheduleTime, pickScheduleTimes, scheduleDate, SCHEDULE_STEP_MIN } from "../../../lib/schedule-times";
import { readSaved, SAVED_EVENT, writeSaved, type SavedSchedule } from "./saved";

const pad = (n: number) => String(n).padStart(2, "0");

/** 사이드 메뉴 아래에 늘 보이는 예약 발행 시간. 누르면 그 시각(22:10)을 복사한다 */
export function ScheduleWidget() {
  const [saved, setSaved] = useState<SavedSchedule | null>(null);
  const [now, setNow] = useState(0);
  const [copied, setCopied] = useState(-1);

  useEffect(() => {
    const load = () => {
      setSaved(readSaved());
      setNow(Date.now());
    };
    load();
    // 지난 시간·다음 예약 표시가 바뀌도록 1분마다 다시 본다
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    window.addEventListener(SAVED_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      clearInterval(timer);
      window.removeEventListener(SAVED_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);

  if (!now) return null;
  const items = (saved?.times ?? []).map((t) => {
    const label = formatScheduleTime(saved!.date, t);
    const cut = label.indexOf(")") + 1;
    return { day: label.slice(0, cut).replace(/(\d+)월 (\d+)일/, "$1/$2"), clock: label.slice(cut + 1), at: scheduleDate(saved!.date, t).getTime() };
  });
  // 모두 지났으면 하루가 지난 뒤엔 숨기고 뽑기로 안내
  const stale = items.length === 0 || items.at(-1)!.at < now - 24 * 60 * 60 * 1000;
  const next = items.findIndex((item) => item.at > now);

  // 같은 조건(바로 올린 시각·개수·간격)으로 다시 뽑는다. 뽑은 게 없거나 지난 것이면 지금부터 기본 조건(4개, 3~4시간)으로
  const redraw = () => {
    let base = saved && !stale ? saved : null;
    if (!base) {
      const at = new Date();
      const next = Math.min(Math.ceil((at.getHours() * 60 + at.getMinutes() + 1) / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN, 23 * 60 + 50);
      const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
      base = { date, start: `${pad(Math.floor(next / 60))}:${pad(next % 60)}`, count: 4, minGap: 3, maxGap: 4, times: [] };
    }
    const start = Number(base.start.slice(0, 2)) * 60 + Number(base.start.slice(3, 5));
    writeSaved({ ...base, times: pickScheduleTimes({ start, count: base.count, minGapMin: base.minGap * 60, maxGapMin: base.maxGap * 60 }) });
  };

  const copy = async (i: number, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(i);
      setTimeout(() => setCopied(-1), 1200);
    } catch {
      // 복사 못 하면 그대로 둔다
    }
  };

  return (
    <section className="side-schedule" aria-label="예약 발행 시간">
      <div className="side-schedule-head">
        예약 발행
        <button type="button" className="side-schedule-redraw" onClick={redraw} title="같은 조건으로 다시 뽑아요. 조건은 예약 발행 화면에서 바꿔요">
          {stale ? "뽑기" : "다시 뽑기"}
        </button>
      </div>
      {stale ? (
        <p className="side-empty">아직 뽑은 시간이 없어요</p>
      ) : (
        <ol>
          {items.map((item, i) => (
            <li key={i}>
              <button
                type="button"
                className={i === next ? "next" : item.at <= now ? "past" : ""}
                onClick={() => copy(i, item.clock)}
                title={`${i + 1}번째 예약${i === next ? " (다음)" : item.at <= now ? " (지남)" : ""} · 눌러서 ${item.clock} 복사`}
              >
                <i>{i + 1}</i>
                <span>{item.day}</span>
                <b>{copied === i ? "복사됨" : item.clock}</b>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
