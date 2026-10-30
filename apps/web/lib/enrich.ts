import { enrichDayWithStats, searchAdConfigFromEnv } from "@toolhub/collector";
import { DATA_DIR } from "./data";

type EnrichResult = Awaited<ReturnType<typeof enrichDayWithStats>>;

/**
 * 진행 중인 검색량 채우기 (날짜별). 탭을 여러 개 열거나 실시간·키워드 기록이 동시에 요청해도
 * 같은 날짜는 한 번만 돌게 해서 검색광고 API 한도를 아낀다.
 * 페이지와 API 라우트가 서로 다른 모듈 인스턴스로 번들될 수 있어 globalThis에 둔다.
 */
const g = globalThis as typeof globalThis & { __toolhubEnrich?: Map<string, Promise<EnrichResult>> };
const inflight = (g.__toolhubEnrich ??= new Map());

/** 검색량을 모르는 키워드를 채운다. 이미 같은 날짜를 채우는 중이면 그 결과를 기다린다. 키가 없으면 null */
export function enrichDate(date: string): Promise<EnrichResult> | null {
  const config = searchAdConfigFromEnv();
  if (!config) return null;
  let task = inflight.get(date);
  if (!task) {
    task = enrichDayWithStats(DATA_DIR, date, config).finally(() => inflight.delete(date));
    inflight.set(date, task);
  }
  return task;
}

/** 기다리지 않고 뒤에서 채우기 시작한다 (실시간 페이지에서 새 키워드를 기록한 직후) */
export function enrichInBackground(date: string) {
  enrichDate(date)?.catch(() => {
    // 실패하면 키워드 기록 페이지가 다시 시도하고 오류를 보여준다
  });
}
