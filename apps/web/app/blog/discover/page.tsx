import {
  discoverKeywords,
  formatTrendCell,
  hubConfigFromEnv,
  indexDraftsByKeyword,
  kstNow,
  listDrafts,
  MAX_SEARCHES,
  MAX_TOPICS,
  MIN_SEARCHES,
  normalizeKeyword,
  parseTopics,
  readRecentTopics,
  saveRecentTopic,
  searchAdConfigFromEnv,
  type DiscoverResult,
} from "@toolhub/collector";
import Link from "next/link";
import { DATA_DIR, DRAFTS_DIR } from "../../../lib/data";
import { formatSearches, SearchAdNotice } from "../search-ad";

export const dynamic = "force-dynamic";

const PICK_HELP = "포화도 기회(검색량 대비 글이 적음)이면서 검색 추이가 하락세·반짝 이슈가 아닌 키워드";

const discoverHref = (topics: string) => `/blog/discover?q=${encodeURIComponent(topics)}`;

export default async function DiscoverPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const topics = parseTopics(q);
  const searchAd = searchAdConfigFromEnv();
  const hub = hubConfigFromEnv();

  let result: DiscoverResult | null = null;
  let error: string | null = null;
  let recent: string[];
  if (searchAd && topics.length) {
    const index = indexDraftsByKeyword(await listDrafts(DRAFTS_DIR));
    try {
      result = await discoverKeywords({ searchAd, hub }, topics, kstNow().date, (k) => (index.get(normalizeKeyword(k)) ?? []).map((d) => d.file));
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    recent = result ? await saveRecentTopic(DATA_DIR, topics.join(", ")).catch(() => readRecentTopics(DATA_DIR)) : await readRecentTopics(DATA_DIR);
  } else {
    recent = await readRecentTopics(DATA_DIR);
  }
  const picks = result?.rows.filter((r) => r.pick).length ?? 0;

  return (
    <main>
      <header>
        <h1>
          키워드 찾기 <small>내 주제에서 꾸준히 검색되고 글이 아직 적은 키워드</small>
        </h1>
      </header>

      <form className="search" action="/blog/discover">
        <input name="q" defaultValue={topics.join(", ")} placeholder={`주제 (쉼표로 최대 ${MAX_TOPICS}개, 예: 캠핑, 연말정산)`} autoFocus={!topics.length} />
        <button type="submit" className="button primary">
          찾기
        </button>
      </form>
      {recent.length > 0 && (
        <div className="recent-topics">
          <span className="muted">최근</span>
          {recent.map((t) => (
            <Link key={t} href={discoverHref(t)} className="chip">
              {t}
            </Link>
          ))}
        </div>
      )}

      <SearchAdNotice configured={!!searchAd} error={error} />
      {searchAd && !hub && (
        <p className="notice">
          NAVER API HUB 키(<code>NAVER_API_HUB_CLIENT_ID</code>, <code>NAVER_API_HUB_CLIENT_SECRET</code>)를{" "}
          <code>apps/web/.env.local</code>에 넣어야 검색 추이·포화도로 추천할 수 있습니다. 지금은 검색량만 보여줍니다.
        </p>
      )}

      {result && (
        <section>
          <h2>
            {topics.join(", ")} <small>{summary(result)}</small>
          </h2>
          {result.rows.length === 0 ? (
            <p className="empty">조건에 맞는 키워드가 없습니다. 더 넓은 주제어로 찾아보세요.</p>
          ) : (
            <>
              {hub && picks === 0 && (
                <p className="notice">추천할 만큼 글이 적은 키워드가 없습니다. 주제를 더 좁혀 보세요 (예: 캠핑 → 차박, 캠핑요리).</p>
              )}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>키워드</th>
                      <th className="num">월간 검색량</th>
                      <th>검색 추이</th>
                      <th className="num">블로그 문서 수</th>
                      <th>포화도</th>
                      <th>초안</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((r) => (
                      <tr key={r.keyword}>
                        <td className="keyword">
                          {r.pick && (
                            <span className="pick" title={PICK_HELP}>
                              추천
                            </span>
                          )}
                          <Link href={`/blog/keyword?q=${encodeURIComponent(r.keyword)}`}>{r.keyword}</Link>
                        </td>
                        <td className="num">{formatSearches(r.stats?.totalSearches)}</td>
                        <td>
                          {formatTrendCell(r.trend)}
                          {r.seasonSoon && (
                            <span className="badge new" title="시즌 정점이 1~3달 뒤라 지금 쓰면 시즌에 맞춰 노출됩니다">
                              {" "}
                              곧 시즌
                            </span>
                          )}
                        </td>
                        <td className="num">{r.blogTotal?.toLocaleString() ?? "-"}</td>
                        <td>
                          {r.saturation ? (
                            <span className={`saturation ${r.saturation.level}`}>
                              {r.saturation.level} <small>{r.saturation.ratio}배</small>
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>
                          {r.drafts.length > 0 && (
                            <Link href={`/blog/drafts/view?file=${encodeURIComponent(r.drafts[0]!)}`} title={r.drafts.join("\n")} className="has-draft">
                              ✓{r.drafts.length > 1 ? ` ${r.drafts.length}` : ""}
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted discover-help">키워드를 누르면 키워드 분석으로 넘어가 상위 글·실제 질문을 확인하고 글쓰기 브리프를 복사할 수 있습니다.</p>
            </>
          )}
        </section>
      )}
    </main>
  );
}

function summary({ rows, matched }: DiscoverResult) {
  const range = `월 ${MIN_SEARCHES.toLocaleString()}~${MAX_SEARCHES.toLocaleString()}회 검색되는 연관 키워드 ${matched}개`;
  const picks = rows.filter((r) => r.pick).length;
  return `${range}${matched > rows.length ? ` 중 정보형 우선 ${rows.length}개` : ""} · 추천 ${picks}개`;
}
