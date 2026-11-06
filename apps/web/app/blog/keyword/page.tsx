import {
  briefKey,
  computeSaturation,
  fetchDailyTrends,
  fetchKeywordInsight,
  findPivots,
  formatSurge,
  hasOpenPivot,
  needsPivot,
  summarizeSurge,
  formatWritingBrief,
  hubConfigFromEnv,
  kstNow,
  PLATFORMS,
  rankByRelevance,
  researchKeyword,
  searchAdConfigFromEnv,
  seasonAlertDate,
  WRITING_TYPES,
  type KeywordResearch,
  type KeywordStat,
  type PivotRow,
  type Saturation,
} from "@toolhub/collector";
import Link from "next/link";
import { AddTaskPopover } from "../../add-task-popover";
import { CopyBriefButton, PlatformSelect, StructureSelect, WritingTypeSelect } from "../brief-copy";
import { CompetitionBadge, formatSearches, SearchAdNotice } from "../search-ad";
import { TrendChart } from "./trend-chart";

export const dynamic = "force-dynamic";

/** 연관 키워드가 천 개 넘게 오기도 해서 상위만 보여준다 */
const MAX_RELATED = 100;

const SATURATION_HELP =
  "블로그 문서 수 ÷ 월간 검색량. 10배 이하 기회, 50배 이하 보통, 그 이상 높음. 비율과 상관없이 문서 2만 개 이상은 보통부터, 10만 개 이상은 높음 (글이 적은 블로그 기준)";
const SURGE_HELP = "최근 7일 검색 ÷ 그 전 4주 평균 (일간 추이). 2배 이상 급상승, 1.3배 이상 상승";
const AD_COMPETITION_HELP = "검색광고 입찰 경쟁입니다. 블로그 노출 경쟁은 블로그 문서 수·포화도로 봅니다";

