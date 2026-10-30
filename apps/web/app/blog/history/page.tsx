import {
  indexDraftsByKeyword,
  kstNow,
  listDates,
  listDrafts,
  normalizeKeyword,
  readDay,
  readRange,
  searchAdConfigFromEnv,
  sortDayKeywords,
  type DayKeyword,
  type DaySort,
  type DraftSummary,
  type RangeKeyword,
} from "@toolhub/collector";
import Link from "next/link";
import { DATA_DIR, DRAFTS_DIR } from "../../../lib/data";
import { SOURCE_LABELS } from "../../../lib/labels";
import { CopyBriefButton, PlatformSelect, StructureSelect, WritingTypeSelect } from "../brief-copy";
import { DateSelect } from "../date-select";
import { CompetitionBadge, formatSearches, SearchAdNotice } from "../search-ad";
import { StatsEnricher } from "./stats-enricher";

export const dynamic = "force-dynamic";

const RANGES = [1, 7, 30] as const;
type Range = (typeof RANGES)[number];

/** 하루 보기: 최근 순·검색량 순, 여러 날 보기: 등장 일수 순이 추가된다 */
type SortKey = DaySort | "days";

type DraftIndex = Map<string, DraftSummary[]>;

function historyHref({ date, range, sort }: { date: string | null; range: Range; sort: SortKey | null }) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  if (range !== 1) params.set("range", String(range));
  if (sort) params.set("sort", sort);
  const query = params.toString();
  return query ? `/blog/history?${query}` : "/blog/history";
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; sort?: string; range?: string }>;
}) {
  const today = kstNow().date;
  const { date = today, sort: sortParam, range: rangeParam } = await searchParams;
  const range: Range = RANGES.find((r) => String(r) === rangeParam) ?? 1;
  const defaultSort: SortKey = range === 1 ? "recent" : "days";
  const sort: SortKey = sortParam === "search" || sortParam === "recent" || (sortParam === "days" && range > 1) ? sortParam : defaultSort;

  const searchAd = searchAdConfigFromEnv();
  const [day, rangeRows, dates, drafts] = await Promise.all([
    readDay(DATA_DIR, date),
    range > 1 ? readRange(DATA_DIR, date, range) : null,
    listDates(DATA_DIR),
    listDrafts(DRAFTS_DIR),
  ]);
  // 검색량을 모르는 키워드는 렌더링을 기다리게 하지 않고 StatsEnricher가 뒤에서 채운다 (기준 날짜만)
  const missingStats = searchAd ? (day?.keywords.filter((k) => k.stats === undefined).length ?? 0) : 0;
  const draftIndex = indexDraftsByKeyword(drafts);
  const count = range === 1 ? (day?.keywords.length ?? 0) : (rangeRows?.length ?? 0);
  const linkDate = date === today ? null : date;

  return (
    <main>
      <header>
        <h1>
          키워드 기록 <small>{count}개</small>
        </h1>
        <DateSelect dates={dates} value={date} today={today} range={range} />
        <WritingTypeSelect />
        <StructureSelect />
        <PlatformSelect />
      </header>

      <SearchAdNotice configured={!!searchAd} />
      <StatsEnricher key={date} date={date} missing={missingStats} />

      <section>
        <h2>
          {range === 1
            ? date === today
              ? "오늘 뜬 키워드"
              : `${date}에 뜬 키워드`
            : `${date}까지 최근 ${range}일 동안 뜬 키워드`}
          <span className="sort">
            {RANGES.map((r) => (
              <Link key={r} href={historyHref({ date: linkDate, range: r, sort: null })} className={r === range ? "active" : undefined}>
                {r === 1 ? "하루" : `${r}일`}
              </Link>
            ))}
            <span className="divider">|</span>
            {range > 1 && (
              <Link href={historyHref({ date: linkDate, range, sort: "days" })} className={sort === "days" ? "active" : undefined}>
                등장 일수 순
              </Link>
            )}
            <Link href={historyHref({ date: linkDate, range, sort: "recent" })} className={sort === "recent" ? "active" : undefined}>
              최근 순
            </Link>
            <Link href={historyHref({ date: linkDate, range, sort: "search" })} className={sort === "search" ? "active" : undefined}>
              검색량 순
            </Link>
          </span>
        </h2>

        {range > 1 && (
          <p className="notice">
            실시간 키워드는 날마다 대부분 바뀝니다. 여러 날 연속으로 뜬 키워드(<span className="persist 지속">지속</span>)는 반짝
            이슈가 아니라 관심이 이어지는 주제일 가능성이 높아 글감으로 눈여겨볼 만합니다.
          </p>
        )}

        {count === 0 ? (
          <p className="empty">
            기록이 없습니다. <Link href="/blog">실시간</Link> 페이지를 열면 그날 기록이 쌓입니다.
          </p>
        ) : range === 1 ? (
          <DayTable rows={sortDayKeywords(day!.keywords, sort === "days" ? "recent" : sort)} drafts={draftIndex} />
        ) : (
          <RangeTable rows={sortRange(rangeRows!, sort)} drafts={draftIndex} />
        )}
      </section>
    </main>
  );
}

