"use client";

import { DRAFT_STATUS_LABELS, DRAFT_STATUSES, effectiveStatus, type DraftStatus, type DraftStatusEntry, type DraftStatusMap } from "@toolhub/collector/draft-status";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { DRAFT_DATES_KEY, parseSavedDates } from "../../../lib/draft-dates";
import { cycleSort, DRAFT_SORT_KEY, parseSavedSort, sortByRules, type SortColumn, type SortRule } from "../../../lib/draft-sort";
import { DateFilter, datesLabel } from "./date-filter";
import { KinPanel } from "./kin-panel";
import { PromptCopyButton } from "./prompt-copy-button";
import { DraftStatusControl, StatusBadge } from "./status-control";

const COLUMNS: { column: SortColumn; label: string }[] = [
  { column: "keyword", label: "키워드" },
  { column: "status", label: "상태" },
  { column: "answers", label: "지식iN" },
  { column: "platform", label: "플랫폼" },
  { column: "date", label: "작성일" },
  { column: "updatedAt", label: "마지막 수정" },
];
const COLUMN_LABEL = Object.fromEntries(COLUMNS.map((c) => [c.column, c.label])) as Record<SortColumn, string>;
const ARROW = { asc: "↑", desc: "↓" } as const;

/** 기억한 값을 읽고 쓴다. 못 읽거나 못 써도 이번 화면에서는 동작한다 */
function remember(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 그대로 둔다
  }
}
function recall(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export interface DraftRow {
  file: string;
  keyword: string;
  platform: string | null;
  date: string | null;
  updatedAt: string;
}

/** 초안 목록. 줄을 누르면 아래로 펼쳐져 상태를 바꾸고, 그 키워드의 지식iN 질문에 답변을 준비한다 */
export function DraftTable({ rows, statuses: initial }: { rows: DraftRow[]; statuses: DraftStatusMap }) {
  const [statuses, setStatuses] = useState(initial);
  const [filter, setFilter] = useState<DraftStatus | "all">("all");
  const [open, setOpen] = useState<string | null>(null);
  const [dates, setDates] = useState<string[]>([]);
  const [sort, setSort] = useState<SortRule[]>([]);

  // 고른 작성일·정렬은 다른 화면에 다녀와도 기억한다 (브라우저에서 읽어서 서버 화면과 어긋나지 않게)
  useEffect(() => {
    setDates(parseSavedDates(recall(DRAFT_DATES_KEY), new Set(rows.flatMap((r) => (r.date ? [r.date] : [])))));
    setSort(parseSavedSort(recall(DRAFT_SORT_KEY)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changeDates = (next: string[]) => {
    setDates(next);
    remember(DRAFT_DATES_KEY, next);
  };
  const changeSort = (next: SortRule[]) => {
    setSort(next);
    remember(DRAFT_SORT_KEY, next);
  };

  const statusOf = (file: string) => effectiveStatus(statuses[file]);
  const matchesStatus = (r: DraftRow) => filter === "all" || statusOf(r.file) === filter;
  // 상태 탭 개수는 고른 작성일 안에서, 달력의 날짜별 개수는 고른 상태 안에서 센다
  const inDate = dates.length ? rows.filter((r) => r.date && dates.includes(r.date)) : rows;
  const counts = Object.fromEntries(DRAFT_STATUSES.map((s) => [s, inDate.filter((r) => statusOf(r.file) === s).length])) as Record<DraftStatus, number>;
  const dateCounts = new Map<string, number>();
  for (const r of rows) if (r.date && matchesStatus(r)) dateCounts.set(r.date, (dateCounts.get(r.date) ?? 0) + 1);
  // 상태·답변 수 정렬은 화면을 연 때의 값으로 (펼친 줄에서 상태를 바꿔도 줄이 튀지 않게)
  const shown = sortByRules(
    inDate.filter(matchesStatus).map((r) => ({
      ...r,
      statusRank: DRAFT_STATUSES.indexOf(effectiveStatus(initial[r.file])),
      answers: initial[r.file]?.answers?.length ?? 0,
    })),
    sort,
  );
  const update = (file: string) => (entry: DraftStatusEntry) => setStatuses((prev) => ({ ...prev, [file]: entry }));

  return (
    <>
      <div className="draft-filters">
        <div className="status-filter" role="tablist" aria-label="상태로 거르기">
          {(["all", ...DRAFT_STATUSES] as const).map((s) => (
            <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
              {s === "all" ? "전체" : DRAFT_STATUS_LABELS[s]} <small>{s === "all" ? inDate.length : counts[s]}</small>
            </button>
          ))}
        </div>
        <DateFilter counts={dateCounts} value={dates} onChange={changeDates} />
        {sort.length > 0 && (
          <div className="draft-sort-summary">
            <span title="칼럼 머리를 누른 순서가 우선순위예요">정렬 {sort.map((r) => `${COLUMN_LABEL[r.column]} ${ARROW[r.dir]}`).join(" › ")}</span>
            <button type="button" className="button small" onClick={() => changeSort([])} title="기본 순서(발행됨 → 초안, 최근 수정 순)로">
              정렬 풀기
            </button>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="draft-table">
          <thead>
            <tr>
              {COLUMNS.map(({ column, label }) => {
                const index = sort.findIndex((r) => r.column === column);
                const rule = sort[index];
                return (
                  <th key={column} aria-sort={index === 0 ? (rule!.dir === "asc" ? "ascending" : "descending") : undefined}>
                    <button
                      type="button"
                      className={`sort-head${rule ? " on" : ""}`}
                      onClick={() => changeSort(cycleSort(sort, column))}
                      title={rule ? `정렬 ${index + 1}순위 · 누르면 방향 바꾸기, 한 번 더 누르면 빼기` : `누르면 정렬 ${sort.length + 1}순위로 더해요`}
                    >
                      {label}
                      {rule && (
                        <small>
                          {sort.length > 1 && index + 1}
                          {ARROW[rule.dir]}
                        </small>
                      )}
                    </button>
                  </th>
                );
              })}
              <th title="이미지 5장 프롬프트 (Gemini용)">프롬프트</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((d) => {
              const isOpen = open === d.file;
              const entry = statuses[d.file];
              return (
                <Fragment key={d.file}>
                  <tr
                    className={`draft-row${isOpen ? " open" : ""}`}
                    onClick={(e) => {
                      // 키워드 링크(초안 열기)·프롬프트 복사 버튼은 줄을 펼치지 않는다
                      if ((e.target as HTMLElement).closest("a, button")) return;
                      setOpen(isOpen ? null : d.file);
                    }}
                    aria-expanded={isOpen}
                  >
                    <td className="keyword">
                      <span className="row-chevron" aria-hidden="true">
                        {isOpen ? "▾" : "▸"}
                      </span>
                      <Link href={`/blog/drafts/view?file=${encodeURIComponent(d.file)}`}>{d.keyword}</Link>
                    </td>
                    <td>
                      <StatusBadge entry={entry} />
                    </td>
                    <td className="num">{entry?.answers?.length ? `답변 ${entry.answers.length}` : "-"}</td>
                    <td>{d.platform ?? "-"}</td>
                    <td>{d.date ?? "-"}</td>
                    <td>{new Date(d.updatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td>
                    <td>
                      <PromptCopyButton file={d.file} />
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="draft-detail">
                      <td colSpan={COLUMNS.length + 1}>
                        <DraftStatusControl file={d.file} entry={entry} onChange={update(d.file)} />
                        <KinPanel file={d.file} keyword={d.keyword} entry={entry} onChange={update(d.file)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {shown.length === 0 && (
        <p className="notice">
          {[dates.length > 0 && datesLabel(dates), filter !== "all" && DRAFT_STATUS_LABELS[filter]].filter(Boolean).join(" · ")} 초안이 없어요.
        </p>
      )}
    </>
  );
}
