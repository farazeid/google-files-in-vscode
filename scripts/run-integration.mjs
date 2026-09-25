import { runTests } from "@vscode/test-electron";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { root, packagePath, testEnvironment } from "./test-environment.mjs";
const packaged = process.argv.includes("--packaged");
const { executable, cli, profile, extensions, launchArgs } = testEnvironment(
  "gfi-",
  { packaged },
);
await mkdir("evidence", { recursive: true });
if (packaged) {
  execFileSync(
    cli,
    [
      "--user-data-dir",
      profile,
      "--extensions-dir",
      extensions,
      "--install-extension",
      packagePath,
    ],
    { stdio: "inherit" },
  );
}
await runTests({
  vscodeExecutablePath: executable,
  extensionDevelopmentPath: join(
    root,
    packaged ? "harness" : ".test-extension",
  ),
  extensionTestsPath: join(root, ".test-out/suite.cjs"),
  extensionTestsEnv: {
    GOOGLE_FILES_PACKAGED: packaged ? "1" : "0",
    GOOGLE_FILES_EVIDENCE:
      process.env.GOOGLE_FILES_EVIDENCE ??
      join(root, "evidence", packaged ? "packaged.json" : "integration.json"),
  },
  launchArgs,
});
