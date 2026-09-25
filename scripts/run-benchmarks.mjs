import { runTests } from "@vscode/test-electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { testEnvironment } from "./test-environment.mjs";
const root = resolve(".");
const output = resolve("evidence/benchmarks");
await mkdir(output, { recursive: true });
const baseline = process.env.GOOGLE_FILES_BASELINE;
const runs = [];
for (const variant of baseline ? ["current", "baseline"] : ["current"]) {
  for (let i = 0; i < 11; i++) {
    const { executable, launchArgs } = testEnvironment("gfb-");
    const path = join(output, `${variant}-${i}.json`);
    if (
      process.argv.includes("--resume") &&
      !(variant === "current" && process.argv.includes("--rerun-current"))
    ) {
      try {
        runs.push(JSON.parse(await readFile(path, "utf8")));
        continue;
      } catch {
        /* Missing result must be measured. */
      }
    }
    await runTests({
      vscodeExecutablePath: executable,
      extensionDevelopmentPath: join(
        root,
        variant === "baseline" ? "harness" : ".test-extension",
      ),
      extensionTestsPath: join(root, ".test-out/benchmark.cjs"),
      extensionTestsEnv: {
        GOOGLE_FILES_BENCH_OUTPUT: path,
        GOOGLE_FILES_BENCH_COLD: i < 10 ? "1" : "0",
        ...(variant === "baseline"
          ? { GOOGLE_FILES_BENCH_BASELINE: baseline }
          : {}),
      },
      launchArgs,
    });
    runs.push(JSON.parse(await readFile(path, "utf8")));
    console.log(`BENCHMARK ${variant} ${i + 1}/11 complete`);
  }
}
const summary = [];
for (const baseline of [false, true])
  for (const scenario of [
    "first-open-fresh-process",
    "new-document-browser-warm",
    "reopen-after-close",
  ]) {
    const samples = runs
      .filter((run) => run.baseline === baseline)
      .flatMap((run) => run.samples)
      .filter((sample) => sample.scenario === scenario);
    if (!samples.length) continue;
    const stats = (key) => {
      const ordered = samples
        .map((sample) => sample[key])
        .sort((a, b) => a - b);
      return {
        median:
          (ordered[Math.floor((ordered.length - 1) / 2)] +
            ordered[Math.ceil((ordered.length - 1) / 2)]) /
          2,
        p95: ordered[Math.ceil(ordered.length * 0.95) - 1],
      };
    };
    summary.push({
      variant: baseline ? "baseline" : "current",
      scenario,
      count: samples.length,
      pageReadyMs: stats("pageReadyMs"),
      routerGoneMs: stats("routerGoneMs"),
    });
  }
await writeFile(
  join(output, "summary.json"),
  JSON.stringify(
    {
      summary,
      failures: runs.flatMap((run) =>
        (run.failures ?? []).map((failure) => ({
          variant: run.baseline ? "baseline" : "current",
          ...failure,
        })),
      ),
      existingTabSwitching: "Not applicable: reuse explicitly deferred.",
      googleReady:
        "Not measured; local fixture readiness is not Google readiness.",
      machine: runs[0] && {
        cpu: runs[0].cpu,
        osRelease: runs[0].osRelease,
        arch: runs[0].arch,
        vscode: runs[0].version,
      },
    },
    null,
    2,
  ),
);
console.log(JSON.stringify(summary, null, 2));
