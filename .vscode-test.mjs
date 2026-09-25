import { defineConfig } from "@vscode/test-cli";
import { join } from "node:path";
import { root, testEnvironment } from "./scripts/test-environment.mjs";
const { executable, launchArgs } = testEnvironment("gfc-");
export default defineConfig({
  files: ".test-out/cli.test.cjs",
  extensionDevelopmentPath: join(root, ".test-extension"),
  useInstallation: { fromPath: executable },
  launchArgs,
  env: {
    GOOGLE_FILES_EVIDENCE:
      process.env.GOOGLE_FILES_EVIDENCE ??
      join(root, "evidence/integration.json"),
  },
  mocha: { timeout: 60_000, ui: "bdd" },
});
