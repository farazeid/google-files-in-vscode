import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { FILE_TYPES, CONTEXT_WHEN } from "../../src/file-types";
test("manifest associations and context menus match the supported file registry", () => {
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.deepEqual(
    manifest.contributes.customEditors[0].selector,
    FILE_TYPES.map((type) => ({ filenamePattern: `*${type.extension}` })),
  );
  for (const menu of manifest.contributes.menus["explorer/context"])
    assert.equal(menu.when, CONTEXT_WHEN);
});
