"use client";

import { DRAFT_STATUS_LABELS, DRAFT_STATUSES, effectiveStatus, type DraftStatus, type DraftStatusEntry, type DraftStatusMap } from "@toolhub/collector/draft-status";
import Link from "next/link";
import { Fragment, useState } from "react";
import { KinPanel } from "./kin-panel";
import { DraftStatusControl, StatusBadge } from "./status-control";

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

  const statusOf = (file: string) => effectiveStatus(statuses[file]);
  const counts = Object.fromEntries(DRAFT_STATUSES.map((s) => [s, rows.filter((r) => statusOf(r.file) === s).length])) as Record<DraftStatus, number>;
  const shown = filter === "all" ? rows : rows.filter((r) => statusOf(r.file) === filter);
  const update = (file: string) => (entry: DraftStatusEntry) => setStatuses((prev) => ({ ...prev, [file]: entry }));

  return (
    <>
      <div className="status-filter" role="tablist" aria-label="상태로 거르기">
        {(["all", ...DRAFT_STATUSES] as const).map((s) => (
          <button key={s} type="button" role="tab" aria-selected={filter === s} className={filter === s ? "on" : ""} onClick={() => setFilter(s)}>
            {s === "all" ? "전체" : DRAFT_STATUS_LABELS[s]} <small>{s === "all" ? rows.length : counts[s]}</small>
          </button>
        ))}
      </div>
      <div className="table-wrap">
        <table className="draft-table">
          <thead>
            <tr>
              <th>키워드</th>
              <th>상태</th>
              <th>지식iN</th>
              <th>플랫폼</th>
              <th>작성일</th>
              <th>마지막 수정</th>
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
                      // 키워드 링크(초안 열기)는 그대로 이동
                      if ((e.target as HTMLElement).closest("a")) return;
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
                  </tr>
                  {isOpen && (
                    <tr className="draft-detail">
                      <td colSpan={6}>
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
      {shown.length === 0 && <p className="notice">{filter === "all" ? "" : `${DRAFT_STATUS_LABELS[filter]} 초안이 없어요.`}</p>}
    </>
  );
}
