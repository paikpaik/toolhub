"use client";

import { useEffect, useRef, useState } from "react";
import type { ThumbnailFont } from "../../thumbnail/fonts";
import { ThumbnailMaker } from "../../thumbnail/thumbnail-maker";

/** 위쪽 버튼과 아래 패널은 떨어져 있어서 창 이벤트로 연다 */
const OPEN_EVENT = "toolhub:open-thumbnail";

export function ThumbnailButton() {
  return (
    <button type="button" className="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      썸네일 만들기
    </button>
  );
}

/** 초안 화면 안에서 바로 만드는 썸네일. 처음 열 때 그리고, 접어도 고친 내용은 남긴다 */
export function ThumbnailPanel({ fonts, title }: { fonts: ThumbnailFont[]; title: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const open = () => {
      const details = ref.current;
      if (!details) return;
      details.open = true;
      setOpened(true);
      details.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  return (
    <details ref={ref} className="card thumbnail-panel" onToggle={(e) => e.currentTarget.open && setOpened(true)}>
      <summary>
        <h2>
          썸네일 <small>추천 제목으로 채워져요 · 블로그 이름·색·글꼴은 기억돼요</small>
        </h2>
      </summary>
      {opened && <ThumbnailMaker fonts={fonts} initial={{ title, subtitle: "", label: "" }} />}
    </details>
  );
}
