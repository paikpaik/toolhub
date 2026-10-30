/**
 * drafts/ 폴더의 블로그 초안 (MCP save_draft, /blog-draft 스킬이 저장)
 * 파일 이름: YYYY-MM-DD-<키워드>-<플랫폼>[-n].md
 * 내용 형식은 docs/prompts/writing.md의 "출력 형식"을 따른다.
 */
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isPlatform, type Platform } from "./platforms.ts";
import { normalizeKeyword } from "./sources.ts";

export interface DraftSummary {
  file: string;
  date: string | null;
  keyword: string;
  platform: Platform | null;
  updatedAt: string;
}

const FILE_NAME = /^(\d{4}-\d{2}-\d{2})-(.+?)-(tistory|blogger|naver)(?:-\d+)?\.md$/;

/** 최근에 수정한 순 */
export async function listDrafts(dir: string): Promise<DraftSummary[]> {
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith(".md"));
  const drafts = await Promise.all(
    files.map(async (file) => {
      const match = FILE_NAME.exec(file);
      const platform = match?.[3];
      return {
        file,
        date: match?.[1] ?? null,
        keyword: match?.[2]?.replace(/-/g, " ") ?? file.replace(/\.md$/, ""),
        platform: isPlatform(platform) ? platform : null,
        updatedAt: (await stat(path.join(dir, file))).mtime.toISOString(),
      };
    }),
  );
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** 폴더 밖 파일을 다루지 못하도록 파일 이름만 받는다 */
const isDraftFileName = (file: string) => path.basename(file) === file && file.endsWith(".md");

export async function readDraftFile(dir: string, file: string): Promise<string | null> {
  if (!isDraftFileName(file)) return null;
  return readFile(path.join(dir, file), "utf-8").catch(() => null);
}

/**
 * 이미 있는 초안을 고친 내용으로 덮어쓴다. 되돌릴 수 있도록 이전 버전을 drafts/.history/에 남긴다.
 * 없는 파일이면 만들지 않고 null을 돌려준다 (새 초안은 저장 기능으로 만든다).
 */
export async function updateDraftFile(dir: string, file: string, content: string) {
  if (!isDraftFileName(file) || (await readDraftFile(dir, file)) === null) return null;
  const historyDir = path.join(dir, ".history");
  await mkdir(historyDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = path.join(historyDir, `${file.replace(/\.md$/, "")}.${stamp}.md`);
  await copyFile(path.join(dir, file), backup);
  await writeFile(path.join(dir, file), content.endsWith("\n") ? content : `${content}\n`);
  return { file, backup };
}

/** 같은 키워드(공백·구두점 무시)로 쓴 초안 */
export function draftsForKeyword(drafts: DraftSummary[], keyword: string) {
  const key = normalizeKeyword(keyword);
  return drafts.filter((d) => normalizeKeyword(d.keyword) === key);
}

/** 키워드(정규화) → 그 키워드로 쓴 초안들. 키워드 기록에 "초안 있음"을 표시할 때 쓴다 */
export function indexDraftsByKeyword(drafts: DraftSummary[]) {
  const index = new Map<string, DraftSummary[]>();
  for (const d of drafts) {
    const key = normalizeKeyword(d.keyword);
    index.set(key, [...(index.get(key) ?? []), d]);
  }
  return index;
}

/** 본문의 첫 문장 (새 글이 이전 글과 같은 시작을 하지 않도록 비교하는 용도) */
export function draftOpening(body: string | null, maxLength = 80) {
  if (!body) return null;
  const text = body
    .replace(MARKER_PATTERN, " ")
    // 소제목은 도입 문장이 아니므로 뺀다 (HTML 제목 태그, 네이버 ■ 줄, 마크다운 #)
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, " ")
    .replace(/^\s*(?:■|#).*$/gm, " ")
    // 문단 경계는 공백으로, 인라인 태그(<strong> 등)는 그냥 지워 "출생연도 에" 같은 빈칸이 생기지 않게 한다
    .replace(/<\/(?:p|div|li|td|th|blockquote)>|<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;|&#\d+;/g, " ")
    .replace(/^[★>\-\s]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  const sentence = /^.+?[.!?。]|^.+$/.exec(text)?.[0] ?? "";
  return sentence.length > maxLength ? `${sentence.slice(0, maxLength)}…` : sentence || null;
}

export type DraftMarkerType = "image" | "write" | "check";

/** 초안 속 사람이 채울 자리: [이미지: …], [직접 작성: …], [확인 필요: …] */
export interface DraftMarker {
  type: DraftMarkerType;
  text: string;
}

export interface ParsedDraft {
  titles: { text: string; recommended: boolean }[];
  meta: string | null;
  tags: string[];
  /** 본문 코드 블록 내용 */
  body: string | null;
  /** 본문 코드 블록 언어 (html, text 등) */
  bodyLang: string | null;
  threads: string[];
  markers: DraftMarker[];
  /** 제목 후보·태그 등으로 분류하지 못한 나머지 섹션 */
  others: { heading: string; content: string }[];
}

export const MARKER_PATTERN = /\[(이미지|직접 작성|확인 필요):\s*([^\]]+)\]/g;
const MARKER_TYPES: Record<string, DraftMarkerType> = { 이미지: "image", "직접 작성": "write", "확인 필요": "check" };

/** ## 제목으로 섹션을 나눈다. 코드 블록 안의 ##은 무시한다 */
function splitSections(markdown: string) {
  const sections: { heading: string; lines: string[] }[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const heading = !inFence && /^##\s+(.+)/.exec(line);
    if (heading) sections.push({ heading: heading[1]!.trim(), lines: [] });
    else sections.at(-1)?.lines.push(line);
  }
  return sections.map((s) => ({ heading: s.heading, content: s.lines.join("\n").trim() }));
}

function codeBlocks(content: string) {
  return [...content.matchAll(/```(\w*)[^\n]*\n([\s\S]*?)```/g)].map((m) => ({ lang: m[1] || null, code: m[2]!.trimEnd() }));
}

/** 목록 기호·번호·굵게 표시를 걷어낸 줄 */
const listItems = (content: string) =>
  content
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*+]|\d+[.)])\s+/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);

