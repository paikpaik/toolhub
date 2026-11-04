import { buildImagePrompt, IMAGE_PROMPT_STYLES, listDrafts, parseDraft, PLATFORM_LABELS, readDraftFile, readDraftStatuses, adjacentDrafts, type ImagePromptStyle } from "@toolhub/collector";
import { isOpen, readStore } from "@toolhub/tasks";
import Link from "next/link";
import { DATA_DIR, DRAFTS_DIR } from "../../../../lib/data";
import { AddTaskPopover } from "../../../add-task-popover";
import { countBodyChars, naverPasteHtml, previewDocument } from "../../../../lib/preview";
import { Icon } from "../../../icons";
import { CopyButton } from "../../copy-button";
import { DraftChecklist } from "../checklist";
import { DraftStatusCard } from "../status-control";
import { THUMBNAIL_FONTS } from "../../thumbnail/fonts";
import { ImagePromptCard } from "./image-prompt";
import { ThumbnailButton, ThumbnailPanel } from "./thumbnail-panel";

export const dynamic = "force-dynamic";

/** 플랫폼별 권장 분량 (docs/prompts/platforms/*.md) */
const TARGET_CHARS = { tistory: "2,000~3,000자", blogger: "2,000~3,500자", naver: "1,500~2,500자" } as const;

export default async function DraftViewPage({ searchParams }: { searchParams: Promise<{ file?: string }> }) {
  const { file = "" } = await searchParams;
  const markdown = await readDraftFile(DRAFTS_DIR, file);
  const allDrafts = await listDrafts(DRAFTS_DIR);
  const summary = allDrafts.find((d) => d.file === file);

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
  // 네이버 텍스트 본문은 ■·★·표를 서식으로 바꿔 복사할 수 있다
  const naverText = platform === "naver" && draft.bodyLang !== "html";
  const recommendedTitle = draft.titles.find((t) => t.recommended)?.text ?? draft.titles[0]?.text ?? summary.keyword;
  const imagePrompts = Object.fromEntries(
    (Object.keys(IMAGE_PROMPT_STYLES) as ImagePromptStyle[]).map((style) => [
      style,
      { label: IMAGE_PROMPT_STYLES[style].label, text: buildImagePrompt({ title: recommendedTitle, keyword: summary.keyword, body: draft.body, style }) },
    ]),
  );

  // 이 초안으로 만든 발행 할 일 (링크로 찾는다). 있으면 새로 만들지 않고 그 할 일로 안내한다
  const draftHref = `/blog/drafts/view?file=${encodeURIComponent(file)}`;
  const publishTask = (await readStore(DATA_DIR)).tasks.find((t) => t.link === draftHref && isOpen(t));
  const statuses = await readDraftStatuses(DATA_DIR);
  const status = statuses[file];
  // 초안 목록과 같은 순서(최근 수정 순)에서 앞뒤의 "초안" 상태 글. 예약됨·발행됨은 건너뛴다
  const near = adjacentDrafts(allDrafts.map((d) => d.file), file, statuses);
  const keywordOf = (f: string | null) => allDrafts.find((d) => d.file === f)?.keyword ?? "";
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
        <h1 className="draft-title">
          <DraftNavLink file={near.prev} keyword={keywordOf(near.prev)} direction="prev" />
          <DraftNavLink file={near.next} keyword={keywordOf(near.next)} direction="next" />
          {summary.keyword} <small>{platform ? PLATFORM_LABELS[platform] : ""} · {summary.date}</small>
        </h1>
        {publishTask ? (
          <Link className="button" href={`/tasks?view=all&task=${publishTask.id}`} title="이 초안의 발행 할 일">
            ✓ 할 일 #{publishTask.id}
          </Link>
        ) : (
          <AddTaskPopover
            key={file}
            text={`${summary.keyword} 글 발행 내일`}
            defaults={{ link: draftHref, subtasks }}
            label="발행 할 일"
            title={`발행 할 일 만들기${subtasks.length ? ` (남은 자리 ${subtasks.length}개가 하위 할 일로)` : ""}`}
          />
        )}
        <ThumbnailButton />
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
                  {naverText ? (
                    <>
                      <CopyButton text={draft.body} label="텍스트로 복사" />
                      <CopyButton text={draft.body} html={naverPasteHtml(draft.body)} label="서식 포함 복사" primary />
                    </>
                  ) : (
                    <CopyButton text={draft.body} label={draft.bodyLang === "html" ? "본문 HTML 복사" : "본문 복사"} primary />
                  )}
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

          <ThumbnailPanel key={file} fonts={THUMBNAIL_FONTS} title={recommendedTitle} />

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
          {/* 이전·다음 초안으로 옮기면 화면을 새로 그리지 않으므로, 초안마다 새로 만들어 앞 초안의 상태가 남지 않게 한다 */}
          <DraftStatusCard key={file} file={file} entry={status} />

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
              {/* 네이버는 보이는 그대로(#태그 #태그) 붙여넣으면 태그가 나뉜다. 티스토리·Blogger 태그 칸은 쉼표로 나눈다 */}
              <CopyButton text={platform === "naver" ? draft.tags.map((t) => `#${t}`).join(" ") : draft.tags.join(", ")} label="전체 복사" />
            </section>
          )}

          <ImagePromptCard prompts={imagePrompts} />

          <section className="card">
            <h3>발행 전 체크리스트</h3>
            <DraftChecklist file={file} markers={draft.markers} />
          </section>
        </aside>
      </div>
    </main>
  );
}

/** 앞·뒤의 "초안" 상태 글로 가는 버튼. 없으면 눌리지 않는다 */
function DraftNavLink({ file, keyword, direction }: { file: string | null; keyword: string; direction: "prev" | "next" }) {
  const icon = <Icon name={direction === "prev" ? "chevronLeft" : "chevronRight"} />;
  const label = direction === "prev" ? "이전 초안" : "다음 초안";
  if (!file) {
    return (
      <span className="icon-button draft-nav disabled" aria-disabled="true" title={`${label} 없음 (예약됨·발행됨은 건너뜀)`}>
        {icon}
      </span>
    );
  }
  return (
    <Link className="icon-button draft-nav" href={`/blog/drafts/view?file=${encodeURIComponent(file)}`} title={`${label}: ${keyword}`} aria-label={`${label}: ${keyword}`}>
      {icon}
    </Link>
  );
}

function PasteGuide({ platform }: { platform: keyof typeof TARGET_CHARS }) {
  const guide = {
    tistory: "티스토리 글쓰기 → 오른쪽 위 기본모드를 HTML로 바꾼 뒤 본문을 붙여넣으세요.",
    blogger: "Blogger 글쓰기 → 왼쪽 위 연필 아이콘에서 HTML 보기로 바꾼 뒤 붙여넣고, 메타 설명은 설정의 '검색 설명'에 넣으세요.",
    naver:
      "'서식 포함 복사'로 붙여넣으면 굵게·표가 입혀진 채 들어가요. 소제목은 크롬 확장의 '소제목 정리'를 누르면 네이버 소제목으로 바뀌어요. 서식이 빠지면 '텍스트로 복사'로 붙여넣고 ■ 줄은 소제목, ★ 줄은 굵게 바꾼 뒤 기호를 지우세요.",
  }[platform];
  return (
    <p className="notice">
      {guide} <Link href={`/blog/guide?p=${platform}`}>발행 순서 전체 보기 →</Link>
    </p>
  );
}
