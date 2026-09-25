import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { root, packagePath } from "./test-environment.mjs";
const result = spawnSync(
  process.execPath,
  [
    join(root, "node_modules/@vscode/vsce/vsce"),
    "package",
    "--out",
    packagePath,
  ],
  { cwd: root, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
