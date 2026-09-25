import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
const testing = process.argv.includes("--test");
await build({
  entryPoints: ["src/extension.ts"],
  outfile: testing ? ".test-extension/dist/extension.js" : "dist/extension.js",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  external: ["vscode"],
  sourcemap: false,
  minify: !testing,
  define: { __TEST__: String(testing) },
});
if (testing) {
  await build({
    entryPoints: ["harness/src/extension.ts"],
    outfile: "harness/out/extension.js",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node22",
  });
  const { default: manifest } = await import("../package.json", {
    with: { type: "json" },
  });
  await mkdir(".test-extension", { recursive: true });
  manifest.contributes.commands.push({
    command: "googleFiles.dev.simulateFailure",
    title: "Simulate Failure (Development)",
    category: "Google Files",
  });
  await writeFile(".test-extension/package.json", JSON.stringify(manifest));
  await build({
    entryPoints: ["test/integration/benchmark.ts"],
    outfile: ".test-out/benchmark.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
    target: "node22",
  });
  await build({
    entryPoints: ["test/integration/cli.test.ts"],
    outfile: ".test-out/cli.test.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
    target: "node22",
  });
  await build({
    entryPoints: ["test/integration/suite.ts"],
    outfile: ".test-out/suite.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["vscode"],
    target: "node22",
  });
}