export function parseDraft(markdown: string): ParsedDraft {
  // /blog-draft 스킬이 맨 위에 접어 둔 브리프는 제외
  const sections = splitSections(markdown.replace(/<details>[\s\S]*?<\/details>/g, ""));
  const used = new Set<number>();
  const find = (...keys: string[]) => {
    const index = sections.findIndex((s, i) => !used.has(i) && keys.some((k) => s.heading.includes(k)));
    if (index < 0) return null;
    used.add(index);
    return sections[index]!.content;
  };

  const titleSection = find("제목");
  const metaSection = find("메타", "검색 설명");
  const tagSection = find("태그", "라벨");
  const bodySection = find("본문");
  const threadSection = find("스레드");

  const titles = listItems(titleSection ?? "").map((line) => {
    const recommended = /추천|⭐|★/.test(line);
    const text = line
      .replace(/\s*[(（\[]?\s*(?:추천|⭐|★)[^)）\]]*[)）\]]?\s*/g, " ")
      .trim()
      // 제목 전체를 감싼 따옴표만 벗긴다 ("나는 언제 받지?" 국민연금… 같은 제목은 그대로)
      .replace(/^["“]([^"“”]*)["”]$/, "$1");
    return { text, recommended };
  });

  const metaCode = codeBlocks(metaSection ?? "")[0]?.code;
  const meta = (metaCode ?? metaSection ?? "").replace(/^>\s*/gm, "").trim() || null;

  const tagSource = codeBlocks(tagSection ?? "")[0]?.code ?? tagSection ?? "";
  const tags = tagSource
    // 쉼표·줄바꿈 구분, 또는 "#태그1 #태그2"처럼 공백 + # 구분
    .split(/[,\n]|\s+(?=#)/)
    .map((t) => t.replace(/^\s*(?:[-*]\s+)?#?/, "").replace(/\*\*/g, "").trim())
    .filter(Boolean);

  const bodyBlock = codeBlocks(bodySection ?? "")[0];
  const body = bodyBlock?.code ?? null;
  const threads = codeBlocks(threadSection ?? "").map((b) => b.code);

  const markers = [...(body ?? markdown).matchAll(MARKER_PATTERN)].map((m) => ({
    type: MARKER_TYPES[m[1]!]!,
    text: m[2]!.trim(),
  }));

  return {
    titles,
    meta,
    tags,
    body,
    bodyLang: bodyBlock?.lang ?? null,
    threads,
    markers,
    others: sections.filter((_, i) => !used.has(i)),
  };
}
