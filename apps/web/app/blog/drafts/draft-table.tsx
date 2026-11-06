"use client";

import { DRAFT_STATUS_LABELS, DRAFT_STATUSES, effectiveStatus, type DraftStatus, type DraftStatusEntry, type DraftStatusMap } from "@toolhub/collector/draft-status";
import Link from "next/link";
import { Fragment, useEffect, useState } from "react";
import { DRAFT_DATES_KEY, parseSavedDates } from "../../../lib/draft-dates";
import { cycleSort, DRAFT_SORT_KEY, parseSavedSort, sortByRules, type SortColumn, type SortRule } from "../../../lib/draft-sort";
import { DateFilter, datesLabel } from "./date-filter";
import { DeleteDraftsButton } from "./delete-draft-button";
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
export function DraftTable({ rows: allRows, statuses: initial }: { rows: DraftRow[]; statuses: DraftStatusMap }) {
  const [statuses, setStatuses] = useState(initial);
  // 지운 초안은 서버 화면을 다시 불러오지 않고 목록에서 바로 뺀다
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const rows = deleted.size ? allRows.filter((r) => !deleted.has(r.file)) : allRows;
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

  // 삭제할 초안 고르기. 지금 보이는 줄만 지운다 (거르기를 바꿔 안 보이게 된 줄이 함께 지워지지 않게)
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const picked = shown.filter((d) => selected.has(d.file));
  const allPicked = shown.length > 0 && picked.length === shown.length;
  const toggle = (file: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(file)) next.add(file);
      return next;
    });
  const toggleAll = () => setSelected(allPicked ? new Set() : new Set(shown.map((d) => d.file)));
  const removeRows = (files: string[]) => {
    setDeleted((prev) => new Set([...prev, ...files]));
    setSelected((prev) => new Set([...prev].filter((f) => !files.includes(f))));
    if (open && files.includes(open)) setOpen(null);
  };

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
        {/* 선택 삭제는 늘 같은 자리에 둔다 (고를 때 나타나면 표가 밀려 누르던 줄이 움직인다). 고른 게 없으면 눌리지 않는다 */}
        <div className="draft-select-actions">
          <DeleteDraftsButton
            targets={picked.map((d) => ({ file: d.file, keyword: d.keyword, published: statusOf(d.file) === "published" }))}
            onDeleted={removeRows}
          />
          <DateFilter counts={dateCounts} value={dates} onChange={changeDates} />
        </div>
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
              <th className="select">
                <input type="checkbox" checked={allPicked} onChange={toggleAll} aria-label="보이는 초안 모두 고르기" title="보이는 초안 모두 고르기" />
              </th>
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
                      // 키워드 링크(초안 열기)·프롬프트 복사 버튼·고르기 칸은 줄을 펼치지 않는다
                      if ((e.target as HTMLElement).closest("a, button, .select")) return;
                      setOpen(isOpen ? null : d.file);
                    }}
                    aria-expanded={isOpen}
                  >
                    {/* 칸 전체를 눌러도 고르기 (체크박스만 누르기는 작다) */}
                    <td className="select" onClick={() => toggle(d.file)}>
                      <input
                        type="checkbox"
                        checked={selected.has(d.file)}
                        onChange={() => toggle(d.file)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`${d.keyword} 고르기`}
                      />
                    </td>
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
                      <td colSpan={COLUMNS.length + 2}>
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
