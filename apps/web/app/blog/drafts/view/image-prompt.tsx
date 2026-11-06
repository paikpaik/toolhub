"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "../../copy-button";

/** 고른 이미지 스타일을 기억한다. 초안 목록의 프롬프트 복사도 이 스타일로 */
export const IMAGE_STYLE_KEY = "toolhub:image-prompt-style";

export function readImageStyle() {
  try {
    return localStorage.getItem(IMAGE_STYLE_KEY);
  } catch {
    return null;
  }
}

/** Gemini에 붙여넣을 이미지 5장 요청문 (본문 이미지 1~5번. 대표 썸네일은 썸네일 만들기로 직접 만든다). 스타일을 바꿔도 바로 복사되도록 두 가지를 미리 받아 둔다 */
export function ImagePromptCard({ prompts }: { prompts: Record<string, { label: string; text: string }> }) {
  const keys = Object.keys(prompts);
  const [style, setStyle] = useState(keys[0]!);
  const current = prompts[style]!;

  useEffect(() => {
    const saved = readImageStyle();
    if (saved && saved in prompts) setStyle(saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const changeStyle = (next: string) => {
    setStyle(next);
    try {
      localStorage.setItem(IMAGE_STYLE_KEY, next);
    } catch {
      // 기억 못 해도 이번 화면에서는 동작한다
    }
  };
  return (
    <section className="card">
      <h3>
        이미지 5장 프롬프트 <small>Gemini용</small>
      </h3>
      <p className="hint-text">
        1~5번이 초안의 본문 이미지 1~5번 자리 그대로예요. 대표 썸네일은 아래 썸네일 만들기로 만들어요. 확장 프로그램 이미지 모음을 열어 두면 만든 이미지가 저절로 모여요.
      </p>
      <div className="image-prompt-actions">
        <select value={style} onChange={(e) => changeStyle(e.target.value)} aria-label="이미지 스타일">
          {keys.map((k) => (
            <option key={k} value={k}>
              {prompts[k]!.label}
            </option>
          ))}
        </select>
        <CopyButton text={current.text} label="프롬프트 복사" />
        <a className="button small" href="https://gemini.google.com/app" target="_blank" rel="noreferrer">
          Gemini 열기
        </a>
      </div>
      <details className="image-prompt-preview">
        <summary>내용 보기</summary>
        <pre>{current.text}</pre>
      </details>
    </section>
  );
}
