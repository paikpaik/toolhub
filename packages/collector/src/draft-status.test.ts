import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { adjacentDrafts, applyStatusPatch, draftEditBlocked, effectiveStatus, normalizePostUrl, sortDrafts, toggleKinAnswer } from "./draft-status.ts";
import { readDraftStatuses, setDraftStatus, setKinAnswered } from "./draft-status-store.ts";

describe("초안 상태", () => {
  it("기록이 없으면 초안, 예전에 저장한 예약됨은 발행됨으로 본다", () => {
    assert.equal(effectiveStatus(undefined), "draft");
    assert.equal(effectiveStatus({ status: "published" }), "published");
    assert.equal(effectiveStatus({ status: "scheduled" as never }), "published");
  });

  it("발행됨 초안은 고칠 수 없다 (정책), 초안은 고칠 수 있다", () => {
    assert.equal(draftEditBlocked("a.md", undefined), null);
    assert.equal(draftEditBlocked("a.md", { status: "draft" }), null);
    assert.match(draftEditBlocked("a.md", { status: "published" }) ?? "", /발행됨 초안은 고치지 않습니다/);
  });

  it("목록은 발행됨 → 초안, 같은 상태끼리는 최근 수정 순", () => {
    const rows = [
      { file: "a.md", updatedAt: "2026-11-05T00:00:00Z" },
      { file: "b.md", updatedAt: "2026-11-03T00:00:00Z" },
      { file: "c.md", updatedAt: "2026-11-04T00:00:00Z" },
      { file: "d.md", updatedAt: "2026-11-01T00:00:00Z" },
    ];
    const statuses = { "b.md": { status: "published" as const }, "d.md": { status: "scheduled" as never } };
    assert.deepEqual(sortDrafts(rows, statuses).map((r) => r.file), ["b.md", "d.md", "a.md", "c.md"]);
  });

  it("글 주소는 http(s)만, 앞뒤 공백·꺾쇠는 걷는다", () => {
    assert.equal(normalizePostUrl(" <https://blog.naver.com/abc/123> "), "https://blog.naver.com/abc/123");
    assert.equal(normalizePostUrl("blog.naver.com/abc"), null);
    assert.equal(normalizePostUrl("javascript:alert(1)"), null);
    assert.equal(normalizePostUrl(""), null);
  });

  it("상태·주소·시각을 고치고, 빈 값은 지우고, 잘못된 값은 오류 메시지", () => {
    const entry = applyStatusPatch(undefined, { status: "published", url: "https://blog.naver.com/a/1", at: "2026-11-04T22:10:00+09:00" });
    assert.deepEqual(entry, { status: "published", url: "https://blog.naver.com/a/1", at: "2026-11-04T13:10:00.000Z" });
    assert.deepEqual(applyStatusPatch(entry as never, { url: "", at: null }), { status: "published" });
    assert.equal(typeof applyStatusPatch(undefined, { url: "naver" }), "string");
    assert.equal(typeof applyStatusPatch(undefined, { status: "done" as never }), "string");
    assert.equal(typeof applyStatusPatch(undefined, { status: "scheduled" as never }), "string");
    assert.equal(typeof applyStatusPatch(undefined, { at: "내일" }), "string");
  });

  it("지식iN 답변 기록은 같은 질문을 하나만, 끄면 지운다", () => {
    const q = { link: "https://kin.naver.com/qna/detail.naver?d1id=1&docId=2", title: "도시락통 추천" };
    const once = toggleKinAnswer(undefined, q, true, new Date("2026-11-04T00:00:00Z"));
    const twice = toggleKinAnswer(once, q, true);
    assert.equal(twice.answers?.length, 1);
    assert.equal(toggleKinAnswer(twice, q, false).answers, undefined);
  });
});

describe("이전·다음 초안", () => {
  const files = ["a.md", "b.md", "c.md", "d.md", "e.md"];
  const statuses = {
    "b.md": { status: "published" as const },
    "d.md": { status: "published" as const },
    "e.md": { status: "scheduled" as never }, // 예전에 저장한 예약됨 → 발행됨
  };

  it("발행됨을 건너뛰고 가장 가까운 초안으로", () => {
    assert.deepEqual(adjacentDrafts(files, "c.md", statuses), { prev: "a.md", next: null });
    assert.deepEqual(adjacentDrafts(files, "a.md", statuses), { prev: null, next: "c.md" });
  });

  it("지금 글이 발행됐어도 목록 속 자리를 기준으로, 목록에 없으면 없음", () => {
    assert.deepEqual(adjacentDrafts(files, "b.md", statuses), { prev: "a.md", next: "c.md" });
    assert.deepEqual(adjacentDrafts(files, "z.md", statuses), { prev: null, next: null });
  });
});

describe("상태 파일", () => {
  it("파일 이름별로 저장하고, 동시에 고쳐도 빠지지 않는다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "draft-status-"));
    try {
      assert.deepEqual(await readDraftStatuses(dir), {});
      await Promise.all([
        setDraftStatus(dir, "a-naver.md", { status: "published", url: "https://blog.naver.com/x/1" }),
        setDraftStatus(dir, "b-naver.md", { status: "draft" }),
        setKinAnswered(dir, "a-naver.md", { link: "https://kin.naver.com/q/1", title: "질문" }, true),
      ]);
      const saved = await readDraftStatuses(dir);
      assert.equal(saved["a-naver.md"]?.status, "published");
      assert.equal(saved["a-naver.md"]?.answers?.length, 1);
      assert.equal(saved["b-naver.md"]?.status, "draft");
      assert.match(await readFile(path.join(dir, "draft-status.json"), "utf-8"), /"drafts"/);
      await assert.rejects(setDraftStatus(dir, "../evil.md", { status: "draft" }));
      await assert.rejects(setDraftStatus(dir, "a-naver.md", { url: "naver" }), /https/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
