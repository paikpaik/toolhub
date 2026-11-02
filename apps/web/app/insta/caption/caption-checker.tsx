"use client";

import { CAPTION_MAX, lintCaption } from "@toolhub/insta";
import { useMemo, useState } from "react";

const SAMPLE = `연말정산 미리보기, 12월 18일에 닫혀요.

월세랑 부양가족 공제는 자동으로 안 들어가서 직접 넣어야 해요. 저는 월세만 넣고 17만원이 달라졌어요.

정리한 체크리스트는 프로필 링크에 있어요.

#연말정산 #연말정산미리보기 #직장인`;

const MARK = { pass: "✓", warn: "!", fail: "✗" } as const;
const VERDICT = { pass: "올려도 돼요", warn: "확인 필요", fail: "고쳐야 해요" } as const;

/** 입력하는 대로 점검한다 (MCP check_caption과 같은 로직) */
export function CaptionChecker() {
  const [caption, setCaption] = useState("");
  const [keywords, setKeywords] = useState("");
  const result = useMemo(
    () => (caption.trim() ? lintCaption(caption, { keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean) }) : null),
    [caption, keywords],
  );

  return (
    <div className="insta-layout">
      <div className="insta-inputs">
        <label>
          <span>
            캡션 <small>{caption.length.toLocaleString()} / {CAPTION_MAX.toLocaleString()}자</small>
          </span>
          <textarea rows={14} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder={SAMPLE} />
        </label>
        <label>
          <span>
            검색어 <small>쉼표로 구분 · 문장 속에 들어 있는지 확인</small>
          </span>
          <input value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="연말정산 미리보기, 월세 공제" />
        </label>
        {!caption && (
          <div className="insta-options">
            <button type="button" className="button small" onClick={() => setCaption(SAMPLE)}>
              예시 넣어 보기
            </button>
          </div>
        )}
      </div>

      <div className="insta-results">
        {result ? (
          <>
            <section className="card">
              <h3>피드에 보이는 부분</h3>
              <div className="feed-preview">
                <p>{result.preview}</p>
                <span className="feed-more">… 더 보기</span>
              </div>
            </section>
            <section className="card">
              <h3>
                점검 <span className={`verdict ${result.verdict}`}>{VERDICT[result.verdict]}</span>
              </h3>
              <ul className="check-list">
                {result.checks.map((c) => (
                  <li key={c.label} className={c.level}>
                    <span className="check-mark">{MARK[c.level]}</span> <strong>{c.label}</strong> {c.detail}
                  </li>
                ))}
              </ul>
            </section>
          </>
        ) : (
          <p className="empty">캡션을 붙여넣으면 피드에서 어떻게 보이는지와 고칠 점을 바로 보여 줘요. Claude 앱에서 &ldquo;이 릴스 캡션 써줘&rdquo;라고 하면 같은 기준으로 써서 점검까지 해 줍니다.</p>
        )}
      </div>
    </div>
  );
}
