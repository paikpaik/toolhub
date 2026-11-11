"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface ImportResult {
  file: string;
  result: "added" | "renamed" | "skipped";
  savedAs?: string;
  reason?: string;
}

/** 고른 초안을 내보내기 파일(JSON) 하나로 내려받는다. 초안 내용과 상태 기록이 함께 들어간다 */
export function ExportDraftsButton({ targets }: { targets: { file: string; keyword: string }[] }) {
  const [busy, setBusy] = useState(false);
  const files = targets.map((t) => t.file);

  const download = async () => {
    const names = targets.map((t) => t.keyword);
    const list = names.length <= 5 ? names.join(", ") : `${names.slice(0, 5).join(", ")} 외 ${names.length - 5}개`;
    if (!confirm(`초안 ${targets.length}개를 내보낼까요?\n${list}\n\n초안 내용과 상태(발행됨·발행 주소·지식iN 답변 기록)를 파일 하나로 내려받아요.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/drafts/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ files }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? `내보내지 못했어요 (${res.status})`);
      const bundle = (await res.json()) as { exportedAt: string; drafts: unknown[] };
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `toolhub-drafts-${bundle.exportedAt.slice(0, 10)}-${bundle.drafts.length}개.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      className="button small"
      onClick={download}
      disabled={busy || files.length === 0}
      title={files.length ? "고른 초안을 파일 하나로 내려받아요 (상태·발행 주소 포함)" : "왼쪽 칸에서 내보낼 초안을 골라 주세요"}
    >
      {busy ? "내보내는 중…" : `내보내기${files.length ? ` ${files.length}` : ""}`}
    </button>
  );
}

/** 결과 안내: 몇 개 추가, 번호를 붙여 따로 저장한 것, 건너뛴 것 */
function summary(results: ImportResult[]) {
  const added = results.filter((r) => r.result === "added");
  const renamed = results.filter((r) => r.result === "renamed");
  const skipped = results.filter((r) => r.result === "skipped");
  const lines = [`가져오기: 추가 ${added.length}개 · 번호 붙여 저장 ${renamed.length}개 · 건너뜀 ${skipped.length}개`];
  if (renamed.length) lines.push("", "같은 이름이 있지만 내용이 달라 따로 저장했어요:", ...renamed.slice(0, 10).map((r) => `- ${r.file} → ${r.savedAs}`));
  if (skipped.length) lines.push("", "건너뛴 것:", ...skipped.slice(0, 10).map((r) => `- ${r.file} (${r.reason})`));
  if (renamed.length > 10 || skipped.length > 10) lines.push("…");
  return lines.join("\n");
}

/**
 * 내보내기 파일(.json)이나 초안 파일(.md)을 올려 초안에 추가한다. 여러 개를 한 번에 고를 수 있다.
 * 기존 초안은 덮어쓰지 않는다 (같으면 건너뛰고, 다르면 번호를 붙여 따로 저장)
 */
export function ImportDraftsButton() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    try {
      const drafts: unknown[] = [];
      for (const file of Array.from(list)) {
        const text = await file.text();
        if (/\.json$/i.test(file.name)) {
          const parsed = JSON.parse(text) as { drafts?: unknown };
          if (!Array.isArray(parsed?.drafts)) throw new Error(`${file.name}: toolhub 초안 내보내기 파일이 아니에요.`);
          drafts.push(...parsed.drafts);
        } else {
          drafts.push({ file: file.name, content: text });
        }
      }
      const res = await fetch("/api/drafts/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ drafts }) });
      const body = (await res.json().catch(() => null)) as { results?: ImportResult[]; error?: string } | null;
      if (!res.ok || !body?.results) throw new Error(body?.error ?? `가져오지 못했어요 (${res.status})`);
      alert(summary(body.results));
      // 목록·상태를 서버에서 다시 읽는다
      router.refresh();
    } catch (e) {
      alert(e instanceof Error && e.name !== "SyntaxError" ? e.message : "파일을 읽지 못했어요. toolhub에서 내보낸 .json이나 초안 .md 파일인지 확인해 주세요.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  };

  return (
    <>
      <button type="button" className="button small draft-import" onClick={() => input.current?.click()} disabled={busy} title="내보낸 .json 파일이나 초안 .md 파일을 올려 추가해요 (기존 초안은 덮어쓰지 않아요)">
        {busy ? "가져오는 중…" : "가져오기"}
      </button>
      <input ref={input} type="file" accept=".json,.md,.markdown,.txt" multiple hidden onChange={(e) => upload(e.currentTarget.files)} />
    </>
  );
}
