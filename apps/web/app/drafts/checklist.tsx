"use client";

import type { DraftMarker } from "@toolhub/collector";
import { useEffect, useState } from "react";

const LABELS: Record<DraftMarker["type"], string> = {
  image: "이미지",
  write: "직접 작성",
  check: "확인 필요",
};

/** 초안의 사람이 채울 자리 체크리스트. 체크 상태는 초안 파일마다 브라우저에 기억한다 */
export function DraftChecklist({ file, markers }: { file: string; markers: DraftMarker[] }) {
  const storageKey = `toolhub:draft-check:${file}`;
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    try {
      setChecked(JSON.parse(localStorage.getItem(storageKey) ?? "[]"));
    } catch {
      setChecked([]);
    }
  }, [storageKey]);

  const toggle = (index: number) => {
    const next = checked.includes(index) ? checked.filter((i) => i !== index) : [...checked, index];
    setChecked(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // 저장 못 해도 이번 화면에서는 동작한다
    }
  };

  if (markers.length === 0) return <p className="empty">사람이 채울 자리 표시가 없습니다.</p>;

  return (
    <>
      <p className="checklist-progress">
        {checked.length} / {markers.length} 완료
      </p>
      <ul className="checklist">
        {markers.map((marker, i) => (
          <li key={i} className={checked.includes(i) ? "done" : undefined}>
            <label>
              <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
              <span className={`marker ${marker.type}`}>{LABELS[marker.type]}</span>
              <span>{marker.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
