import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { root, testEnvironment } from "./test-environment.mjs";
const { executable, launchArgs } = testEnvironment("gf-");
const evidence = join(root, "evidence");
await mkdir(evidence, { recursive: true });
const runId = randomUUID();
const env = {
  ...process.env,
  GOOGLE_FILES_EVIDENCE_DIR: evidence,
  GOOGLE_FILES_RUN_ID: runId,
};
delete env.ELECTRON_RUN_AS_NODE;
const child = spawn(
  executable,
  [
    "--new-window",
    ...launchArgs,
    "--extensionDevelopmentPath",
    join(root, "harness"),
    "--extensionTestsPath",
    join(root, "harness/out/compatibility.js"),
  ],
  { env, stdio: "inherit" },
);
const timeout = setTimeout(() => child.kill("SIGTERM"), 90_000);
const exitCode = await new Promise((resolveExit, reject) => {
  child.on("error", reject);
  child.on("exit", (code) => resolveExit(code ?? 1));
});
clearTimeout(timeout);
if (exitCode !== 0) process.exitCode = exitCode;
else {
  const report = JSON.parse(
    await readFile(join(evidence, "compatibility.json"), "utf8"),
  );
  if (report.runId !== runId) throw new Error("Evidence is not from this run");
  console.log(
    `Compatibility gate: ${report.gate}. Report: ${join(evidence, "compatibility.json")}`,
  );
  if (report.gate !== "passed") process.exitCode = 2;
}
