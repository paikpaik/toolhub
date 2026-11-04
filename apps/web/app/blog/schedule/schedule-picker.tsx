"use client";

import { useEffect, useRef, useState } from "react";
import { formatScheduleTime, pickScheduleTimes, SCHEDULE_STEP_MIN } from "../../../lib/schedule-times";
import { Icon } from "../../icons";
import { CopyButton } from "../copy-button";
import { readSaved, SAVED_EVENT, writeSaved, type SavedSchedule } from "./saved";

const COUNTS = [1, 2, 3, 4, 5, 6, 7, 8];
/** 간격으로 고를 수 있는 시간 (30분 단위) */
const GAP_HOURS = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 8];
const pad = (n: number) => String(n).padStart(2, "0");
const toClock = (minutes: number) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const gapLabel = (minutes: number) => `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}`;
const todayString = (now: Date) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

const conditionKey = (start: number, count: number, minGap: number, maxGap: number) => [start, count, minGap, maxGap].join("|");

/** 다시 열면 기억해 둔 시간을 그대로 보여 준다 (기준 날짜가 지났으면 새로 뽑는다) */
function loadSaved(today: string) {
  const saved = readSaved();
  return saved && saved.date >= today ? saved : null;
}

/** 예약 발행 시간 뽑기: 바로 올린 시각 뒤로 정한 간격의 랜덤 시간 */
export function SchedulePicker() {
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [count, setCount] = useState(4);
  const [minGap, setMinGap] = useState(3);
  const [maxGap, setMaxGap] = useState(4);
  const [times, setTimes] = useState<number[]>([]);

  // 마지막으로 뽑은(또는 복원한) 조건. 조건이 이것과 다를 때만 다시 뽑아서, 기억해 둔 시간을 복원할 때는 다시 뽑지 않는다
  const drawnFor = useRef("");
  const timesRef = useRef(times);
  timesRef.current = times;

  // 지금 시각을 바로 올린 시각으로 (분은 다음 10분 단위로)
  const resetToNow = () => {
    const now = new Date();
    setDate(todayString(now));
    const next = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN, 23 * 60 + 50);
    setStart(toClock(next));
    // 바로 올린 시각이 그대로면 위의 다시 뽑기가 안 돌아서 여기서 뽑는다
    setTimes(pickScheduleTimes({ start: next, count, minGapMin: minGap * 60, maxGapMin: maxGap * 60 }));
  };

  const restore = (saved: SavedSchedule) => {
    drawnFor.current = conditionKey(Number(saved.start.slice(0, 2)) * 60 + Number(saved.start.slice(3, 5)), saved.count, saved.minGap, saved.maxGap);
    setDate(saved.date);
    setStart(saved.start);
    setCount(saved.count);
    setMinGap(saved.minGap);
    setMaxGap(saved.maxGap);
    setTimes(saved.times);
  };

  // 랜덤과 "지금"은 브라우저에서 정한다 (서버 화면과 어긋나지 않게)
  useEffect(() => {
    const saved = loadSaved(todayString(new Date()));
    if (!saved) resetToNow();
    else restore(saved);
    // 사이드 메뉴에서 다시 뽑으면 이 화면도 같은 시간으로 맞춘다
    const sync = () => {
      const next = readSaved();
      if (next && next.times.join() !== timesRef.current.join()) restore(next);
    };
    window.addEventListener(SAVED_EVENT, sync);
    return () => window.removeEventListener(SAVED_EVENT, sync);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startMinutes = start ? Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5)) : null;
  const draw = () => {
    if (startMinutes !== null) setTimes(pickScheduleTimes({ start: startMinutes, count, minGapMin: minGap * 60, maxGapMin: maxGap * 60 }));
  };
  // 조건을 바꾸면 바로 다시 뽑는다
  useEffect(() => {
    if (startMinutes === null) return;
    const key = conditionKey(startMinutes, count, minGap, maxGap);
    if (key === drawnFor.current) return;
    drawnFor.current = key;
    draw();
  }, [startMinutes, count, minGap, maxGap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (date && start && times.length > 0) writeSaved({ date, start, count, minGap, maxGap, times });
  }, [date, start, count, minGap, maxGap, times]);

  // 최소를 최대보다 크게 고르면 최대도 따라 올린다 (반대도 마찬가지)
  const changeMin = (h: number) => {
    setMinGap(h);
    if (h > maxGap) setMaxGap(h);
  };
  const changeMax = (h: number) => {
    setMaxGap(h);
    if (h < minGap) setMinGap(h);
  };
  const gapSelect = (value: number, onChange: (h: number) => void, label: string) => (
    <select value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))}>
      {GAP_HOURS.map((h) => (
        <option key={h} value={h}>
          {h}
        </option>
      ))}
    </select>
  );

  const labels = date ? times.map((t) => formatScheduleTime(date, t)) : [];

  return (
    <section className="card schedule-picker">
      <div className="schedule-head">
        <span className="schedule-badge" aria-hidden="true">
          <Icon name="calendar" size={14} />
        </span>
        <h3>
          예약 발행 시간 <small>바로 올린 시각 뒤로 · {SCHEDULE_STEP_MIN}분 단위</small>
        </h3>
        <button type="button" className="button small" onClick={resetToNow} title="바로 올린 시각을 지금으로 바꾸고 다시 뽑아요">
          지금부터
        </button>
        <button type="button" className="button small primary" onClick={draw}>
          다시 뽑기
        </button>
        {labels.length > 0 && <CopyButton text={labels.join("\n")} label="전체 복사" />}
      </div>
      <div className="schedule-controls">
        <label>
          날짜
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
        <label title="지금 바로 올린 글의 시각. 첫 예약도 여기서 간격만큼 뒤로 잡아요">
          바로 올린 시각
          <input type="time" step={SCHEDULE_STEP_MIN * 60} value={start} onChange={(e) => e.target.value && setStart(e.target.value)} />
        </label>
        <label>
          예약
          <select value={count} onChange={(e) => setCount(Number(e.target.value))}>
            {COUNTS.map((n) => (
              <option key={n} value={n}>
                {n}개
              </option>
            ))}
          </select>
        </label>
        <label>
          간격
          {gapSelect(minGap, changeMin, "최소 간격")}~{gapSelect(maxGap, changeMax, "최대 간격")}시간
        </label>
      </div>
      {/* 시각 하나를 칩 하나로. 누르면 그 시각(14:30)을 복사한다 */}
      <div className="schedule-times">
        {labels.map((label, i) => (
          <CopyButton
            key={`${i}-${label}`}
            text={label.slice(label.indexOf(")") + 2)}
            label={
              <>
                <i>{i + 1}</i>
                <span className="schedule-day">{label.slice(0, label.indexOf(")") + 1).replace(/(\d+)월 (\d+)일/, "$1/$2")}</span>
                <b>{label.slice(label.indexOf(")") + 2)}</b>
              </>
            }
            title={`${i + 1}번째 예약 · ${i === 0 ? "바로 올린 시각" : "앞 예약"}에서 +${gapLabel(times[i]! - (i === 0 ? Math.ceil(startMinutes! / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN : times[i - 1]!))} · 눌러서 시각 복사`}
          />
        ))}
      </div>
    </section>
  );
}