function sortRange(rows: RangeKeyword[], sort: SortKey) {
  const searches = (r: RangeKeyword) => r.stats?.totalSearches ?? -1;
  return [...rows].sort((a, b) => {
    if (sort === "search") return searches(b) - searches(a);
    if (sort === "recent") return b.lastDate.localeCompare(a.lastDate) || searches(b) - searches(a);
    return b.dates.length - a.dates.length || searches(b) - searches(a);
  });
}

const shortDate = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

function persistence(days: number) {
  if (days >= 3) return { label: "지속", className: "지속" };
  if (days === 2) return { label: "2일", className: "이틀" };
  return { label: "하루", className: "하루" };
}

function DraftCell({ keyword, drafts }: { keyword: string; drafts: DraftIndex }) {
  const found = drafts.get(normalizeKeyword(keyword));
  if (!found?.length) return null;
  return (
    <Link href={`/blog/drafts/view?file=${encodeURIComponent(found[0]!.file)}`} title={found.map((d) => d.file).join("\n")} className="has-draft">
      ✓{found.length > 1 ? ` ${found.length}` : ""}
    </Link>
  );
}

function KeywordCells({ keyword }: { keyword: string }) {
  return (
    <>
      <td>
        <CopyBriefButton keyword={keyword} compact />
      </td>
      <td className="keyword">
        <Link href={`/blog/keyword?q=${encodeURIComponent(keyword)}`}>{keyword}</Link>
      </td>
    </>
  );
}

function RelatedCell({ related, url }: { related: string | null; url: string | null }) {
  return (
    <td className="related">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {related ?? "기사"}
        </a>
      ) : (
        related
      )}
    </td>
  );
}

function DayTable({ rows, drafts }: { rows: DayKeyword[]; drafts: DraftIndex }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th title="선택한 유형·구성·플랫폼으로 글쓰기 브리프 복사">✍</th>
            <th>키워드</th>
            <th title="이 키워드로 쓴 초안">초안</th>
            <th>처음 본 시각</th>
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
              <KeywordCells keyword={r.keyword} />
              <td>
                <DraftCell keyword={r.keyword} drafts={drafts} />
              </td>
              <td>{r.firstSeen}</td>
              <td className="num">{r.stats === undefined ? "" : formatSearches(r.stats?.totalSearches)}</td>
              <td>{r.stats && <CompetitionBadge value={r.stats.competition} />}</td>
              <td>{r.sources.map((s) => SOURCE_LABELS[s]).join(", ")}</td>
              <td>{r.bestRank}</td>
              <td>{r.maxTraffic ? `${r.maxTraffic.toLocaleString()}+` : ""}</td>
              <RelatedCell related={r.related} url={r.url} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RangeTable({ rows, drafts }: { rows: RangeKeyword[]; drafts: DraftIndex }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th title="선택한 유형·구성·플랫폼으로 글쓰기 브리프 복사">✍</th>
            <th>키워드</th>
            <th title="이 키워드로 쓴 초안">초안</th>
            <th>등장</th>
            <th>기간</th>
            <th className="num">월간 검색량</th>
            <th>경쟁도</th>
            <th>소스</th>
            <th>관련 (가장 최근)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const p = persistence(r.dates.length);
            return (
              <tr key={r.keyword}>
                <KeywordCells keyword={r.keyword} />
                <td>
                  <DraftCell keyword={r.keyword} drafts={drafts} />
                </td>
                <td title={r.dates.join(", ")}>
                  <span className={`persist ${p.className}`}>{p.label}</span>
                  {r.dates.length >= 3 && <small> {r.dates.length}일</small>}
                </td>
                <td>{r.firstDate === r.lastDate ? shortDate(r.firstDate) : `${shortDate(r.firstDate)}~${shortDate(r.lastDate)}`}</td>
                <td className="num">{r.stats === undefined ? "" : formatSearches(r.stats?.totalSearches)}</td>
                <td>{r.stats && <CompetitionBadge value={r.stats.competition} />}</td>
                <td>{r.sources.map((s) => SOURCE_LABELS[s]).join(", ")}</td>
                <RelatedCell related={r.related} url={r.url} />
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
