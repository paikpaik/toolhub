import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { buildDraftBundle, importDrafts, parseDraftBundle, safeDraftFileName } from "./draft-bundle.ts";
import { readDraftStatuses, setDraftStatus } from "./draft-status-store.ts";

describe("초안 내보내기·가져오기", () => {
  let root: string;
  let from: { drafts: string; data: string };
  let to: { drafts: string; data: string };

  before(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "draft-bundle-"));
    from = { drafts: path.join(root, "a/drafts"), data: path.join(root, "a/data") };
    to = { drafts: path.join(root, "b/drafts"), data: path.join(root, "b/data") };
    await importDrafts(from.drafts, from.data, [
      { file: "2026-11-05-가습기-naver.md", content: "가습기 초안" },
      { file: "2026-11-05-절임배추-naver.md", content: "절임배추 초안\n" },
    ]);
    await setDraftStatus(from.data, "2026-11-05-가습기-naver.md", { status: "published", url: "https://blog.naver.com/x/1" });
  });
  after(() => rm(root, { recursive: true, force: true }));

  it("고른 초안과 상태를 묶고, 없는 파일은 뺀다", async () => {
    const bundle = await buildDraftBundle(from.drafts, from.data, ["2026-11-05-가습기-naver.md", "없는.md", "2026-11-05-가습기-naver.md"]);
    assert.equal(bundle.format, "toolhub-drafts");
    assert.deepEqual(bundle.drafts.map((d) => d.file), ["2026-11-05-가습기-naver.md"]);
    assert.equal(bundle.drafts[0]!.content, "가습기 초안\n");
    assert.equal(bundle.drafts[0]!.status?.url, "https://blog.naver.com/x/1");
  });

  it("다른 곳에 가져오면 초안과 상태가 생기고, 다시 가져오면 덮어쓰지 않는다", async () => {
    const bundle = await buildDraftBundle(from.drafts, from.data, ["2026-11-05-가습기-naver.md", "2026-11-05-절임배추-naver.md"]);
    const first = await importDrafts(to.drafts, to.data, parseDraftBundle(JSON.parse(JSON.stringify(bundle))));
    assert.deepEqual(first.map((r) => r.result), ["added", "added"]);
    assert.equal((await readDraftStatuses(to.data))["2026-11-05-가습기-naver.md"]?.status, "published");

    // 같은 내용이면 건너뛰고, 내용이 다르면 번호를 붙여 따로 저장 (기존 파일·상태는 그대로)
    const changed = { ...bundle.drafts[1]!, content: "고친 절임배추" };
    const again = await importDrafts(to.drafts, to.data, [bundle.drafts[0]!, changed]);
    assert.deepEqual(again, [
      { file: "2026-11-05-가습기-naver.md", result: "skipped", reason: "같은 초안이 이미 있어요" },
      { file: "2026-11-05-절임배추-naver.md", result: "renamed", savedAs: "2026-11-05-절임배추-naver-2.md" },
    ]);
    assert.equal(await readFile(path.join(to.drafts, "2026-11-05-절임배추-naver.md"), "utf-8"), "절임배추 초안\n");
  });

  it("이미 상태 기록이 있으면 가져온 상태로 덮어쓰지 않는다", async () => {
    await writeFile(path.join(to.drafts, "2026-11-06-독감-naver.md"), "독감\n");
    await setDraftStatus(to.data, "2026-11-06-독감-naver.md", { status: "draft" });
    await importDrafts(to.drafts, to.data, [{ file: "2026-11-06-독감-naver.md", content: "다른 독감", status: { status: "published" } }]);
    assert.equal((await readDraftStatuses(to.data))["2026-11-06-독감-naver.md"]?.status, "draft");
  });

  it("파일 이름은 폴더·금지 문자를 걷어내고 .md로, 모양이 다른 파일은 거절", () => {
    assert.equal(safeDraftFileName("../../etc/passwd"), "passwd.md");
    assert.equal(safeDraftFileName("C:\\x\\메모.txt"), "메모.md");
    assert.equal(safeDraftFileName(".md"), null);
    assert.equal(safeDraftFileName("..hidden.md"), "hidden.md");
    assert.throws(() => parseDraftBundle({ hello: 1 }), /내보내기 파일이 아니에요/);
    assert.deepEqual(
      parseDraftBundle({ drafts: [{ file: "a.md", content: "x", status: { status: "이상함" } }, { file: "b.md", content: " " }, null] }),
      [{ file: "a.md", content: "x" }],
    );
  });
});
