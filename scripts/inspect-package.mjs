import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { root, packagePath, manifest } from "./test-environment.mjs";
import { join } from "node:path";
// macOS release tooling uses the OS ZIP reader; no extra runtime dependency.
const files = execFileSync("unzip", ["-Z1", packagePath], { encoding: "utf8" })
  .trim()
  .split("\n")
  .sort();
assert.deepEqual(
  files,
  [
    "extension.vsixmanifest",
    "[Content_Types].xml",
    "extension/package.json",
    "extension/readme.md",
    "extension/LICENSE.txt",
    "extension/changelog.md",
    "extension/dist/extension.js",
    "extension/assets/icon.png",
  ].sort(),
);
const read = (name) =>
  execFileSync("unzip", ["-p", packagePath, name], { encoding: "utf8" });
const packaged = JSON.parse(read("extension/package.json"));
assert.equal(packaged.version, manifest.version);
assert.deepEqual(packaged.contributes, manifest.contributes);
const code = read("extension/dist/extension.js");
assert.equal(code, await readFile(join(root, "dist/extension.js"), "utf8"));
for (const hook of [
  "simulateFailure",
  "setFixtureOrigin",
  "openFixture",
  "getHtml",
  "reuseUrlFilter",
  "tabGroups.close",
  "127.0.0.1",
])
  assert.ok(!code.includes(hook), `Unexpected production hook: ${hook}`);
const bytes = await readFile(packagePath);
await mkdir(join(root, "evidence"), { recursive: true });
await writeFile(
  join(root, "evidence/package-inspection.json"),
  JSON.stringify(
    {
      version: manifest.version,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      bytes: bytes.length,
      files,
      productionHooksAbsent: true,
      browserTabCleanupAbsent: true,
      publicCommands: packaged.contributes.commands.length,
      supportedShortcutTypes:
        packaged.contributes.customEditors[0].selector.length,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Package verified: ${packagePath}`);
