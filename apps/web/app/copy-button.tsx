"use client";

import { useState } from "react";

export function CopyButton({ text, label = "복사", primary = false }: { text: string; label?: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 1500);
  };

  return (
    <button type="button" className={primary ? "button primary" : "button small"} onClick={copy}>
      {state === "done" ? "복사됨 ✓" : state === "error" ? "복사 실패" : label}
    </button>
  );
}
