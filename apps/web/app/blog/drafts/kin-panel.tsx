"use client";

import type { DraftStatusEntry } from "@toolhub/collector/draft-status";
import { buildKinAnswerPrompt } from "@toolhub/collector/kin-answer";
import { useCallback, useEffect, useState } from "react";
import { createTtlCache } from "../../../lib/ttl-cache";
import { CopyButton } from "../copy-button";

interface Question {
  title: string;
  link: string;
  description: string;
}

/**
 * 같은 줄을 접었다 펴도 10분 동안은 다시 부르지 않는다 (검색 버튼은 새로 부른다).
 * 응답을 기다리는 중인 요청도 함께 쓰도록 Promise를 기억한다 (개발 모드에서 effect가 두 번 돌아도 한 번만 부르게)
 */
const kinCache = createTtlCache<Promise<Question[]>>(10 * 60_000);

function fetchKin(q: string, s: "date" | "sim", fresh: boolean) {
  const key = `${q}|${s}`;
  const cached = fresh ? undefined : kinCache.get(key);
  if (cached) return cached;
  const request = fetch(`/api/kin?q=${encodeURIComponent(q)}&sort=${s}`)
    .then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      return body.items as Question[];
    })
    .catch((e) => {
      // 실패한 결과는 기억하지 않는다
      kinCache.delete(key);
      throw e;
    });
  kinCache.set(key, request);
  return request;
}

async function saveAnswered(file: string, question: Question, answered: boolean): Promise<DraftStatusEntry> {
  const res = await fetch("/api/drafts/kin", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file, question: { link: question.link, title: question.title }, answered }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "저장하지 못했어요");
  return body;
}

/**
 * 초안 키워드의 지식iN 질문 목록. 질문마다 내 글로 답하는 답변을 Claude에게 부탁할 요청문을 만든다.
 * API는 질문 앞부분만 주므로, 질문 본문을 붙여넣을 칸을 둔다 (답변이 질문에 맞으려면 이게 가장 중요)
 */
export function KinPanel({ file, keyword, entry, onChange }: { file: string; keyword: string; entry?: DraftStatusEntry; onChange: (entry: DraftStatusEntry) => void }) {
  const [query, setQuery] = useState(keyword);
  const [sort, setSort] = useState<"date" | "sim">("date");
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState("");
  const [post, setPost] = useState<{ title: string; body: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [pasted, setPasted] = useState<Record<string, string>>({});

  const search = useCallback(async (q: string, s: "date" | "sim", fresh = false) => {
    setError("");
    setQuestions(null);
    try {
      setQuestions(await fetchKin(q, s, fresh));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQuestions([]);
    }
  }, []);

  useEffect(() => {
    search(keyword, "date");
    fetch(`/api/drafts/content?file=${encodeURIComponent(file)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setPost)
      .catch(() => setPost(null));
  }, [file, keyword, search]);

  const answered = new Map((entry?.answers ?? []).map((a) => [a.link, a]));
  const toggleAnswered = async (q: Question) => {
    try {
      onChange(await saveAnswered(file, q, !answered.has(q.link)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const url = entry?.url;
  // 지금 목록에 없는 (예전에 답한) 질문도 보이게
  const shownLinks = new Set((questions ?? []).map((q) => q.link));
  const olderAnswers = (entry?.answers ?? []).filter((a) => !shownLinks.has(a.link));

  return (
    <div className="kin-panel">
      <form
        className="kin-search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) search(query.trim(), sort, true);
        }}
      >
        <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="지식iN 검색어" />
        <select
          value={sort}
          onChange={(e) => {
            const next = e.target.value as "date" | "sim";
            setSort(next);
            if (query.trim()) search(query.trim(), next);
          }}
          aria-label="정렬"
        >
          <option value="date">최신순</option>
          <option value="sim">정확도순</option>
        </select>
        <button type="submit" className="button small">
          검색
        </button>
        <small>최신 질문일수록 아직 답이 적어요 · 다시 펼치면 10분 동안은 저장된 목록, 검색을 누르면 새로</small>
      </form>

      {!url && <p className="kin-warn">글 주소가 없어요. 위에서 발행됨으로 바꾸고 주소를 넣어야 답변에 링크가 들어가요. 지금 복사하면 [글 주소] 자리로 남아요.</p>}
      {error && <p className="error">{error}</p>}
      {questions === null ? (
        <p className="meta">지식iN 질문을 찾는 중…</p>
      ) : questions.length === 0 && !error ? (
        <p className="meta">질문이 없어요. 검색어를 바꿔 보세요.</p>
      ) : (
        <ul className="kin-list">
          {questions.map((q) => {
            const done = answered.get(q.link);
            const isOpen = open === q.link;
            return (
              <li key={q.link} className={done ? "answered" : undefined}>
                <div className="kin-row">
                  <div className="kin-text">
                    <a href={q.link} target="_blank" rel="noreferrer">
                      {q.title}
                    </a>
                    <p>{q.description}</p>
                  </div>
                  {done && <span className="status-badge published">답변함</span>}
                  <button type="button" className={`button small${isOpen ? "" : " primary"}`} onClick={() => setOpen(isOpen ? null : q.link)}>
                    {isOpen ? "닫기" : "답변 쓰기"}
                  </button>
                </div>
                {isOpen && (
                  <ol className="kin-steps">
                    <li>
                      <a href={q.link} target="_blank" rel="noreferrer">
                        질문 열기 ↗
                      </a>{" "}
                      질문 본문을 복사해 붙여넣어 주세요. 답변이 질문에 맞으려면 가장 중요해요.
                      <textarea
                        rows={4}
                        value={pasted[q.link] ?? ""}
                        onChange={(e) => setPasted({ ...pasted, [q.link]: e.target.value })}
                        placeholder="질문 본문 (비워 두면 위의 앞부분 요약만 들어가요)"
                      />
                    </li>
                    <li>
                      요청문을 복사해 Claude에 붙여넣으세요. 글로 답하기 어려운 질문이면 Claude가 &lsquo;답변 비추천&rsquo;이라고 알려 줘요.
                      <div className="kin-actions">
                        {post ? (
                          <CopyButton
                            primary
                            label="답변 요청문 복사"
                            text={buildKinAnswerPrompt({ question: q, questionBody: pasted[q.link], postTitle: post.title, postUrl: url, body: post.body })}
                          />
                        ) : (
                          <small>초안을 불러오는 중…</small>
                        )}
                        <a className="button small" href="https://claude.ai/new" target="_blank" rel="noreferrer">
                          Claude 열기 ↗
                        </a>
                      </div>
                    </li>
                    <li>
                      지식iN에 답변을 올렸으면 표시해 두세요. 같은 질문에 두 번 답하지 않게 돼요.
                      <div className="kin-actions">
                        <button type="button" className="button small" onClick={() => toggleAnswered(q)}>
                          {done ? "답변 표시 취소" : "답변함으로 표시"}
                        </button>
                      </div>
                    </li>
                  </ol>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {olderAnswers.length > 0 && (
        <details className="kin-older">
          <summary>이 글로 답한 다른 질문 {olderAnswers.length}개</summary>
          <ul className="link-list">
            {olderAnswers.map((a) => (
              <li key={a.link}>
                <a href={a.link} target="_blank" rel="noreferrer">
                  {a.title}
                </a>{" "}
                <small>{new Date(a.answeredAt).toLocaleDateString("ko-KR")}</small>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
