import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const versionOf = async (file: string) => JSON.parse(await readFile(path.join(ROOT, file), "utf-8")).version as string;

describe("버전", () => {
  it("모든 패키지와 크롬 확장이 저장소 루트 package.json과 같은 버전", async () => {
    const root = await versionOf("package.json");
    assert.match(root, /^\d+\.\d+\.\d+$/);
    for (const file of ["packages/collector/package.json", "packages/tasks/package.json", "packages/insta/package.json", "packages/mcp/package.json", "apps/web/package.json", "extension/manifest.json"]) {
      assert.equal(await versionOf(file), root, `${file}의 버전이 루트(${root})와 다릅니다`);
    }
  });
});
