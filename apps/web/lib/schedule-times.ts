/** 예약 발행 시간 뽑기. 시간은 기준 날짜 0시부터의 분으로 다룬다 (하루를 넘기면 1440 이상) */

/** 블로그 예약 발행의 분 선택이 10분 단위라서 10분에 맞춘다 */
export const SCHEDULE_STEP_MIN = 10;

export interface ScheduleOptions {
  /** 기준 시각 (기준 날짜 0시부터의 분). 바로 올린 글의 시각으로, 첫 예약도 여기서 간격만큼 뒤다 */
  start: number;
  count: number;
  minGapMin?: number;
  maxGapMin?: number;
  random?: () => number;
}

/** min 이상 max 이하 정수 */
const randomInt = (min: number, max: number, random: () => number) => min + Math.floor(random() * (max - min + 1));

/** 기준 시각 뒤로 간격(기본 3~4시간)씩 랜덤으로 count개를 뽑는다. 기준 시각은 10분 단위로 올리고, 간격도 10분 단위 */
export function pickScheduleTimes({ start, count, minGapMin = 180, maxGapMin = 240, random = Math.random }: ScheduleOptions) {
  const step = SCHEDULE_STEP_MIN;
  // 최소·최대를 거꾸로 줘도 동작하게
  const low = Math.ceil(Math.min(minGapMin, maxGapMin) / step);
  const high = Math.floor(Math.max(minGapMin, maxGapMin) / step);
  let time = Math.ceil(start / step) * step;
  const times: number[] = [];
  while (times.length < count) {
    time += randomInt(low, Math.max(low, high), random) * step;
    times.push(time);
  }
  return times;
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** 기준 날짜(YYYY-MM-DD) + 분 → "11월 4일(수) 14:30" */
export function formatScheduleTime(date: string, minutes: number) {
  const day = new Date(`${date}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + Math.floor(minutes / 1440));
  const rest = minutes % 1440;
  const hh = String(Math.floor(rest / 60)).padStart(2, "0");
  const mm = String(rest % 60).padStart(2, "0");
  return `${day.getUTCMonth() + 1}월 ${day.getUTCDate()}일(${WEEKDAYS[day.getUTCDay()]}) ${hh}:${mm}`;
}

/** "지금부터": 오늘 날짜와 지금 다음의 10분 단위 시각 (그날 23:50을 넘기지 않는다) */
export function nowStart(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const next = Math.min(Math.ceil((now.getHours() * 60 + now.getMinutes() + 1) / SCHEDULE_STEP_MIN) * SCHEDULE_STEP_MIN, 23 * 60 + 50);
  return {
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    start: `${pad(Math.floor(next / 60))}:${pad(next % 60)}`,
    minutes: next,
  };
}

/** 기준 날짜(YYYY-MM-DD) + 분 → 실제 시각 (지금 시간대 기준. 지난 예약·다음 예약을 가리는 데 쓴다) */
export function scheduleDate(date: string, minutes: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y!, m! - 1, d!, 0, minutes);
}
