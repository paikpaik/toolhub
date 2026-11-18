"use client";

import type { InflowKeywordState, InflowOverviewItem } from "@toolhub/collector";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "../../icons";

const STATE_LABEL: Record<InflowKeywordState, string> = { candidate: "글감 후보", open: "후보 밖", covered: "글 있음" };
const STATES = ["candidate", "open", "covered"] as const;
type StateFilter = InflowKeywordState | "all";

const savedAt = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

const accountName = (item: InflowOverviewItem) => item.accountName ?? `지운 계정 (${item.accountId})`;

/**
 * 계정별 유입 검색어 기록. 계정이 늘어도 한 화면에 한 계정만 보이게 계정 탭(?account=)으로 고르고,
 * 검색어는 상태(글감 후보·후보 밖·글 있음) 탭으로 나눠 본다. 지우면 서버에서 상태(후보)를 다시 계산해 받는다
 */
export function InflowList({ items, initialAccount }: { items: InflowOverviewItem[]; initialAccount: string | null }) {
  const router = useRouter();
  const [accountId, setAccountId] = useState(
    () => items.find((i) => i.accountId === initialAccount)?.accountId ?? items.find((i) => i.record)?.accountId ?? items[0]?.accountId ?? null,
  );
  const [filter, setFilter] = useState<StateFilter>("candidate");
  const [message, setMessage] = useState("");

  if (!items.length) return <p className="hint-text">등록된 계정도, 저장된 기록도 없어요. 블로그 › 계정에서 계정과 블로그 아이디를 먼저 넣어 주세요.</p>;

  // 지운 뒤 새로고침으로 고른 계정이 목록에서 빠질 수 있다 (지운 계정 기록을 지운 경우)
  const item = items.find((i) => i.accountId === accountId) ?? items[0]!;
  const count = (state: StateFilter) => (state === "all" ? item.keywords.length : item.keywords.filter((k) => k.state === state).length);
  const rows = filter === "all" ? item.keywords : item.keywords.filter((k) => k.state === filter);

  const changeAccount = (id: string) => {
    setAccountId(id);
    setFilter("candidate");
    setMessage("");
    router.replace(`/blog/inflow?account=${encodeURIComponent(id)}`, { scroll: false });
  };

  const remove = async (keyword?: string) => {
    if (!confirm(keyword ? `${accountName(item)}의 검색어 "${keyword}"를 지울까요?` : `${accountName(item)}의 유입 검색어 기록(${item.record?.period})을 모두 지울까요?`)) return;
    const params = new URLSearchParams({ account: item.accountId, ...(keyword ? { keyword } : {}) });
    const res = await fetch(`/api/inflow?${params}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    setMessage(res.ok ? "" : (body.error ?? "지우지 못했어요"));
    router.refresh();
  };

  return (
    <>
      <div className="status-filter" role="tablist" aria-label="계정 고르기">
        {items.map((i) => {
          const candidates = i.keywords.filter((k) => k.state === "candidate").length;
          return (
            <button
              key={i.accountId}
              type="button"
              role="tab"
              aria-selected={i.accountId === item.accountId}
              className={i.accountId === item.accountId ? "on" : ""}
              onClick={() => changeAccount(i.accountId)}
              title={i.record ? `${i.record.period} · 글감 후보 ${candidates}개` : "아직 받은 기록이 없어요"}
            >
              {accountName(i)} <small>{!i.record ? "없음" : i.stale ? "오래됨" : candidates}</small>
            </button>
          );
        })}
      </div>

      <section className="card inflow-card">
        <div className="inflow-head">
          <strong>{accountName(item)}</strong>
          {item.record ? (
            <span className="muted">
              {item.record.period} · {savedAt(item.record.at)} 저장 · 검색어 {item.record.keywords.length}개
            </span>
          ) : (
            <span className="muted">아직 받은 기록이 없어요. 블로그 통계에서 이 계정의 유입 검색어를 복사해 Claude에 붙여넣으세요.</span>
          )}
          {item.stale && <span className="badge up">오래돼서 글감 후보에서 빠짐</span>}
          {item.record && (
            <button type="button" className="button small" onClick={() => remove()}>
              <Icon name="trash" size={14} /> 기록 지우기
            </button>
          )}
        </div>

        {item.record && (
          <>
            <div className="status-filter" role="tablist" aria-label="상태로 거르기">
              {([...STATES, "all"] as const).map((s) => (
                <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
                  {s === "all" ? "전체" : STATE_LABEL[s]} <small>{count(s)}</small>
                </button>
              ))}
            </div>
            {rows.length ? (
              <table className="account-stats inflow-table">
                <thead>
                  <tr>
                    <th>검색어</th>
                    <th className="num">비율</th>
                    <th>{filter === "covered" ? "초안 키워드" : "상태"}</th>
                    <th aria-label="지우기" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((k) => (
                    <tr key={k.keyword}>
                      <td>
                        <Link href={`/blog/keyword?q=${encodeURIComponent(k.keyword)}`}>{k.keyword}</Link>
                      </td>
                      <td className="num">{k.share}%</td>
                      <td className={k.state === "candidate" ? "" : "muted"}>{filter === "covered" ? k.draftKeyword : STATE_LABEL[k.state]}</td>
                      <td className="num">
                        <button type="button" className="inflow-remove" onClick={() => remove(k.keyword)} aria-label={`${k.keyword} 지우기`} title="지우기">
                          <Icon name="close" size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="hint-text">
                {filter === "candidate" && item.stale ? "기록이 오래돼서 글감 후보가 없어요. 지난주 통계로 다시 붙여넣으세요." : `${STATE_LABEL[filter as InflowKeywordState] ?? ""} 검색어가 없어요.`}
              </p>
            )}
          </>
        )}
      </section>
      {message && <p className="error">{message}</p>}
    </>
  );
}
