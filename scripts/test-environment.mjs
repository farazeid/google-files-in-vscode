import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveCliPathFromVSCodeExecutablePath } from "@vscode/test-electron";
export const root = fileURLToPath(new URL("../", import.meta.url));
export const manifest = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);
export const packagePath = join(
  root,
  `${manifest.name}-${manifest.version}.vsix`,
);
export function testEnvironment(prefix = "gfi-", { packaged = false } = {}) {
  const requested =
    process.env.VSCODE_EXECUTABLE ??
    "/Applications/Visual Studio Code.app/Contents/MacOS/Code";
  const executable = existsSync(requested)
    ? requested
    : requested.replace(/\/Electron$/, "/Code");
  const cli =
    process.env.VSCODE_CLI ??
    (process.platform === "darwin"
      ? join(dirname(executable), "../Resources/app/bin/code")
      : resolveCliPathFromVSCodeExecutablePath(executable));
  const scratch = mkdtempSync(
    join(process.platform === "darwin" ? "/private/tmp" : tmpdir(), prefix),
  );
  const profile = join(scratch, "profile");
  const extensions = join(scratch, "extensions");
  const launchArgs = [
    "--user-data-dir",
    profile,
    "--extensions-dir",
    extensions,
    "--skip-welcome",
    "--skip-release-notes",
    "--disable-workspace-trust",
    ...(packaged ? [] : ["--disable-extensions"]),
  ];
  return { executable, cli, profile, extensions, launchArgs };
}
