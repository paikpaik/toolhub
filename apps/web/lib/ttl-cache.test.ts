import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createTtlCache } from "./ttl-cache.ts";

describe("createTtlCache", () => {
  it("정한 시간 안에는 기억한 값을, 지나면 없음을 돌려준다", () => {
    let now = 0;
    const cache = createTtlCache<string[]>(10 * 60_000, () => now);
    assert.equal(cache.get("수능도시락|date"), undefined);
    cache.set("수능도시락|date", ["질문"]);
    now = 10 * 60_000 - 1;
    assert.deepEqual(cache.get("수능도시락|date"), ["질문"]);
    assert.equal(cache.get("수능도시락|sim"), undefined);
    now = 10 * 60_000;
    assert.equal(cache.get("수능도시락|date"), undefined);
  });

  it("다시 넣으면 시간이 새로 시작된다", () => {
    let now = 0;
    const cache = createTtlCache<number>(100, () => now);
    cache.set("k", 1);
    now = 90;
    cache.set("k", 2);
    now = 150;
    assert.equal(cache.get("k"), 2);
  });

  it("지우면 바로 없음", () => {
    const cache = createTtlCache<number>(100, () => 0);
    cache.set("k", 1);
    cache.delete("k");
    assert.equal(cache.get("k"), undefined);
  });
});
