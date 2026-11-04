/** 뽑은 예약 발행 시간을 브라우저에 기억한다. 예약 발행 화면이 쓰고, 사이드 메뉴가 늘 보여 준다 */

const STORAGE_KEY = "toolhub:schedule-times";
/** 같은 탭에서 저장했을 때 사이드 메뉴에 알리는 이벤트 (storage 이벤트는 다른 탭에만 온다) */
export const SAVED_EVENT = "toolhub:schedule-times";

export interface SavedSchedule {
  /** 기준 날짜 YYYY-MM-DD */
  date: string;
  /** 바로 올린 시각 HH:MM */
  start: string;
  count: number;
  minGap: number;
  maxGap: number;
  /** 기준 날짜 0시부터의 분 */
  times: number[];
}

export function readSaved(): SavedSchedule | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as SavedSchedule | null;
    return saved && typeof saved.date === "string" && Array.isArray(saved.times) ? saved : null;
  } catch {
    return null;
  }
}

export function writeSaved(saved: SavedSchedule) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    window.dispatchEvent(new Event(SAVED_EVENT));
  } catch {
    // 기억 못 해도 이번 화면에서는 동작한다
  }
}
