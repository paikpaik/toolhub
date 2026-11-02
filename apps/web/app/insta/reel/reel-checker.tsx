"use client";

import { beatSheet, checkHook, DEFAULT_SYLLABLES_PER_SECOND } from "@toolhub/insta";
import { useMemo, useState } from "react";

const SAMPLE_HOOKS = "안녕하세요 여러분, 오늘은 연말정산 얘기를 해볼게요\n첫 연말정산이라면, 이것 하나로 47만원 돌려받아요";
const SAMPLE_SCRIPT = [
  "연말정산 미리보기, 12월 18일에 닫혀요.",
  "월세는 자동으로 안 들어가요.",
  "계약서랑 이체내역만 있으면 돼요.",
  "저는 이걸로 17만원 돌려받았어요.",
  "12월 18일 전에 꼭 확인하세요.",
].join("\n");

const VERDICT_CLASS = { 좋음: "pass", 보통: "warn", 약함: "fail" } as const;

/** 입력하는 대로 훅·구성표를 다시 계산한다 (점검 로직은 MCP check_reel_script와 같음) */
export function ReelChecker() {
  const [hooks, setHooks] = useState("");
  const [script, setScript] = useState("");
  const [target, setTarget] = useState("");
  const [sps, setSps] = useState(String(DEFAULT_SYLLABLES_PER_SECOND));

  const speed = Number(sps) || DEFAULT_SYLLABLES_PER_SECOND;
  const hookResults = useMemo(
    () =>
      hooks
        .split("\n")
        .map((h) => h.trim())
        .filter(Boolean)
        .map((h) => checkHook(h, speed)),
    [hooks, speed],
  );
  const sheet = useMemo(() => (script.trim() ? beatSheet(script, { target: Number(target) || undefined, sps: speed }) : null), [script, target, speed]);

  return (
    <div className="insta-layout">
      <div className="insta-inputs">
        <label>
          <span>
            훅 후보 <small>한 줄에 하나 · 말하는 첫 문장</small>
          </span>
          <textarea rows={4} value={hooks} onChange={(e) => setHooks(e.target.value)} placeholder={SAMPLE_HOOKS} />
        </label>
        <label>
          <span>
            대본 <small>한 줄이 한 장면</small>
          </span>
          <textarea rows={10} value={script} onChange={(e) => setScript(e.target.value)} placeholder={SAMPLE_SCRIPT} />
        </label>
        <div className="insta-options">
          <label>
            목표 길이 <input type="number" min={5} max={180} value={target} onChange={(e) => setTarget(e.target.value)} placeholder="30" /> 초
          </label>
          <label title="직접 소리 내 읽어 보고 맞추면 더 정확해요. 아나운서는 5 안팎, 빠른 릴스 내레이션은 7 안팎">
            말 속도 <input type="number" min={3} max={9} step={0.5} value={sps} onChange={(e) => setSps(e.target.value)} /> 음절/초
          </label>
          {!hooks && !script && (
            <button
              type="button"
              className="button small"
              onClick={() => {
                setHooks(SAMPLE_HOOKS);
                setScript(SAMPLE_SCRIPT);
              }}
            >
              예시 넣어 보기
            </button>
          )}
        </div>
      </div>

      <div className="insta-results">
        {hookResults.length > 0 && (
          <section className="card">
            <h3>
              훅 점검 <small>약한 훅을 거르는 용도예요. 괜찮은 훅 둘 중 무엇이 잘될지는 찍어 봐야 알아요</small>
            </h3>
            {hookResults.map((r) => (
              <div key={r.text} className="hook-result">
                <p>
                  <span className={`verdict ${VERDICT_CLASS[r.verdict]}`}>{r.verdict}</span> {r.text} <small>약 {r.seconds}초</small>
                </p>
                <ul className="check-list">
                  {r.checks.map((c) => (
                    <li key={c.label} className={c.ok ? "pass" : "fail"}>
                      <strong>{c.label}</strong> {c.detail}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}

        {sheet && (
          <section className="card">
            <h3>
              구성표 <small>{sheet.beats.length}장면 · 약 {sheet.total}초</small>
            </h3>
            <ol className="beat-list">
              {sheet.beats.map((b, i) => (
                <li key={i} className={b.seconds > 4 || (i === 0 && b.seconds > 3) ? "long" : undefined}>
                  <span className="beat-time">
                    {b.start.toFixed(1)}s <small>{b.seconds}초</small>
                  </span>
                  <span className="beat-role">{b.role === "본문" ? "" : b.role}</span>
                  <span className="beat-text">{b.text}</span>
                </li>
              ))}
            </ol>
            <ul className="check-list">
              {sheet.checks.map((c) => (
                <li key={c.label} className={c.ok ? "pass" : "fail"}>
                  <strong>{c.label}</strong> {c.detail}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!hookResults.length && !sheet && (
          <p className="empty">훅 후보나 대본을 넣으면 바로 점검해요. 대본은 Claude 앱에서 &ldquo;이 초안으로 릴스 대본 써줘&rdquo;라고 하면 같은 규칙으로 써 줍니다.</p>
        )}
      </div>
    </div>
  );
}
