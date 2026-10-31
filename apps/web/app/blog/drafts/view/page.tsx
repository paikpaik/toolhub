import { listDrafts, parseDraft, PLATFORM_LABELS, readDraftFile } from "@toolhub/collector";
import { isOpen, readStore } from "@toolhub/tasks";
import Link from "next/link";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";
import { AddTaskPopover } from "../../../add-task-popover";
import { countBodyChars, previewDocument } from "../../../../lib/preview";
import { CopyButton } from "../../copy-button";
import { DraftChecklist } from "../checklist";

export const dynamic = "force-dynamic";

/** 플랫폼별 권장 분량 (docs/prompts/platforms/*.md) */
const TARGET_CHARS = { tistory: "2,000~3,000자", blogger: "2,000~3,500자", naver: "1,500~2,500자" } as const;

export default async function DraftViewPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const { file = "" } = await searchParams;
  const markdown = await readDraftFile(DRAFTS_DIR, file);
  const summary = (await listDrafts(DRAFTS_DIR)).find((d) => d.file === file);

  if (markdown === null || !summary) {
    return (
      <main>
        <header>
          <h1>초안을 찾을 수 없습니다</h1>
          <Link className="button" href="/blog/drafts">
            목록으로
          </Link>
        </header>
      </main>
    );
  }

  const draft = parseDraft(markdown);
  const platform = summary.platform;
  const recommendedTitle = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? summary.keyword;
  const thumbnailHref = `/blog/thumbnail?title=${encodeURIComponent(recommendedTitle)}`;

  // 이 초안으로 만든 발행 할 일 (링크로 찾는다). 있으면 새로 만들지 않고 그 할 일로 안내한다
  const draftHref = `/blog/drafts/view?file=${encodeURIComponent(file)}`;
  const publishTask = (await readStore(DATA_DIR)).tasks.find((t) => t.link === draftHref && isOpen(t));
  // 남은 사람이 채울 자리를 발행 할 일의 하위 할 일로
  const markerLabel = { image: "이미지", write: "직접 작성", check: "확인" } as const;
  const subtasks = draft.markers.map((m, i) => ({
    id: `m${i}`,
    text: `${markerLabel[m.type]}: ${m.text.split("|")[0]!.trim().slice(0, 60)}`,
    done: false,
  }));

  return (
    <main>
      <header>
        <h1>
          {summary.keyword} <small>{platform ? PLATFORM_LABELS[platform] : ""} · {summary.date}</small>
        </h1>
        {publishTask ? (
          <Link className="button" href={`/tasks?view=all&task=${publishTask.id}`} title="이 초안의 발행 할 일">
            ✓ 할 일 #{publishTask.id}
          </Link>
        ) : (
          <AddTaskPopover
            text={`${summary.keyword} 글 발행 내일`}
            defaults={{ link: draftHref, subtasks }}
            label="발행 할 일"
            title={`발행 할 일 만들기${subtasks.length ? ` (남은 자리 ${subtasks.length}개가 하위 할 일로)` : ""}`}
          />
        )}
        <Link className="button" href={thumbnailHref}>
          썸네일 만들기
        </Link>
        <Link className="button" href="/blog/drafts">
          목록으로
        </Link>
      </header>

      {!draft.body && (
        <p className="notice">
          초안 형식을 읽지 못해 원본을 그대로 보여줍니다. (<code>## 본문</code> 아래 코드 블록이 없습니다)
        </p>
      )}

      <div className="draft-layout">
        <div className="draft-main">
          {draft.body && (
            <section>
              <h2>
                미리보기{" "}
                <small>
                  약 {countBodyChars(draft.body).toLocaleString()}자{platform && ` · 권장 ${TARGET_CHARS[platform]}`}
                </small>
                <span className="sort">
                  <CopyButton text={draft.body} label={draft.bodyLang === "html" ? "본문 HTML 복사" : "본문 복사"} primary />
                </span>
              </h2>
              <iframe
                className="preview"
                sandbox=""
                title="본문 미리보기"
                srcDoc={previewDocument(draft.body, platform, draft.bodyLang)}
              />
              {platform && <PasteGuide platform={platform} />}
            </section>
          )}

          {draft.threads.length > 0 && (
            <section>
              <h2>스레드 홍보글</h2>
              <div className="threads">
                {draft.threads.map((post, i) => (
                  <div key={i} className="card">
                    <pre>{post}</pre>
                    <div className="card-actions">
                      <small>{post.length}자</small>
                      <CopyButton text={post} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <details className="raw" open={!draft.body}>
            <summary>원본 마크다운 {draft.others.length > 0 && `(그 밖의 섹션 ${draft.others.length}개 포함)`}</summary>
            <div className="card-actions">
              <CopyButton text={markdown} label="원본 전체 복사" />
            </div>
            <pre>{markdown}</pre>
          </details>
        </div>

        <aside className="draft-side">
          {draft.titles.length > 0 && (
            <section className="card">
              <h3>제목</h3>
              <ul className="copy-list">
                {draft.titles.map((t, i) => (
                  <li key={i}>
                    <span>
                      {t.recommended && <span className="badge new">추천 </span>}
                      {t.text}
                      <small> {t.text.length}자</small>
                    </span>
                    <CopyButton text={t.text} />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {draft.meta && draft.meta !== "해당 없음" && (
            <section className="card">
              <h3>
                메타 설명 <small>{draft.meta.length}자</small>
              </h3>
              <p>{draft.meta}</p>
              <CopyButton text={draft.meta} />
            </section>
          )}

          {draft.tags.length > 0 && (
            <section className="card">
              <h3>
                태그 <small>{draft.tags.length}개</small>
              </h3>
              <p className="tags">{draft.tags.map((t) => `#${t}`).join(" ")}</p>
              <CopyButton text={draft.tags.join(", ")} label="쉼표로 복사" />
            </section>
          )}

          <section className="card">
            <h3>발행 전 체크리스트</h3>
            <DraftChecklist file={file} markers={draft.markers} />
          </section>
        </aside>
      </div>
    </main>
  );
}

function PasteGuide({ platform }: { platform: keyof typeof TARGET_CHARS }) {
  const guide = {
    tistory: "티스토리 글쓰기 → 오른쪽 위 기본모드를 HTML로 바꾼 뒤 본문을 붙여넣으세요.",
    blogger: "Blogger 글쓰기 → 왼쪽 위 연필 아이콘에서 HTML 보기로 바꾼 뒤 붙여넣고, 메타 설명은 설정의 '검색 설명'에 넣으세요.",
    naver: "스마트에디터에 붙여넣은 뒤 ■ 줄은 '소제목' 서식으로, ★ 줄은 굵게 바꾸고 기호를 지우세요.",
  }[platform];
  return (
    <p className="notice">
      {guide} <Link href={`/blog/guide?p=${platform}`}>발행 순서 전체 보기 →</Link>
    </p>
  );
}