export default async function KeywordPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const keyword = q.trim();
  const searchAd = searchAdConfigFromEnv();
  const hub = hubConfigFromEnv();

  // self: 조회한 키워드 자신의 수치 (맨 위 카드), others: 연관 키워드
  let self: KeywordStat | null | undefined;
  let others: KeywordStat[] = [];
  let tokens: string[] = [];
  let error: string | null = null;
  let research: KeywordResearch | null = null;
  let daily: Awaited<ReturnType<typeof fetchDailyTrends>> | null = null;
  if (keyword) {
    // 검색광고와 API HUB를 동시에 조회한다
    const [insight, hubResult, dailyResult] = await Promise.all([
      searchAd ? fetchKeywordInsight(searchAd, keyword).catch((e: unknown) => (e instanceof Error ? e.message : String(e))) : null,
      hub ? researchKeyword(hub, keyword).catch(() => null) : null,
      hub ? fetchDailyTrends(hub, [keyword]).catch(() => null) : null,
    ]);
    if (typeof insight === "string") error = insight;
    else if (insight) ({ self, related: others, tokens } = insight);
    research = hubResult;
    daily = dailyResult;
  }
  const saturation = computeSaturation(self?.totalSearches, research?.blog?.total);
  const points = daily?.get(keyword);
  const surge = points ? summarizeSurge(points) : null;
  // 대표 키워드 경쟁이 세면 연관어로 돌릴 후보를 찾는다 (경쟁 글 수까지 조회해서 조금 더 걸린다)
  const pivots: PivotRow[] | undefined =
    searchAd && needsPivot(saturation) ? await findPivots({ searchAd, hub }, keyword, { related: others }).catch(() => []) : undefined;

  // 플랫폼·유형을 바꿔도 바로 복사되도록 모든 조합의 브리프를 미리 만들어 둔다
  const ranked = rankByRelevance(others, tokens);
  const briefs = Object.fromEntries(
    PLATFORMS.flatMap((platform) =>
      WRITING_TYPES.map((type) => [briefKey(platform, type), formatWritingBrief({ platform, type, keyword, self, related: ranked, research, surge, pivots })]),
    ),
  );

  return (
    <main>
      <header>
        <h1>키워드 분석</h1>
      </header>

      <form className="search" action="/blog/keyword">
        <input name="q" defaultValue={keyword} placeholder="분석할 키워드 (예: 캠핑, 연말정산)" autoFocus={!keyword} />
        <button type="submit" className="button primary">
          조회
        </button>
        {keyword && (
          <>
            <a className="button" href={`https://search.naver.com/search.naver?query=${encodeURIComponent(keyword)}`} target="_blank" rel="noreferrer">
              네이버 검색
            </a>
            <a className="button" href={`https://www.google.com/search?q=${encodeURIComponent(keyword)}`} target="_blank" rel="noreferrer">
              구글 검색
            </a>
          </>
        )}
      </form>

      {keyword && (
        <div className="brief-bar card">
          <span>
            <strong>글쓰기</strong> <small>브리프를 복사해 claude.ai 프로젝트에 붙여넣으면 초안이 나옵니다</small>
          </span>
          <WritingTypeSelect />
          <StructureSelect />
          <PlatformSelect />
          <CopyBriefButton keyword={keyword} briefs={briefs} />
          <AddTaskPopover text={`${keyword} 글 쓰기 내일`} defaults={{ link: keywordHref(keyword) }} title="글 쓰기 할 일로 추가" />
        </div>
      )}

      <SearchAdNotice configured={!!searchAd} error={error} />
      {keyword && !hub && (
        <p className="notice">
          NAVER API HUB 키(<code>NAVER_API_HUB_CLIENT_ID</code>, <code>NAVER_API_HUB_CLIENT_SECRET</code>)를{" "}
          <code>apps/web/.env.local</code>에 넣으면 검색 추이·블로그 문서 수·실제 질문·상위 글이 표시됩니다.
        </p>
      )}

      {keyword && (searchAd || research) && (
        <div className="stat-cards">
          {searchAd && !error && (
            <>
              <StatCard label="월간 검색량" value={self ? formatSearches(self.totalSearches) : "-"} />
              <StatCard label="광고 경쟁도" hint={AD_COMPETITION_HELP} value={self ? <CompetitionBadge value={self.competition} /> : "-"} />
            </>
          )}
          {research?.trend && <StatCard label="검색 추이" value={research.trend.label} />}
          {surge && surge.label !== "데이터 부족" && <StatCard label="최근 7일" hint={SURGE_HELP} value={formatSurge(surge)} />}
          {research?.blog && <StatCard label="블로그 문서 수" value={research.blog.total.toLocaleString()} />}
          {saturation && (
            <StatCard
              label="포화도"
              hint={SATURATION_HELP}
              value={<SaturationBadge saturation={saturation} />}
            />
          )}
          {searchAd && !error && self && (
            <>
              <StatCard label="PC / 모바일" value={`${formatSearches(self.pcSearches)} / ${formatSearches(self.mobileSearches)}`} />
              <StatCard label="월평균 클릭" value={self.monthlyClicks.toLocaleString()} />
            </>
          )}
        </div>
      )}

      {pivots && <PivotSection keyword={keyword} pivots={pivots} />}

      {research && <ResearchSections research={research} keyword={keyword} />}

      {searchAd && keyword && !error && (
        <section>
          <h2>
            &ldquo;{keyword}&rdquo; 연관 키워드{" "}
            <small>
              {others.length > MAX_RELATED ? `${others.length}개 중 상위 ${MAX_RELATED}개` : `${others.length}개`} · 네이버
              월간 검색량 많은 순{tokens.length > 1 && " · 각 단어의 연관 키워드 포함"}
            </small>
          </h2>
          {others.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>키워드</th>
                    <th className="num">합계</th>
                    <th className="num">PC</th>
                    <th className="num">모바일</th>
                    <th title={AD_COMPETITION_HELP}>광고 경쟁도</th>
                    <th className="num">월평균 클릭</th>
                  </tr>
                </thead>
                <tbody>
                  {others.slice(0, MAX_RELATED).map((r) => (
                    <tr key={r.keyword}>
                      <td className="keyword">
                        <Link href={`/blog/keyword?q=${encodeURIComponent(r.keyword)}`}>{r.keyword}</Link>
                      </td>
                      <td className="num">{formatSearches(r.totalSearches)}</td>
                      <td className="num">{formatSearches(r.pcSearches)}</td>
                      <td className="num">{formatSearches(r.mobileSearches)}</td>
                      <td>
                        <CompetitionBadge value={r.competition} />
                      </td>
                      <td className="num">{r.monthlyClicks.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty">연관 키워드가 없습니다. 뉴스 제목처럼 긴 문장은 짧은 핵심어로 다시 검색해 보세요.</p>
          )}
        </section>
      )}
    </main>
  );
}

function SaturationBadge({ saturation }: { saturation: Saturation }) {
  return (
    <span className={`saturation ${saturation.level}`} title={saturation.cap ?? undefined}>
      {saturation.level} <small>{saturation.ratio}배</small>
    </span>
  );
}

/** 대표 키워드 경쟁이 셀 때: 검색량은 적당하고 경쟁 글이 적은 연관어 (누르면 그 키워드로 다시 분석) */
function PivotSection({ keyword, pivots }: { keyword: string; pivots: PivotRow[] }) {
  return (
    <section>
      <h2>
        연관어로 돌리기{" "}
        <small>
          {hasOpenPivot(pivots)
            ? `“${keyword}”는 경쟁 글이 많아요. 포화도 기회인 연관어를 메인 키워드로 쓰면 글이 적은 블로그도 상위에 오르기 쉬워요`
            : pivots.length
              ? "연관어도 모두 경쟁이 세요. 쓴다면 경쟁 글이 가장 적은 키워드로 제목을 구체적으로 좁혀요"
              : "돌릴 만한 연관어를 찾지 못했어요 (건강·의료 키워드는 검색광고가 연관어를 거의 주지 않아요)"}
        </small>
      </h2>
      {pivots.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>키워드</th>
                <th className="num">월간 검색량</th>
                <th className="num">블로그 문서 수</th>
                <th title={SATURATION_HELP}>포화도</th>
                <th title={SURGE_HELP}>최근 7일</th>
              </tr>
            </thead>
            <tbody>
              {pivots.map((p) => (
                <tr key={p.keyword}>
                  <td className="keyword">
                    <Link href={keywordHref(p.keyword)}>{p.keyword}</Link>
                  </td>
                  <td className="num">{formatSearches(p.searches)}</td>
                  <td className="num">{p.blogTotal === null ? "-" : p.blogTotal.toLocaleString()}</td>
                  <td>{p.saturation ? <SaturationBadge saturation={p.saturation} /> : "-"}</td>
                  <td>{formatSurge(p.surge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="card stat-card" title={hint}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

const keywordHref = (keyword: string) => `/blog/keyword?q=${encodeURIComponent(keyword)}`;

function ResearchSections({ research, keyword }: { research: KeywordResearch; keyword: string }) {
  const { trend, blog, kin, news, cafe, places, errors } = research;
  const failed = Object.entries(errors);
  // 시즌 키워드면 다음 시즌 5주 전에 글을 준비하도록 알림 할 일을 제안한다
  const season = trend?.label === "시즌" && trend.peakMonth ? seasonAlertDate(trend.peakMonth, kstNow().date) : null;
  return (
    <>
      {trend && trend.label !== "데이터 부족" && (
        <section>
          <h2>
            검색 추이 <small>{trend.reason}</small>
            {season && (
              <span className="sort">
                <AddTaskPopover
                  text={`${keyword} 시즌 글 준비 ${season.alertDate}`}
                  defaults={{ link: keywordHref(keyword), notes: `${season.seasonStart.slice(0, 7)} 시즌 시작 전에 글을 올려 검색에 노출되도록 준비` }}
                  label="시즌 전 알림"
                  title={`시즌 전 알림 만들기 (${Number(season.seasonStart.slice(5, 7))}월 시즌 5주 전)`}
                />
              </span>
            )}
          </h2>
          <div className="card">
            <TrendChart points={trend.points} title="최근 24개월 네이버 검색 추이 (기간 중 최고 = 100)" />
          </div>
        </section>
      )}

      <div className="research-grid">
        {kin && kin.length > 0 && (
          <section className="card">
            <h3>
              실제 질문 <small>지식iN</small>
            </h3>
            <ul className="link-list">
              {kin.map((q) => (
                <li key={q.link}>
                  <a href={q.link} target="_blank" rel="noreferrer">
                    {q.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        {blog && blog.items.length > 0 && (
          <section className="card">
            <h3>
              상위 블로그 글 <small>겹치지 않는 각도 잡기용</small>
            </h3>
            <ul className="link-list">
              {blog.items.map((b) => (
                <li key={b.link}>
                  <a href={b.link} target="_blank" rel="noreferrer">
                    {b.title}
                  </a>
                  <small>
                    {b.blogger} · {b.date}
                  </small>
                </li>
              ))}
            </ul>
          </section>
        )}

        {news && news.length > 0 && (
          <section className="card">
            <h3>
              최신 뉴스 <small>왜 뜨는지 맥락</small>
            </h3>
            <ul className="link-list">
              {news.map((n) => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noreferrer">
                    {n.title}
                  </a>
                  <small>{n.date.slice(0, 10)}</small>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cafe && cafe.length > 0 && (
          <section className="card">
            <h3>
              카페 글 <small>실제 후기·고민</small>
            </h3>
            <ul className="link-list">
              {cafe.map((c) => (
                <li key={c.link}>
                  <a href={c.link} target="_blank" rel="noreferrer">
                    {c.title}
                  </a>
                  <small>{c.cafe}</small>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {places && places.length > 0 && (
        <details className="raw">
          <summary>장소 검색 결과 {places.length}개 (장소 유형 글에 쓰임)</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>이름</th>
                  <th>분류</th>
                  <th>도로명 주소</th>
                </tr>
              </thead>
              <tbody>
                {places.map((p) => (
                  <tr key={`${p.title}-${p.roadAddress}`}>
                    <td className="keyword">{p.link ? <a href={p.link} target="_blank" rel="noreferrer">{p.title}</a> : p.title}</td>
                    <td>{p.category}</td>
                    <td>{p.roadAddress || p.address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {failed.length > 0 && (
        <p className="notice error">
          일부 조회 실패: {failed.map(([name, message]) => `${name} (${message.slice(0, 80)})`).join(", ")}
        </p>
      )}
    </>
  );
}
