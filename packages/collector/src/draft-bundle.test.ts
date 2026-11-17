import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { addBackground, readAccounts, writeAccounts } from "./accounts-store.ts";
import { buildDraftBundle, importDrafts, linkBundleAccounts, parseBundleAccounts, parseDraftBundle, safeDraftFileName } from "./draft-bundle.ts";
import { DEFAULT_THUMBNAIL_STYLE } from "./thumbnail-style.ts";
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

describe("초안 내보내기·가져오기: 계정 잇기", () => {
  const style = (backgrounds: string[] = []) => ({ ...DEFAULT_THUMBNAIL_STYLE, backgrounds });
  let root: string;
  before(async () => (root = await mkdtemp(path.join(os.tmpdir(), "draft-bundle-accounts-"))));
  after(() => rm(root, { recursive: true, force: true }));

  it("id가 다른 PC에서는 이름이 같은 계정으로 잇고, 없는 계정은 새로 만들고, 이 PC 계정 설정은 그대로 둔다", async () => {
    const from = { drafts: path.join(root, "a/drafts"), data: path.join(root, "a/data") };
    const to = { drafts: path.join(root, "b/drafts"), data: path.join(root, "b/data") };
    // 내보내는 PC: 여리쓰·우드·새계정 (배경 이미지 있음)
    await writeAccounts(from.data, [
      { id: "acc-aaaa", name: "여리쓰", topics: ["영화"], thumbnail: style() },
      { id: "acc-bbbb", name: "우드", topics: ["맛집"], thumbnail: style() },
      { id: "acc-cccc", name: "새계정", topics: ["게임"], thumbnail: style() },
      { id: "acc-dddd", name: "안쓴계정", topics: [], thumbnail: style() },
    ]);
    await addBackground(from.data, "acc-cccc", "image/png", new Uint8Array([1]));
    const files = ["2026-11-17-a-naver.md", "2026-11-17-b-naver.md", "2026-11-17-c-naver.md", "2026-11-17-d-naver.md"];
    await importDrafts(from.drafts, from.data, files.map((file) => ({ file, content: file })));
    await setDraftStatus(from.data, files[0]!, { account: "acc-aaaa", topic: "영화" });
    await setDraftStatus(from.data, files[1]!, { account: "acc-bbbb" });
    await setDraftStatus(from.data, files[2]!, { account: "acc-cccc" });

    const bundle = JSON.parse(JSON.stringify(await buildDraftBundle(from.drafts, from.data, files)));
    // 초안이 쓰는 계정만, 배경 이미지는 빼고
    assert.deepEqual(bundle.accounts.map((a: { name: string }) => a.name), ["여리쓰", "우드", "새계정"]);
    assert.deepEqual(bundle.accounts[2].thumbnail.backgrounds, []);

    // 가져오는 PC: 여리쓰·우드가 다른 id로 이미 있음 (우드는 앞뒤 공백만 다름)
    await writeAccounts(to.data, [
      { id: "acc-xxxx", name: "여리쓰", topics: ["드라마"], thumbnail: style() },
      { id: "acc-yyyy", name: " 우드 ", topics: [], thumbnail: style() },
    ]);
    const { drafts, links } = await linkBundleAccounts(to.data, parseBundleAccounts(bundle), parseDraftBundle(bundle));
    await importDrafts(to.drafts, to.data, drafts);
    assert.deepEqual(links, [
      { name: "여리쓰", result: "linked" },
      { name: "우드", result: "linked" },
      { name: "새계정", result: "created" },
    ]);
    const statuses = await readDraftStatuses(to.data);
    assert.equal(statuses[files[0]!]?.account, "acc-xxxx");
    assert.equal(statuses[files[0]!]?.topic, "영화");
    assert.equal(statuses[files[1]!]?.account, "acc-yyyy");
    assert.equal(statuses[files[2]!]?.account, "acc-cccc");
    assert.equal(statuses[files[3]!], undefined);
    const accounts = await readAccounts(to.data);
    assert.deepEqual(accounts.map((a) => [a.id, a.name]), [["acc-xxxx", "여리쓰"], ["acc-yyyy", "우드"], ["acc-cccc", "새계정"]]);
    // 이 PC 계정 설정은 덮어쓰지 않는다
    assert.deepEqual(accounts[0]!.topics, ["드라마"]);
    assert.deepEqual(accounts[2]!.topics, ["게임"]);

    // 같은 PC로 다시 가져오면 같은 id라 그대로
    const again = await linkBundleAccounts(from.data, parseBundleAccounts(bundle), parseDraftBundle(bundle));
    assert.deepEqual(again.links.map((l) => l.result), ["same", "same", "same"]);
    // 예전 내보내기 파일(계정 없음)은 초안 기록을 그대로 둔다
    const old = await linkBundleAccounts(to.data, [], parseDraftBundle(bundle));
    assert.equal(old.drafts[0]!.status?.account, "acc-aaaa");
  });
});
