"use client";

import { useState } from "react";

/** html을 주면 서식째 복사한다 (서식을 못 받는 곳에는 text가 붙는다) */
export function CopyButton({
  text,
  html,
  label = "복사",
  primary = false,
  title,
}: {
  text: string;
  html?: string;
  label?: React.ReactNode;
  primary?: boolean;
  title?: string;
}) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const copy = async () => {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  return (
    <button type="button" className={primary ? "button primary" : "button small"} title={title} onClick={copy}>
      {state === "done" ? "복사됨 ✓" : state === "error" ? "복사 실패" : label}
    </button>
  );
}
