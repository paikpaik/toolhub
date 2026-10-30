import {
  enrichDayWithStats,
  kstNow,
  listDates,
  readDay,
  searchAdConfigFromEnv,
  sortDayKeywords,
  type DayKeyword,
  type DaySort,
} from "@toolhub/collector";
import Link from "next/link";
import { DATA_DIR } from "../../lib/data";
import { SOURCE_LABELS } from "../../lib/labels";
import { CopyBriefButton, PlatformSelect, StructureSelect, WritingTypeSelect } from "../brief-copy";
import { DateSelect } from "../date-select";
import { CompetitionBadge, formatSearches, SearchAdNotice } from "../search-ad";

export const dynamic = "force-dynamic";

type SortKey = DaySort;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sort?: string }>;
}) {
  const today = kstNow().date;
  const { date = today, sort: sortParam } = await searchParams;
  const sort: SortKey = sortParam === "search" ? "search" : "recent";

  // 키가 설정돼 있으면 검색량을 아직 모르는 키워드만 조회해 채운다
  const searchAd = searchAdConfigFromEnv();
  const enriched = searchAd ? await enrichDayWithStats(DATA_DIR, date, searchAd) : null;

  const [day, dates] = await Promise.all([readDay(DATA_DIR, date), listDates(DATA_DIR)]);

  return (
    <main>
      <header>
        <h1>
          키워드 기록 <small>{day?.keywords.length ?? 0}개</small>
        </h1>
        <DateSelect dates={dates} value={date} today={today} />
        <WritingTypeSelect />
        <StructureSelect />
        <PlatformSelect />
      </header>

      <SearchAdNotice configured={!!searchAd} error={enriched?.error} />
      {enriched && enriched.remaining > 0 && !enriched.error && (
        <p className="notice">
          검색량을 아직 조회하지 않은 키워드가 {enriched.remaining}개 남았습니다. 호출 한도 때문에 나눠서 조회하니
          새로고침하면 이어서 조회합니다.
        </p>
      )}

      <section>
        <h2>
          {date === today ? "오늘 뜬 키워드" : `${date}에 뜬 키워드`}
          <span className="sort">
            <SortLink date={date === today ? null : date} sort="recent" current={sort}>
              최근 순
            </SortLink>
            <SortLink date={date === today ? null : date} sort="search" current={sort}>
              검색량 순
            </SortLink>
          </span>
        </h2>
        {day?.keywords.length ? (
          <DayTable rows={sortDayKeywords(day.keywords, sort)} />
        ) : (
          <p className="empty">
            기록이 없습니다. <Link href="/">실시간</Link> 페이지를 열면 그날 기록이 쌓입니다.
          </p>
        )}
      </section>
    </main>
  );
}

function SortLink({
  date,
  sort,
  current,
  children,
}: {
  date: string | null;
  sort: SortKey;
  current: SortKey;
  children: React.ReactNode;
}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (sort !== "recent") params.set("sort", sort);
  const query = params.toString();
  return (
    <Link href={query ? `/history?${query}` : "/history"} className={sort === current ? "active" : undefined}>
      {children}
    </Link>
  );
}

function DayTable({ rows }: { rows: DayKeyword[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th title="선택한 플랫폼용 글쓰기 브리프 복사">✍</th>
            <th>처음 본 시각</th>
            <th>키워드</th>
            <th className="num">월간 검색량</th>
            <th>경쟁도</th>
            <th>소스</th>
            <th>최고순위</th>
            <th>구글 트래픽</th>
            <th>관련</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.keyword}>
              <td>
                <CopyBriefButton keyword={r.keyword} compact />
              </td>
              <td>{r.firstSeen}</td>
              <td className="keyword">
                <Link href={`/keyword?q=${encodeURIComponent(r.keyword)}`}>{r.keyword}</Link>
              </td>
              <td className="num">{r.stats === undefined ? "" : formatSearches(r.stats?.totalSearches)}</td>
              <td>{r.stats && <CompetitionBadge value={r.stats.competition} />}</td>
              <td>{r.sources.map((s) => SOURCE_LABELS[s]).join(", ")}</td>
              <td>{r.bestRank}</td>
              <td>{r.maxTraffic ? `${r.maxTraffic.toLocaleString()}+` : ""}</td>
              <td className="related">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    {r.related ?? "기사"}
                  </a>
                ) : (
                  r.related
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
