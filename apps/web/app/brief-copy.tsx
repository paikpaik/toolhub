"use client";

import { isPlatform, PLATFORM_LABELS, PLATFORMS, type Platform } from "@toolhub/collector/platforms";
import { useEffect, useState } from "react";

/** 마지막으로 고른 플랫폼을 페이지 간에 공유한다 */
const STORAGE_KEY = "toolhub:platform";
const CHANGE_EVENT = "toolhub:platform-change";

function readPlatform(): Platform {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isPlatform(value) ? value : "tistory";
  } catch {
    return "tistory";
  }
}

function usePlatform() {
  const [platform, setPlatform] = useState<Platform>("tistory");
  useEffect(() => {
    const sync = () => setPlatform(readPlatform());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);
    return () => window.removeEventListener(CHANGE_EVENT, sync);
  }, []);

  const change = (value: Platform) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // 저장 못 해도 이번 화면에서는 동작한다
    }
    setPlatform(value);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  return [platform, change] as const;
}

export function PlatformSelect() {
  const [platform, setPlatform] = usePlatform();
  return (
    <select value={platform} onChange={(e) => isPlatform(e.target.value) && setPlatform(e.target.value)} title="글을 발행할 플랫폼">
      {PLATFORMS.map((p) => (
        <option key={p} value={p}>
          {PLATFORM_LABELS[p]}
        </option>
      ))}
    </select>
  );
}

type CopyState = "idle" | "copying" | "done" | "error";

const fetchBrief = (keyword: string, platform: Platform) =>
  fetch(`/api/brief?q=${encodeURIComponent(keyword)}&platform=${platform}`).then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  });

/**
 * [글쓰기 브리프]를 클립보드에 복사한다.
 * briefs가 있으면 바로 복사하고, 없으면 서버에서 만들어 복사한다 (키워드 기록 표처럼 데이터가 화면에 없을 때).
 */
export function CopyBriefButton({
  keyword,
  briefs,
  compact = false,
}: {
  keyword: string;
  briefs?: Record<Platform, string>;
  compact?: boolean;
}) {
  const [platform] = usePlatform();
  const [state, setState] = useState<CopyState>("idle");

  const copy = async () => {
    setState("copying");
    try {
      if (briefs) {
        await navigator.clipboard.writeText(briefs[platform]);
      } else {
        // Safari는 클릭 직후가 아니면 복사를 막으므로, 내용을 Promise로 넘겨 클릭 시점에 복사를 시작한다
        const text = fetchBrief(keyword, platform);
        try {
          await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
        } catch {
          await navigator.clipboard.writeText(await text);
        }
      }
      setState("done");
    } catch {
      setState("error");
    }
    setTimeout(() => setState("idle"), 2000);
  };

  const label = {
    idle: compact ? "✍" : `✍ ${PLATFORM_LABELS[platform]} 브리프 복사`,
    copying: compact ? "…" : "복사 중…",
    done: compact ? "✓" : "복사됨 ✓",
    error: compact ? "!" : "복사 실패",
  }[state];

  return (
    <button
      type="button"
      className={compact ? "icon-button" : "button primary"}
      onClick={copy}
      disabled={state === "copying"}
      title={`${PLATFORM_LABELS[platform]}용 글쓰기 브리프 복사 → claude.ai 프로젝트에 붙여넣기`}
    >
      {label}
    </button>
  );
}
