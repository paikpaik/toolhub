import { ALL_SOURCES, collectKeywords, recordKeywords, type KeywordItem, type SourceName } from "@toolhub/collector";
import Link from "next/link";
import { DATA_DIR } from "../../lib/data";
import { enrichInBackground } from "../../lib/enrich";
import { SOURCE_LABELS } from "../../lib/labels";

// 요청마다 실시간으로 조회한다
export const dynamic = "force-dynamic";

export default async function LivePage() {
  // 실시간으로 조회하고, 조회한 키워드를 그날 기록에 추가한다
  const live = await collectKeywords();
  const recorded = await recordKeywords(live, DATA_DIR);
  // 새 키워드의 검색량은 기다리지 않고 뒤에서 미리 채워 둔다 (키워드 기록을 열 때 대부분 채워져 있도록)
  if (recorded.added.length > 0) enrichInBackground(recorded.date);

  return (
    <main>
      <header>
        <h1>
          실시간 <small>{live.collectedAt.slice(11, 16)} 조회</small>
        </h1>
        <a className="button" href="/blog">
          새로고침
        </a>
      </header>

      <p className="notice">
        새 키워드 {recorded.added.length}개를 오늘 기록에 추가했습니다 (오늘 누적 {recorded.total}개) ·{" "}
        <Link href="/blog/history">키워드 기록 보기</Link>
      </p>

      <div className="sources">
        {ALL_SOURCES.map((source) => (
          <LiveColumn
            key={source}
            source={source}
            items={live.items.filter((i) => i.source === source)}
            error={live.errors[source]}
          />
        ))}
      </div>
    </main>
  );
}

function LiveColumn({ source, items, error }: { source: SourceName; items: KeywordItem[]; error?: string }) {
  return (
    <div className="card">
      <h3>{SOURCE_LABELS[source]}</h3>
      {error ? (
        <p className="error">조회 실패: {error}</p>
      ) : (
        <ol>
          {items.map((item) => (
            <li key={item.rank}>
              <span className="rank">{item.rank}</span>
              <span className="keyword">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noreferrer" title={item.related ?? undefined}>
                    {item.keyword}
                  </a>
                ) : (
                  item.keyword
                )}
              </span>
              {item.traffic && <span className="meta">{item.traffic.toLocaleString()}+</span>}
              {item.state && <StateBadge state={item.state} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  if (state === "n") return <span className="badge new">NEW</span>;
  if (state.startsWith("+")) return <span className="badge up">▲{state.slice(1)}</span>;
  if (state.startsWith("-")) return <span className="badge down">▼{state.slice(1)}</span>;
  return null;
}
