"use client";

import { useState } from "react";

export interface DeleteTarget {
  file: string;
  keyword: string;
  published: boolean;
}

/**
 * 고른 초안 삭제. 초안 파일과 함께 이전 버전(drafts/.history)·상태·지식iN 답변 기록(서버), 체크리스트(이 브라우저)도 지운다.
 * 되돌릴 수 없어서 한 번 더 묻고, 발행됨이 섞여 있으면 기록이 사라진다는 것을 함께 알린다.
 * 하나씩 차례로 지워서 중간에 실패해도 지운 것까지는 목록에서 뺀다
 */
export function DeleteDraftsButton({ targets, onDeleted }: { targets: DeleteTarget[]; onDeleted: (files: string[]) => void }) {
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    const names = targets.map((t) => t.keyword);
    const list = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} 외 ${names.length - 5}개`;
    const published = targets.filter((t) => t.published).length;
    const warn = published ? `\n발행됨 ${published}개는 발행 주소·지식iN 답변 기록도 함께 사라져요.` : "";
    if (!confirm(`초안 ${targets.length}개를 삭제할까요?\n${list}\n\n이전 버전과 상태 기록까지 함께 지우고, 되돌릴 수 없어요.${warn}`)) return;
    setBusy(true);
    const done: string[] = [];
    try {
      for (const { file } of targets) {
        const res = await fetch(`/api/drafts/content?file=${encodeURIComponent(file)}`, { method: "DELETE" });
        if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `삭제하지 못했어요 (${res.status})`);
        try {
          localStorage.removeItem(`toolhub:draft-check:${file}`);
        } catch {
          // 체크 기록은 못 지워도 그만
        }
        done.push(file);
      }
    } catch (e) {
      alert(`${done.length}개 지운 뒤 멈췄어요: ${e instanceof Error ? e.message : String(e)}`);
    }
    setBusy(false);
    onDeleted(done);
  };

  return (
    <button type="button" className="button small danger" onClick={remove} disabled={busy || targets.length === 0} title={targets.length ? "고른 초안과 관련 기록을 함께 삭제해요" : "왼쪽 칸에서 지울 초안을 골라 주세요"}>
      {busy ? "삭제 중…" : `선택 삭제${targets.length ? ` ${targets.length}` : ""}`}
    </button>
  );
}
