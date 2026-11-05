"use client";

import { DRAFT_STATUS_LABELS, DRAFT_STATUSES, effectiveStatus, type DraftStatus, type DraftStatusEntry, type DraftStatusPatch } from "@toolhub/collector/draft-status";
import { useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO → datetime-local 입력 값 (브라우저 시간대) */
const toLocalInput = (iso?: string) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export async function saveDraftStatus(file: string, patch: DraftStatusPatch): Promise<DraftStatusEntry> {
  const res = await fetch("/api/drafts/status", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ file, ...patch }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "저장하지 못했어요");
  return body;
}

/** 상태 뱃지 */
export function StatusBadge({ entry }: { entry?: DraftStatusEntry }) {
  const status = effectiveStatus(entry);
  return <span className={`status-badge ${status}`}>{DRAFT_STATUS_LABELS[status]}</span>;
}

/** 초안 / 발행됨 + 글 주소 + 발행 시각. 바꾸면 바로 저장한다 */
export function DraftStatusControl({ file, entry, onChange }: { file: string; entry?: DraftStatusEntry; onChange: (entry: DraftStatusEntry) => void }) {
  const [url, setUrl] = useState(entry?.url ?? "");
  const [at, setAt] = useState(toLocalInput(entry?.at));
  const [message, setMessage] = useState("");
  const status = effectiveStatus(entry);

  const save = async (patch: DraftStatusPatch) => {
    try {
      const next = await saveDraftStatus(file, patch);
      onChange(next);
      setMessage("저장했어요");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
    setTimeout(() => setMessage(""), 2500);
  };

  const changeStatus = (next: DraftStatus) => {
    // 발행됨으로 바꾸면서 시각이 비어 있으면 지금을 발행 시각으로
    const patch: DraftStatusPatch = { status: next };
    if (next === "published" && !entry?.at) {
      patch.at = new Date().toISOString();
      setAt(toLocalInput(patch.at));
    }
    save(patch);
  };

  return (
    <div className="status-control">
      <div className="status-segments" role="radiogroup" aria-label="초안 상태">
        {DRAFT_STATUSES.map((s) => (
          <button key={s} type="button" role="radio" aria-checked={status === s} className={status === s ? `on ${s}` : ""} onClick={() => status !== s && changeStatus(s)}>
            {DRAFT_STATUS_LABELS[s]}
          </button>
        ))}
      </div>
      {status !== "draft" && (
        <>
          <label>
            글 주소 <small>지식iN 답변 링크로 써요</small>
            <input
              type="url"
              value={url}
              placeholder="https://blog.naver.com/아이디/글번호"
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => url !== (entry?.url ?? "") && save({ url })}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
          <label>
            발행 시각
            <input
              type="datetime-local"
              value={at}
              onChange={(e) => {
                setAt(e.target.value);
                save({ at: e.target.value ? new Date(e.target.value).toISOString() : null });
              }}
            />
          </label>
        </>
      )}
      {message && <small className="status-message">{message}</small>}
    </div>
  );
}

/** 초안 화면 옆 패널의 상태 카드 */
export function DraftStatusCard({ file, entry: initial }: { file: string; entry?: DraftStatusEntry }) {
  const [entry, setEntry] = useState(initial);
  return (
    <section className="card">
      <h3>
        상태 <StatusBadge entry={entry} />
        {entry?.answers?.length ? <small> · 지식iN 답변 {entry.answers.length}</small> : null}
      </h3>
      <DraftStatusControl file={file} entry={entry} onChange={setEntry} />
      <p className="hint-text">지식iN 답변은 초안 목록에서 이 줄을 눌러 준비해요.</p>
    </section>
  );
}
