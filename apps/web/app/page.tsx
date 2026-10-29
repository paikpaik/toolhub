import {
  ALL_SOURCES,
  collectKeywords,
  kstNow,
  listDates,
  readDay,
  recordKeywords,
  type DayKeyword,
  type KeywordItem,
  type SourceName,
} from "@toolhub/collector";
import { DATA_DIR } from "../lib/data";
import { DateSelect } from "./date-select";

// 요청마다 실시간으로 조회한다
export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<SourceName, string> = {
  google: "Google Trends",
  nate: "네이트",
  signal: "signal.bz",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const today = kstNow().date;
  const { date = today } = await searchParams;
  const isToday = date === today;

  // 오늘을 볼 때는 실시간으로 조회하고, 조회한 키워드를 그날 기록에 추가한다
  const live = isToday ? await collectKeywords() : null;
  const recorded = live ? await recordKeywords(live, DATA_DIR) : null;
  const [day, dates] = await Promise.all([readDay(DATA_DIR, date), listDates(DATA_DIR)]);
  const addedNow = new Set(recorded?.added.map((k) => k.keyword));

  return (
    <main>
      <header>
        <h1>실시간 키워드</h1>
        <DateSelect dates={dates} value={date} today={today} />
        {isToday && (
          <a className="button" href="/">
            새로고침
          </a>
        )}
      </header>

      {live && (
        <section>
          <h2>
            지금{" "}
            <small>
              {live.collectedAt.slice(11, 16)} 조회 · 새 키워드 {recorded?.added.length ?? 0}개 기록
            </small>
          </h2>
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
        </section>
      )}

      <section>
        <h2>
          {isToday ? "오늘 뜬 키워드" : `${date}에 뜬 키워드`} <small>{day?.keywords.length ?? 0}개 · 최근에 처음 본 순</small>
        </h2>
        {day?.keywords.length ? (
          <DayTable rows={[...day.keywords].reverse()} highlight={addedNow} />
        ) : (
          <p className="empty">기록이 없습니다.</p>
        )}
      </section>
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

function DayTable({ rows, highlight }: { rows: DayKeyword[]; highlight: Set<string> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>처음 본 시각</th>
            <th>키워드</th>
            <th>소스</th>
            <th>최고순위</th>
            <th>구글 트래픽</th>
            <th>관련</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.keyword} className={highlight.has(r.keyword) ? "added" : undefined}>
              <td>{r.firstSeen}</td>
              <td className="keyword">{r.keyword}</td>
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
