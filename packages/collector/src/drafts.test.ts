import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { draftOpening, draftsForKeyword, listDrafts, parseDraft, readDraftFile, updateDraftFile } from "./drafts.ts";

const TISTORY_DRAFT = `<details><summary>글쓰기 브리프</summary>

[글쓰기 브리프]
## 이 줄은 접힌 브리프 안이라 섹션이 아니다

</details>

## 1. 제목 후보
1. 국민연금 수령나이, 출생연도별로 한눈에 정리 (추천)
2. 국민연금 몇 살부터 받을까?
3. "나는 언제 받지?" 국민연금 수령나이 확인법
4. "따옴표로 감싼 제목"

## 2. 메타 설명
국민연금 수령나이는 출생연도에 따라 다릅니다.

## 3. 태그
국민연금, 국민연금 수령나이, 노령연금

## 4. 본문
\`\`\`html
<h2>출생연도별 수령나이</h2>
<p>국민연금 수령나이는 <strong>출생연도</strong>에 따라 다릅니다. 둘째 문장.</p>
<p>[이미지: 조회 화면 | alt: 조회 | 추천: 직접 캡처]</p>
<p>[직접 작성: 상담 경험]</p>
<p>감액률은 [확인 필요: 2026년 감액률] 입니다.</p>
## 코드 블록 안의 ##은 섹션이 아니다
\`\`\`

## 5. 이미지 목록
| 번호 | 내용 |

## 8. 스레드 홍보글
\`\`\`text
첫 번째 글
\`\`\`
\`\`\`text
두 번째 글
\`\`\`
`;

describe("parseDraft", () => {
  const d = parseDraft(TISTORY_DRAFT);

  it("제목 후보와 추천 표시, 제목 전체를 감싼 따옴표만 벗긴다", () => {
    assert.deepEqual(d.titles, [
      { text: "국민연금 수령나이, 출생연도별로 한눈에 정리", recommended: true },
      { text: "국민연금 몇 살부터 받을까?", recommended: false },
      { text: '"나는 언제 받지?" 국민연금 수령나이 확인법', recommended: false },
      { text: "따옴표로 감싼 제목", recommended: false },
    ]);
  });

  it("메타 설명·태그·본문(언어)·스레드 글", () => {
    assert.equal(d.meta, "국민연금 수령나이는 출생연도에 따라 다릅니다.");
    assert.deepEqual(d.tags, ["국민연금", "국민연금 수령나이", "노령연금"]);
    assert.equal(d.bodyLang, "html");
    assert.match(d.body ?? "", /^<h2>/);
    assert.match(d.body ?? "", /## 코드 블록 안의/, "코드 블록 안의 ##으로 섹션이 끊기지 않는다");
    assert.deepEqual(d.threads, ["첫 번째 글", "두 번째 글"]);
  });

  it("사람이 채울 자리 3종", () => {
    assert.deepEqual(
      d.markers.map((m) => [m.type, m.text]),
      [
        ["image", "조회 화면 | alt: 조회 | 추천: 직접 캡처"],
        ["write", "상담 경험"],
        ["check", "2026년 감액률"],
      ],
    );
  });

  it("분류하지 못한 섹션은 others로, 접힌 브리프는 무시", () => {
    assert.deepEqual(
      d.others.map((o) => o.heading),
      ["5. 이미지 목록"],
    );
  });

  it("#태그 공백 구분, 형식 없는 초안", () => {
    assert.deepEqual(parseDraft("## 태그\n#기초연금 #기초연금신청 #노인복지").tags, ["기초연금", "기초연금신청", "노인복지"]);
    const raw = parseDraft("그냥 메모\n[이미지: 아무거나]");
    assert.equal(raw.body, null);
    assert.equal(raw.markers.length, 1, "본문이 없으면 전체에서 자리를 찾는다");
  });
});

describe("draftOpening", () => {
  it("HTML: 소제목은 빼고, 인라인 태그 때문에 빈칸이 생기지 않는다", () => {
    assert.equal(draftOpening("<h2>제목</h2><p>국민연금은 <strong>출생연도</strong>에 따라 다릅니다. 둘째</p>"), "국민연금은 출생연도에 따라 다릅니다.");
  });
  it("네이버 텍스트: ■ 소제목과 ★ 기호를 뺀다", () => {
    assert.equal(draftOpening("■ 소제목\n\n★ 기초연금은 만 65세부터 신청해요.\n"), "기초연금은 만 65세부터 신청해요.");
  });
  it("길면 자르고, 없으면 null", () => {
    assert.equal(draftOpening("가".repeat(100), 10), `${"가".repeat(10)}…`);
    assert.equal(draftOpening(null), null);
  });
});

describe("초안 파일", () => {
  let dir: string;
  before(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "toolhub-drafts-"));
    await writeFile(path.join(dir, "2026-10-30-국민연금-수령나이-tistory.md"), "원본\n");
    await writeFile(path.join(dir, "2026-10-29-기초연금-naver-2.md"), "x\n");
    await writeFile(path.join(dir, "메모.md"), "x\n");
  });
  after(() => rm(dir, { recursive: true, force: true }));

  it("목록: 파일 이름에서 날짜·키워드·플랫폼을 읽는다", async () => {
    const drafts = await listDrafts(dir);
    const byFile = Object.fromEntries(drafts.map((d) => [d.file, d]));
    assert.deepEqual(
      [byFile["2026-10-30-국민연금-수령나이-tistory.md"]?.keyword, byFile["2026-10-30-국민연금-수령나이-tistory.md"]?.platform],
      ["국민연금 수령나이", "tistory"],
    );
    assert.equal(byFile["2026-10-29-기초연금-naver-2.md"]?.platform, "naver");
    assert.deepEqual([byFile["메모.md"]?.date, byFile["메모.md"]?.platform], [null, null]);
    assert.equal(draftsForKeyword(drafts, "국민연금수령나이").length, 1);
  });

  it("폴더 밖 파일은 읽지 않는다", async () => {
    assert.equal(await readDraftFile(dir, "../etc/passwd"), null);
    assert.equal(await readDraftFile(dir, "없는파일.md"), null);
  });

  it("고치면 이전 버전을 .history에 남기고, 없는 파일은 만들지 않는다", async () => {
    const file = "2026-10-30-국민연금-수령나이-tistory.md";
    const result = await updateDraftFile(dir, file, "고친 내용");
    assert.ok(result);
    assert.equal(await readFile(path.join(dir, file), "utf-8"), "고친 내용\n");
    assert.equal(await readFile(result.backup, "utf-8"), "원본\n");
    assert.equal(await updateDraftFile(dir, "없는파일.md", "x"), null);
    assert.equal(await updateDraftFile(dir, "../밖.md", "x"), null);
    assert.equal((await readdir(path.join(dir, ".history"))).length, 1);
  });
});
