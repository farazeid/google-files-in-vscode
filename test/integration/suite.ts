import * as vscode from "vscode";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
interface TestApi {
  setSimulation(mode: string): void;
  getHtml(uri: string): string | undefined;
  openFixture(url: string): Promise<void>;
}
async function until(predicate: () => boolean, name: string, ms = 5000) {
  const deadline = performance.now() + ms;
  while (!predicate()) {
    if (performance.now() > deadline) throw new Error(`Timed out: ${name}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension(
    "farazeid.google-files-in-vscode",
  );
  assert.ok(extension);
  assert.deepEqual(
    extension.packageJSON.contributes.customEditors[0].selector
      .map((entry: { filenamePattern: string }) => entry.filenamePattern)
      .sort(),
    ["*.gdoc", "*.gsheet", "*.gslides", "*.gvid", "*.gform", "*.gdraw"].sort(),
  );
  const api = (await extension.activate()) as TestApi | undefined;
  const packaged = process.env["GOOGLE_FILES_PACKAGED"] === "1";
  const dir = await mkdtemp(join(tmpdir(), "google-files-fixtures-"));
  const results: string[] = [];
  const shortcut = async (name: string, content: string) => {
    const path = join(dir, name);
    await writeFile(path, content);
    return vscode.Uri.file(path);
  };
  const tabs = () =>
    vscode.window.tabGroups.all.flatMap((group) => [...group.tabs]);
  if (packaged) {
    assert.equal(api, undefined, "Production must not expose test API");
    assert.ok(
      !(await vscode.commands.getCommands()).includes(
        "googleFiles.dev.simulateFailure",
      ),
    );
    for (const suffix of [
      "gdoc",
      "gsheet",
      "gslides",
      "gvid",
      "gform",
      "gdraw",
    ]) {
      const uri = await shortcut(`invalid.${suffix}`, "{invalid fixture");
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "googleFiles.shortcut",
      );
      await until(
        () =>
          tabs().some(
            (tab) =>
              tab.input instanceof vscode.TabInputCustom &&
              tab.input.uri.toString() === uri.toString(),
          ),
        "production custom editor",
      );
      assert.equal(await readFile(uri.fsPath, "utf8"), "{invalid fixture");
    }
    results.push(
      "all six custom-editor file types registered",
      "installed VSIX activates",
      "no development API or failure command",
      "custom editor registered",
      "shortcut bytes unchanged",
    );
  } else {
    assert.ok(api);
    for (const mode of ["unavailable", "failed"]) {
      api.setSimulation(mode);
      const uri = await shortcut(`${mode}.gdoc`, '{"doc_id":"fixture"}');
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "googleFiles.shortcut",
      );
      await until(
        () => api.getHtml(uri.toString())?.includes('id="external"') === true,
        `${mode} recovery UI`,
      );
      assert.ok(api.getHtml(uri.toString())?.includes('id="retry"'));
      results.push(`${mode}: recovery UI rendered with explicit buttons`);
    }
    const invalid = await shortcut("invalid.gdoc", "{bad fixture");
    await vscode.commands.executeCommand(
      "vscode.openWith",
      invalid,
      "googleFiles.shortcut",
    );
    await until(
      () => api.getHtml(invalid.toString())?.includes('id="retry"') === true,
      "invalid UI",
    );
    assert.ok(!api.getHtml(invalid.toString())?.includes('id="external"'));
    results.push("invalid shortcut has no external fallback");
    api.setSimulation("success");
    for (const extension of [
      "gdoc",
      "gsheet",
      "gslides",
      "gvid",
      "gform",
      "gdraw",
    ]) {
      const uri = await shortcut(`valid.${extension}`, '{"doc_id":"fixture"}');
      const keep = await vscode.workspace.openTextDocument({
        content: "Unrelated unsaved text",
        language: "plaintext",
      });
      await vscode.window.showTextDocument(keep, { preview: false });
      await vscode.commands.executeCommand(
        "vscode.openWith",
        uri,
        "googleFiles.shortcut",
      );
      await until(
        () =>
          !tabs().some(
            (tab) =>
              tab.input instanceof vscode.TabInputCustom &&
              tab.input.uri.toString() === uri.toString(),
          ),
        "router cleanup",
      );
      assert.ok(
        tabs().some(
          (tab) =>
            tab.input instanceof vscode.TabInputText &&
            tab.input.uri.toString() === keep.uri.toString(),
        ),
      );
      assert.equal(await readFile(uri.fsPath, "utf8"), '{"doc_id":"fixture"}');
      results.push(
        `${extension}: own panel disposed, unrelated text and shortcut preserved`,
      );
    }
    api.setSimulation("timeout");
    const timed = await shortcut("timed.gdoc", '{"doc_id":"timeout-fixture"}');
    await vscode.commands.executeCommand(
      "vscode.openWith",
      timed,
      "googleFiles.shortcut",
    );
    await until(
      () => api.getHtml(timed.toString())?.includes("took too long") === true,
      "timeout recovery UI",
      17000,
    );
    assert.ok(api.getHtml(timed.toString())?.includes('id="external"'));
    results.push("15-second timeout recovery UI rendered");
    let requests = 0;
    let readyRequests = 0;
    const server = createServer((req, res) => {
      if (req.url === "/ready") {
        readyRequests++;
        res.end("ok");
        return;
      }
      if (req.url === "/fixture") requests++;
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      });
      res.end(
        '<title>Fixture</title><input value="local"><script>window.addEventListener("load",()=>fetch("/ready"))</script>',
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    try {
      const addr = server.address();
      assert.ok(addr && typeof addr !== "string");
      const before = tabs().length;
      await api.openFixture(`http://127.0.0.1:${addr.port}/fixture`);
      await until(() => requests === 1 && readyRequests === 1, "first fixture");
      await api.openFixture(`http://127.0.0.1:${addr.port}/fixture`);
      await until(
        () =>
          requests === 2 && readyRequests === 2 && tabs().length === before + 2,
        "second fixture",
      );
      results.push(
        "real browser adapter opens two independent tabs with two document requests",
      );
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
  const evidence = process.env["GOOGLE_FILES_EVIDENCE"];
  if (evidence)
    await writeFile(
      evidence,
      JSON.stringify(
        {
          version: vscode.version,
          platform: process.platform,
          packaged,
          results,
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
    );
  console.log(results.join("\n"));
}
