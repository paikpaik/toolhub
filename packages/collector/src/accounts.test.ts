import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  accountName,
  accountOverlapFeedback,
  accountsPlanningNote,
  accountTopicStats,
  BLOG_TOPICS,
  findAccount,
  formatAccounts,
  newAccountId,
  sanitizeAccounts,
  textSimilarity,
} from "./accounts.ts";
import { addBackground, readAccounts, removeBackground, writeAccounts } from "./accounts-store.ts";
import { DEFAULT_THUMBNAIL_STYLE } from "./thumbnail-style.ts";

const A = { id: "acc-a", name: "여행계정", topics: ["국내여행", "맛집"], thumbnail: DEFAULT_THUMBNAIL_STYLE };
const B = { id: "acc-b", name: "돈계정", topics: ["비즈니스·경제"], thumbnail: DEFAULT_THUMBNAIL_STYLE };

describe("계정", () => {
  it("분야는 네이버 블로그 주제 32개", () => {
    assert.equal(BLOG_TOPICS.length, 32);
    assert.equal(new Set(BLOG_TOPICS).size, 32);
  });

  it("저장할 목록 확인: 이름 다듬기, 모르는 분야·겹치는 분야 빼기, 잘못된 값은 오류", () => {
    assert.deepEqual(sanitizeAccounts([{ id: "acc-a", name: " 여행계정 ", topics: ["국내여행", "국내여행", "없는분야"], extra: 1 }]), [
      { id: "acc-a", name: "여행계정", topics: ["국내여행"], thumbnail: DEFAULT_THUMBNAIL_STYLE },
    ]);
    assert.match(sanitizeAccounts("x") as string, /목록이 아닙니다/);
    assert.match(sanitizeAccounts([{ id: "acc-a", name: "" }]) as string, /이름을 넣어/);
    assert.match(sanitizeAccounts([{ id: "../a", name: "a" }]) as string, /id가 잘못/);
    assert.match(sanitizeAccounts([A, { ...B, name: "여행계정" }]) as string, /같은 이름/);
    assert.match(sanitizeAccounts([A, { ...B, id: "acc-a" }]) as string, /id가 겹쳐요/);
    assert.match(newAccountId(), /^acc-[0-9a-f]{8}$/);
  });

  it("id나 이름(대소문자 무시)으로 찾고, 지운 계정 이름은 null", () => {
    const accounts = sanitizeAccounts([A, { ...B, name: "Money" }]) as never;
    assert.deepEqual((sanitizeAccounts([{ id: "acc-a", name: "a" }]) as never as { thumbnail: unknown }[])[0]!.thumbnail, DEFAULT_THUMBNAIL_STYLE);
    assert.equal(findAccount(accounts, "acc-b")?.name, "Money");
    assert.equal(findAccount(accounts, " money ")?.id, "acc-b");
    assert.equal(findAccount(accounts, "없음"), null);
    assert.equal(accountName(accounts, "acc-a"), "여행계정");
    assert.equal(accountName(accounts, "acc-x"), null);
    assert.equal(accountName(accounts, undefined), null);
  });

  it("분야별 초안·발행 수 (많은 순, 분야가 없으면 '분야 없음')", () => {
    const stats = accountTopicStats("acc-a", [
      { account: "acc-a", topic: "맛집", status: "published" },
      { account: "acc-a", topic: "맛집", status: "draft" },
      { account: "acc-a", topic: "국내여행", status: "draft" },
      { account: "acc-a", status: "draft" },
      { account: "acc-b", topic: "맛집", status: "published" },
    ]);
    assert.deepEqual(stats[0], { topic: "맛집", drafts: 1, published: 1 });
    assert.equal(stats.length, 3);
    assert.ok(stats.some((s) => s.topic === "분야 없음"));
  });

  it("계정 목록: 초안이 없는 계정도 빠지지 않고, 계정마다 초안·발행 수", () => {
    assert.match(formatAccounts([], []), /등록된 계정이 없습니다/);
    const text = formatAccounts([A as never, { ...B, topics: [] }], [
      { account: "acc-a", status: "draft" },
      { account: "acc-a", status: "published" },
      { status: "draft" },
    ]);
    assert.match(text, /^등록된 네이버 블로그 계정 2개/);
    assert.match(text, /- 여행계정: 분야 국내여행, 맛집 · 초안 1개 · 발행 1개/);
    assert.match(text, /- 돈계정: 분야 미정 \(어느 분야든\) · 초안 0개 · 발행 0개/);
  });

  it("글감 규칙: 계정이 없으면 null(지금처럼), 있으면 계정·분야와 나누는 규칙", () => {
    assert.equal(accountsPlanningNote([]), null);
    const note = accountsPlanningNote([A as never, { ...B, topics: [] }])!;
    assert.match(note, /- 여행계정: 국내여행, 맛집/);
    assert.match(note, /- 돈계정: 분야 미정/);
    assert.match(note, /discover_keywords/);
    assert.match(note, /save_draft에 account/);
  });

  it("데이터 파일 읽고 쓰기, 잘못된 목록은 쓰지 않는다", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "toolhub-accounts-"));
    try {
      assert.deepEqual(await readAccounts(dir), []);
      await writeAccounts(dir, [A]);
      assert.deepEqual(await readAccounts(dir), [A]);
      await assert.rejects(writeAccounts(dir, [{ id: "acc-a", name: "" }]), /이름/);
      assert.deepEqual(await readAccounts(dir), [A]);

      // 배경 이미지: 올리면 목록 끝에 더해지고, 계정 목록을 통째로 저장해도 배경 목록은 유지, 지우면 파일도 지운다
      const [withBg] = await addBackground(dir, "acc-a", "image/png", new Uint8Array([1, 2, 3]));
      const name = withBg!.thumbnail.backgrounds[0]!;
      assert.match(name, /^bg-[0-9a-f]{10}\.png$/);
      await readFile(path.join(dir, "thumbnails", "acc-a", name));
      await writeAccounts(dir, [{ ...A, thumbnail: { ...A.thumbnail, backgrounds: [] } }]);
      assert.deepEqual((await readAccounts(dir))[0]!.thumbnail.backgrounds, [name]);
      await assert.rejects(addBackground(dir, "acc-a", "image/gif", new Uint8Array([1])), /PNG·JPG·WebP/);
      await removeBackground(dir, "acc-a", name);
      assert.deepEqual((await readAccounts(dir))[0]!.thumbnail.backgrounds, []);
      await assert.rejects(readFile(path.join(dir, "thumbnails", "acc-a", name)));

      // 계정을 지우면 그 계정 배경 폴더도 지운다
      await addBackground(dir, "acc-a", "image/png", new Uint8Array([1]));
      await writeAccounts(dir, []);
      await assert.rejects(readFile(path.join(dir, "thumbnails", "acc-a")));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("계정 겹침 점검", () => {
  it("글자 묶음 유사도", () => {
    assert.equal(textSimilarity("같은 제목", "같은제목"), 1);
    assert.equal(textSimilarity("", "a"), 0);
    assert.ok(textSimilarity("시흥 어린이과학관 주차", "제주 감귤 따기 체험") < 0.1);
  });

  it("다른 계정 초안이 없으면 null", () => {
    assert.equal(accountOverlapFeedback({ format: "search", title: "a", opening: "b" }, []), null);
  });

  it("형식이 같거나 제목·도입이 비슷하면 고치라고 한다", () => {
    const text = accountOverlapFeedback({ format: "search", title: "시흥 어린이과학관 주차 몇 시 전에 가야 하나", opening: "시흥 어린이과학관이 이번 주 문을 열었어요." }, [
      {
        file: "b.md",
        account: "돈계정",
        format: null,
        title: "시흥 어린이과학관 주차, 몇 시 전에 가야 하나",
        opening: "시흥 어린이과학관이 이번 주에 문을 열었어요.",
      },
    ])!;
    assert.match(text, /다른 계정에 같은 키워드 초안이 1개/);
    assert.match(text, /형식이 같은 검색형/);
    assert.match(text, /제목이 비슷합니다/);
    assert.match(text, /도입 문장이 비슷합니다/);
    assert.match(text, /update_draft/);
  });

  it("형식·제목·도입이 다르면 괜찮다고 한다", () => {
    const text = accountOverlapFeedback({ format: "home", title: "주말에 아이랑 과학관, 가 볼 만할까", opening: "토요일 오전에 다녀왔어요." }, [
      { file: "b.md", account: "돈계정", format: "search", title: "시흥 어린이과학관 요금과 운영시간", opening: "입장료는 성인 3천 원이에요." },
    ])!;
    assert.match(text, /괜찮습니다/);
    assert.doesNotMatch(text, /update_draft/);
  });
});
