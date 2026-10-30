"use client";

import {
  briefKey,
  isPlatform,
  isStructure,
  isWritingType,
  PLATFORM_LABELS,
  PLATFORMS,
  randomStructure,
  STRUCTURE_NAMES,
  STRUCTURES,
  structureLine,
  WRITING_TYPE_LABELS,
  WRITING_TYPES,
  type Platform,
  type Structure,
  type WritingType,
} from "@toolhub/collector/platforms";
import { useEffect, useState } from "react";

/** 브라우저에 기억해 두고 페이지 간에 공유하는 선택값 (플랫폼, 글 유형) */
function useStoredChoice<T extends string>(key: string, isValid: (v: unknown) => v is T, fallback: T) {
  const event = `toolhub:${key}-change`;
  const read = (): T => {
    try {
      const value = localStorage.getItem(`toolhub:${key}`);
      return isValid(value) ? value : fallback;
    } catch {
      return fallback;
    }
  };

  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const sync = () => setValue(read());
    sync();
    window.addEventListener(event, sync);
    return () => window.removeEventListener(event, sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const change = (next: T) => {
    try {
      localStorage.setItem(`toolhub:${key}`, next);
    } catch {
      // 저장 못 해도 이번 화면에서는 동작한다
    }
    setValue(next);
    window.dispatchEvent(new Event(event));
  };
  return [value, change] as const;
}

type StructureChoice = Structure | "auto";
const isStructureChoice = (v: unknown): v is StructureChoice => v === "auto" || isStructure(v);

const usePlatform = () => useStoredChoice<Platform>("platform", isPlatform, "tistory");
const useWritingType = () => useStoredChoice<WritingType>("writing-type", isWritingType, "info");
const useStructure = () => useStoredChoice<StructureChoice>("structure", isStructureChoice, "auto");

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

export function WritingTypeSelect() {
  const [type, setType] = useWritingType();
  return (
    <select value={type} onChange={(e) => isWritingType(e.target.value) && setType(e.target.value)} title="글 유형">
      {WRITING_TYPES.map((t) => (
        <option key={t} value={t}>
          {WRITING_TYPE_LABELS[t]}
        </option>
      ))}
    </select>
  );
}

/** 글 구성 선택. 자동이면 복사할 때마다 무작위로 골라 글마다 구조가 같아지지 않게 한다 */
export function StructureSelect() {
  const [structure, setStructure] = useStructure();
  const [type] = useWritingType();
  return (
    <select
      value={structure}
      onChange={(e) => isStructureChoice(e.target.value) && setStructure(e.target.value)}
      title="글 구성 (자동: 복사할 때마다 무작위)"
    >
      <option value="auto">구성 자동</option>
      {STRUCTURES.map((s) => (
        <option key={s} value={s}>
          {s}. {STRUCTURE_NAMES[type][s]}
        </option>
      ))}
    </select>
  );
}

type CopyState = "idle" | "copying" | "done" | "error";

const fetchBrief = (keyword: string, platform: Platform, type: WritingType, structure: Structure) =>
  fetch(`/api/brief?q=${encodeURIComponent(keyword)}&platform=${platform}&type=${type}&structure=${structure}`).then((res) => {
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
  /** briefKey(platform, type) → 브리프 */
  briefs?: Record<string, string>;
  compact?: boolean;
}) {
  const [platform] = usePlatform();
  const [type] = useWritingType();
  const [structureChoice] = useStructure();
  const [state, setState] = useState<CopyState>("idle");
  const label = `${PLATFORM_LABELS[platform]} · ${WRITING_TYPE_LABELS[type]}`;

  const copy = async () => {
    setState("copying");
    const structure = structureChoice === "auto" ? randomStructure() : structureChoice;
    try {
      const ready = briefs?.[briefKey(platform, type)];
      if (ready) {
        // 미리 만든 브리프의 구성 줄을 지금 고른 구성으로 바꾼다
        await navigator.clipboard.writeText(ready.replace(/^구성: .*$/m, structureLine(type, structure)));
      } else {
        // Safari는 클릭 직후가 아니면 복사를 막으므로, 내용을 Promise로 넘겨 클릭 시점에 복사를 시작한다
        const text = fetchBrief(keyword, platform, type, structure);
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

  const text = {
    idle: compact ? "✍" : `✍ ${label} 브리프 복사`,
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
      title={`${label} 글쓰기 브리프 복사 → claude.ai 프로젝트에 붙여넣기`}
    >
      {text}
    </button>
  );
}
