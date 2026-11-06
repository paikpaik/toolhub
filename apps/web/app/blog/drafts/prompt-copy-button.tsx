"use client";

import { useState } from "react";
import { readImageStyle } from "./view/image-prompt";

/**
 * 초안 목록에서 이미지 5장 프롬프트를 바로 복사한다 (스타일은 초안 화면에서 마지막으로 고른 것).
 * 요청문은 누를 때 서버에서 만든다. 응답을 기다리는 동안 복사 권한이 끊기지 않게 Promise를 ClipboardItem에 그대로 넘긴다 (Safari도 이 방식만 된다)
 */
export function PromptCopyButton({ file }: { file: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const copy = async () => {
    const url = `/api/drafts/image-prompt?file=${encodeURIComponent(file)}&style=${encodeURIComponent(readImageStyle() ?? "photo")}`;
    const text = () =>
      fetch(url).then((res) => {
        if (!res.ok) throw new Error(`프롬프트를 만들지 못했어요 (${res.status})`);
        return res.text();
      });
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([new ClipboardItem({ "text/plain": text().then((t) => new Blob([t], { type: "text/plain" })) })]);
      } else {
        await navigator.clipboard.writeText(await text());
      }
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  return (
    <button type="button" className="button small" onClick={copy} title="이미지 5장 프롬프트를 복사해요 (Gemini에 붙여넣기)">
      {state === "done" ? "복사됨 ✓" : state === "error" ? "복사 실패" : "복사"}
    </button>
  );
}
