import {
  fetchRelatedKeywords,
  normalizeKeyword,
  searchAdConfigFromEnv,
  toHintKeyword,
  type KeywordStat,
} from "@toolhub/collector";
import Link from "next/link";
import { CompetitionBadge, formatSearches, SearchAdNotice } from "../search-ad";

export const dynamic = "force-dynamic";

/** 연관 키워드가 천 개 넘게 오기도 해서 상위만 보여준다 */
const MAX_RELATED = 100;

export default async function KeywordPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const keyword = q.trim();
  const searchAd = searchAdConfigFromEnv();

  let related: KeywordStat[] = [];
  let error: string | null = null;
  if (searchAd && keyword) {
    try {
      related = await fetchRelatedKeywords(searchAd, [keyword]);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }
  // 응답에는 조회한 키워드 자신도 섞여 있으므로 따로 꺼내 맨 위에 보여준다
  const selfKey = normalizeKeyword(toHintKeyword(keyword));
  const self = related.find((r) => normalizeKeyword(r.keyword) === selfKey);
  const others = related.filter((r) => r !== self);

  return (
    <main>
      <header>
        <h1>키워드 분석</h1>
      </header>

      <form className="search" action="/keyword">
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

      <SearchAdNotice configured={!!searchAd} error={error} />

      {searchAd && keyword && !error && (
        <div className="stat-cards">
          <StatCard label="월간 검색량" value={self ? formatSearches(self.totalSearches) : "-"} />
          <StatCard label="PC" value={self ? formatSearches(self.pcSearches) : "-"} />
          <StatCard label="모바일" value={self ? formatSearches(self.mobileSearches) : "-"} />
          <StatCard label="경쟁도" value={self ? <CompetitionBadge value={self.competition} /> : "-"} />
          <StatCard label="월평균 클릭" value={self ? self.monthlyClicks.toLocaleString() : "-"} />
        </div>
      )}

      {searchAd && keyword && !error && (
        <section>
          <h2>
            &ldquo;{keyword}&rdquo; 연관 키워드{" "}
            <small>
              {others.length > MAX_RELATED ? `${others.length}개 중 상위 ${MAX_RELATED}개` : `${others.length}개`} · 네이버
              월간 검색량 많은 순
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
                    <th>경쟁도</th>
                    <th className="num">월평균 클릭</th>
                  </tr>
                </thead>
                <tbody>
                  {others.slice(0, MAX_RELATED).map((r) => (
                    <tr key={r.keyword}>
                      <td className="keyword">
                        <Link href={`/keyword?q=${encodeURIComponent(r.keyword)}`}>{r.keyword}</Link>
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

function StatCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
