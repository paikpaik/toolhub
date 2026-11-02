import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { deleteChunkDoc, readChunkDocs, saveChunkDoc } from "./chunks-store.ts";
import { isChunkDocId } from "./chunks.ts";

let dir: string;
before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "toolhub-chunks-"));
});
after(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("덩어리 기록 저장소", () => {
  it("문서 id는 날짜, w-월요일 날짜, cfg만", () => {
    for (const id of ["2026-11-02", "w-2026-11-02", "cfg"]) assert.ok(isChunkDocId(id), id);
    for (const id of ["", "../tasks", "2026-11-2", "w-cfg", "cfg2", "tasks"]) assert.ok(!isChunkDocId(id), id);
  });

  it("파일이 없으면 빈 기록", async () => {
    assert.deepEqual(await readChunkDocs(dir), {});
  });

  it("문서 id → 데이터 모양 그대로 저장하고, 같은 id는 덮어쓰고, 지우면 빠진다", async () => {
    await saveChunkDoc(dir, "2026-11-02", { b1: true, b2: false, n1: "릴스 촬영", n2: "", g1: "g1", g2: "", l1: "", l2: "" });
    await saveChunkDoc(dir, "w-2026-11-02", { goals: [{ id: "a", t: "원데이 클래스 준비", g: "g1", d: 0, done: false }] });
    await saveChunkDoc(dir, "2026-11-02", { b1: true, b2: true, n1: "릴스 촬영", n2: "편집", g1: "g1", g2: "g3", l1: "", l2: "" });

    const saved = JSON.parse(await readFile(path.join(dir, "chunks.json"), "utf-8"));
    assert.deepEqual(Object.keys(saved).sort(), ["2026-11-02", "w-2026-11-02"]);
    assert.equal(saved["2026-11-02"].n2, "편집");

    await deleteChunkDoc(dir, "w-2026-11-02");
    assert.deepEqual(Object.keys(await readChunkDocs(dir)), ["2026-11-02"]);
  });

  it("잘못된 id나 객체가 아닌 내용은 거부", async () => {
    await assert.rejects(saveChunkDoc(dir, "../tasks", {}), /id/);
    await assert.rejects(saveChunkDoc(dir, "cfg", [1, 2]), /객체/);
    await assert.rejects(saveChunkDoc(dir, "cfg", "x".repeat(10)), /객체/);
    await assert.rejects(deleteChunkDoc(dir, "tasks"), /id/);
  });

  it("동시에 저장해도 빠지지 않는다", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => saveChunkDoc(dir, `2026-10-${String(i + 1).padStart(2, "0")}`, { b1: true })));
    const docs = await readChunkDocs(dir);
    assert.equal(Object.keys(docs).filter((id) => id.startsWith("2026-10-")).length, 20);
  });
});
