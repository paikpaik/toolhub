/** 초안 목록의 작성일 거르기: 여러 날을 고르고, 다른 화면에 다녀와도 기억한다 (브라우저 localStorage) */

export const DRAFT_DATES_KEY = "toolhub:draft-dates";

/** 고른 날이면 빼고, 아니면 넣는다 (날짜 순) */
export function toggleDate(dates: string[], date: string) {
  return dates.includes(date) ? dates.filter((d) => d !== date) : [...dates, date].sort();
}

/** 기억해 둔 값에서 지금 초안이 있는 날만 (초안을 지운 날이 남아 목록이 비지 않게) */
export function parseSavedDates(raw: string | null, known: Set<string>) {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? [...new Set(value.filter((d): d is string => typeof d === "string" && known.has(d)))].sort() : [];
  } catch {
    return [];
  }
}
