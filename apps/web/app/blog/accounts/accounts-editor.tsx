"use client";

import { BLOG_TOPIC_GROUPS, newAccountId, type BlogAccount, type BlogTopic } from "@toolhub/collector/accounts";
import { backgroundUrl, DEFAULT_THUMBNAIL_STYLE, type ThumbnailStyle } from "@toolhub/collector/thumbnail-style";
import { useRef, useState } from "react";
import { Icon } from "../../icons";
import { AccountThumbnailCanvas } from "../thumbnail/account-thumbnail";
import { COLOR_PRESETS, TEMPLATES } from "../thumbnail/draw";
import type { ThumbnailFont } from "../thumbnail/fonts";

/** 계정 썸네일 미리보기 문구 (초안은 대표 썸네일 표시의 문구를 쓴다) */
const SAMPLE_TEXT = "썸네일 *문구*가\n이렇게 들어가요";

type TopicStat = { topic: string; drafts: number; published: number };

async function saveAccounts(accounts: BlogAccount[]): Promise<BlogAccount[]> {
  const res = await fetch("/api/accounts", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accounts }) });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "저장하지 못했어요");
  return body.accounts;
}

/** 계정 목록. 계정을 누르면 펼쳐져 분야를 여러 개 고르고, 이름을 바꾸거나 지운다. 바꾸면 바로 저장한다 */
export function AccountsEditor({ initial, stats, fonts }: { initial: BlogAccount[]; stats: Record<string, TopicStat[]>; fonts: ThumbnailFont[] }) {
  const [accounts, setAccounts] = useState(initial);
  const [open, setOpen] = useState<string | null>(initial[0]?.id ?? null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const save = async (next: BlogAccount[]) => {
    const prev = accounts;
    setAccounts(next);
    try {
      setAccounts(await saveAccounts(next));
      setMessage("");
    } catch (e) {
      setAccounts(prev);
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const change = (id: string, patch: Partial<BlogAccount>) => save(accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)));

  // 색·덮기처럼 끌면서 바뀌는 값은 화면은 바로, 저장은 멈춘 뒤 한 번
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const changeStyle = (id: string, patch: Partial<ThumbnailStyle>) => {
    const next = accounts.map((a) => (a.id === id ? { ...a, thumbnail: { ...a.thumbnail, ...patch } } : a));
    setAccounts(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => save(next), 500);
  };

  /** 배경 이미지 올리기·지우기는 서버가 목록을 고쳐 돌려준다 */
  const backgroundRequest = async (request: Promise<Response>) => {
    try {
      const res = await request;
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "저장하지 못했어요");
      setAccounts(body.accounts);
      setMessage("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e));
    }
  };
  const upload = async (account: BlogAccount, files: FileList | null) => {
    for (const file of files ?? []) {
      const form = new FormData();
      form.set("account", account.id);
      form.set("file", file);
      await backgroundRequest(fetch("/api/accounts/background", { method: "POST", body: form }));
    }
  };
  const removeBackground = (account: BlogAccount, name: string) =>
    backgroundRequest(fetch(`/api/accounts/background?account=${account.id}&name=${name}`, { method: "DELETE" }));

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const account: BlogAccount = { id: newAccountId(), name: trimmed, topics: [], thumbnail: DEFAULT_THUMBNAIL_STYLE };
    save([...accounts, account]);
    setName("");
    setOpen(account.id);
  };
  const remove = (account: BlogAccount) => {
    if (!confirm(`계정 "${account.name}"을 지울까요? 초안은 지우지 않고, 그 초안들은 계정 없음으로 보여요.`)) return;
    save(accounts.filter((a) => a.id !== account.id));
  };
  const toggleTopic = (account: BlogAccount, topic: BlogTopic) =>
    change(account.id, { topics: account.topics.includes(topic) ? account.topics.filter((t) => t !== topic) : [...account.topics, topic] });

  return (
    <>
      <div className="account-list">
        {accounts.map((account) => {
          const isOpen = open === account.id;
          const rows = stats[account.id] ?? [];
          return (
            <section key={account.id} className={`card account-card${isOpen ? " open" : ""}`}>
              <button type="button" className="account-head" onClick={() => setOpen(isOpen ? null : account.id)} aria-expanded={isOpen}>
                <span className="row-chevron" aria-hidden="true">
                  {isOpen ? "▾" : "▸"}
                </span>
                <strong>{account.name}</strong>
                <span className="account-topics">{account.topics.length ? account.topics.join(", ") : "분야 미정"}</span>
              </button>
              {isOpen && (
                <div className="account-body">
                  <div className="account-name-row">
                    <label>
                      이름
                      <input
                        defaultValue={account.name}
                        maxLength={20}
                        onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== account.name && change(account.id, { name: e.target.value.trim() })}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    </label>
                    <label title="blog.naver.com/아이디 의 아이디. 확장의 '유입 검색어 복사'가 블로그 통계 화면이 어느 계정인지 알아볼 때 써요">
                      블로그 아이디
                      <input
                        defaultValue={account.blogId ?? ""}
                        maxLength={60}
                        placeholder="예: myblog123"
                        onBlur={(e) => e.target.value.trim() !== (account.blogId ?? "") && change(account.id, { blogId: e.target.value.trim() || undefined })}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      />
                    </label>
                    <button type="button" className="button small" onClick={() => remove(account)}>
                      <Icon name="trash" size={14} /> 계정 지우기
                    </button>
                  </div>
                  <p className="hint-text">선호 분야를 여러 개 골라요 (네이버 블로그 주제 분류). 분야를 고르지 않으면 어느 분야든 상위 키워드를 써요.</p>
                  {BLOG_TOPIC_GROUPS.map((group) => (
                    <div key={group.name} className="topic-group">
                      <small>{group.name}</small>
                      <div className="topic-chips">
                        {group.topics.map((topic) => {
                          const on = account.topics.includes(topic);
                          return (
                            <button key={topic} type="button" className={`topic-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => toggleTopic(account, topic)}>
                              {topic}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <h4>썸네일</h4>
                  <div className="account-thumb">
                    <AccountThumbnailCanvas
                      fonts={fonts}
                      style={account.thumbnail}
                      text={SAMPLE_TEXT}
                      background={account.thumbnail.backgrounds[0] ? backgroundUrl(account.id, account.thumbnail.backgrounds[0]) : null}
                      onError={setMessage}
                    />
                    <div className="account-thumb-controls">
                      <div>
                        <small>
                          배경 이미지 {account.thumbnail.backgrounds.length}장 ·{" "}
                          {account.thumbnail.backgrounds.length === 0
                            ? "없으면 배경색 단색"
                            : account.thumbnail.backgrounds.length === 1
                              ? "모든 초안이 이 배경으로 고정"
                              : "초안마다 돌려 써요 (같은 초안은 늘 같은 배경)"}
                        </small>
                        <div className="background-list">
                          {account.thumbnail.backgrounds.map((name) => (
                            <span key={name} className="background-item">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={backgroundUrl(account.id, name)} alt="배경 이미지" />
                              <button type="button" onClick={() => removeBackground(account, name)} aria-label="배경 이미지 지우기" title="지우기">
                                <Icon name="close" size={12} />
                              </button>
                            </span>
                          ))}
                          <label className="background-add" title="PNG·JPG·WebP, 8MB까지, 여러 장 가능">
                            <Icon name="plus" size={14} /> 올리기
                            <input type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(e) => upload(account, e.target.files).then(() => (e.target.value = ""))} />
                          </label>
                        </div>
                      </div>
                      <label>
                        템플릿
                        <select value={account.thumbnail.template} onChange={(e) => changeStyle(account.id, { template: e.target.value })}>
                          {TEMPLATES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        글꼴
                        <select value={account.thumbnail.fontId} onChange={(e) => changeStyle(account.id, { fontId: e.target.value })}>
                          {fonts.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="color-row">
                        {(["bg", "text", "accent"] as const).map((key) => (
                          <label key={key}>
                            {{ bg: "배경색", text: "글자", accent: "강조" }[key]}
                            <input
                              type="color"
                              value={account.thumbnail.colors[key]}
                              onChange={(e) => changeStyle(account.id, { colors: { ...account.thumbnail.colors, [key]: e.target.value } })}
                            />
                          </label>
                        ))}
                        <select aria-label="색 조합" value="" onChange={(e) => e.target.value && changeStyle(account.id, { colors: COLOR_PRESETS.find((p) => p.id === e.target.value)!.colors })}>
                          <option value="">색 조합…</option>
                          {COLOR_PRESETS.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label>
                        배경 덮기 {Math.round(account.thumbnail.overlay * 100)}% <small>배경 이미지 위에 배경색을 덮어 글자가 읽히게</small>
                        <input
                          type="range"
                          min={0}
                          max={0.9}
                          step={0.05}
                          value={account.thumbnail.overlay}
                          onChange={(e) => changeStyle(account.id, { overlay: Number(e.target.value) })}
                        />
                      </label>
                      <label>
                        블로그 이름
                        <input value={account.thumbnail.blogName} maxLength={30} onChange={(e) => changeStyle(account.id, { blogName: e.target.value })} />
                      </label>
                      <label>
                        라벨 <small>예: 정보, 오늘의 이슈</small>
                        <input value={account.thumbnail.label} maxLength={30} onChange={(e) => changeStyle(account.id, { label: e.target.value })} />
                      </label>
                    </div>
                  </div>

                  <h4>분야별 초안</h4>
                  {rows.length ? (
                    <table className="account-stats">
                      <thead>
                        <tr>
                          <th>분야</th>
                          <th className="num">발행</th>
                          <th className="num">초안</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.topic}>
                            <td>{r.topic}</td>
                            <td className="num">{r.published}</td>
                            <td className="num">{r.drafts}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="hint-text">아직 이 계정으로 쓴 초안이 없어요. 계정별로 초안을 쓰면 분야마다 몇 편을 썼고 발행했는지 여기 쌓여요.</p>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <form className="account-add" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="계정 이름 (예: 블로그 아이디나 별명)" aria-label="새 계정 이름" />
        <button type="submit" className="button primary" disabled={!name.trim()}>
          <Icon name="plus" size={14} /> 계정 추가
        </button>
      </form>
      {message && <p className="error">{message}</p>}
    </>
  );
}
