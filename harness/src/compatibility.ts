import * as vscode from "vscode";
import { createServer } from "node:http";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";

const OPEN = "workbench.action.browser.open";
const results: Array<{ name: string; status: string; details: unknown }> = [];
const counts = new Map<string, number>();
let originalBrowser: vscode.Tab | undefined;
const tabIds = new WeakMap<vscode.Tab, number>();
let nextId = 1;
function id(tab: vscode.Tab): number {
  let value = tabIds.get(tab);
  if (value === undefined) {
    value = nextId++;
    tabIds.set(tab, value);
  }
  return value;
}
function tabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => [...group.tabs]);
}
function describe(tab: vscode.Tab): object {
  return {
    id: id(tab),
    isActive: tab.isActive,
    isDirty: tab.isDirty,
    inputType:
      tab.input === undefined
        ? "undefined"
        : (tab.input as object).constructor.name,
    inputKeys: tab.input === undefined ? [] : Object.keys(tab.input as object),
  };
}
async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const start = performance.now();
  while (!predicate()) {
    if (performance.now() - start > 10_000)
      throw new Error(`Timed out: ${label}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 300));
}
async function measure(
  name: string,
  task: () => Promise<unknown>,
): Promise<void> {
  const start = performance.now();
  const details = await task();
  results.push({
    name,
    status: "passed",
    details: { observations: details, elapsedMs: performance.now() - start },
  });
}

export async function run(): Promise<void> {
  const output = process.env["GOOGLE_FILES_EVIDENCE_DIR"];
  assert.ok(output, "Runner must provide an evidence directory");
  const server = createServer((req, res) => {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path === "/a") {
      counts.set(path, (counts.get(path) ?? 0) + 1);
      res.writeHead(200, {
        "Content-Type": "text/html",
        "Cache-Control": "no-store",
      });
      res.end(
        '<!doctype html><title>Compatibility fixture</title><h1>Local test fixture</h1><input value="Preserve me"><script>document.body.dataset.loadId=crypto.randomUUID()</script>',
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/a`;
  let blocked = false;
  try {
    await waitFor(
      () => vscode.window.tabGroups.all.length > 0,
      "editor groups",
    );
    assert.ok((await vscode.commands.getCommands()).includes(OPEN));
    await measure("open_new_browser", async () => {
      const before = new Set(tabs());
      const returnValue: unknown = await vscode.commands.executeCommand(
        OPEN,
        url,
      );
      await waitFor(() => (counts.get("/a") ?? 0) === 1, "fixture navigation");
      await settle();
      const added = tabs().filter((tab) => !before.has(tab));
      assert.equal(added.length, 1);
      originalBrowser = added[0];
      return {
        commandReturnsUndefined: returnValue === undefined,
        added: added.map(describe),
        requests: counts.get("/a"),
      };
    });
    await measure("focus_existing_without_navigation", async () => {
      const otherDocument = await vscode.workspace.openTextDocument({
        content: "Local compatibility fixture",
        language: "plaintext",
      });
      await vscode.window.showTextDocument(otherDocument);
      assert.ok(originalBrowser && !originalBrowser.isActive);
      const before = tabs().length;
      const count = counts.get("/a");
      const returnValue: unknown = await vscode.commands.executeCommand(OPEN, {
        reuseUrlFilter: url,
      });
      await settle();
      assert.equal(tabs().length, before);
      assert.ok(
        originalBrowser?.isActive,
        "Existing browser tab must actually receive focus",
      );
      assert.equal(counts.get("/a"), count);
      return {
        commandReturnsUndefined: returnValue === undefined,
        newTabs: 0,
        newRequests: 0,
      };
    });
    await measure("url_with_reuse_navigates_again", async () => {
      const count = counts.get("/a") ?? 0;
      await vscode.commands.executeCommand(OPEN, { url, reuseUrlFilter: url });
      await waitFor(() => (counts.get("/a") ?? 0) > count, "repeat navigation");
      return { newRequests: (counts.get("/a") ?? 0) - count };
    });
    let missingSignature: unknown;
    await measure("missing_match_creates_unidentified_blank", async () => {
      const before = new Set(tabs());
      const returnValue: unknown = await vscode.commands.executeCommand(OPEN, {
        reuseUrlFilter: `${url}-missing`,
      });
      await settle();
      const added = tabs().filter((tab) => !before.has(tab));
      assert.equal(added.length, 1);
      missingSignature = {
        commandReturnsUndefined: returnValue === undefined,
        addedInputTypes: added.map((tab) =>
          tab.input === undefined
            ? "undefined"
            : (tab.input as object).constructor.name,
        ),
        addedActive: added.map((tab) => tab.isActive),
      };
      // Test-only cleanup: this isolated scenario deliberately creates exactly one fixture tab.
      const observed = added.map(describe);
      await vscode.window.tabGroups.close(added, true);
      return { signature: missingSignature, added: observed };
    });
    await measure(
      "existing_match_with_concurrent_unrelated_tab_is_ambiguous",
      async () => {
        const before = new Set(tabs());
        const count = counts.get("/a");
        // Independent command models an unrelated user/extension opening a tab during the handoff.
        const [returnValue] = await Promise.all([
          vscode.commands.executeCommand(OPEN, { reuseUrlFilter: url }),
          vscode.commands.executeCommand(OPEN),
        ]);
        await settle();
        const added = tabs().filter((tab) => !before.has(tab));
        const signature = {
          commandReturnsUndefined: returnValue === undefined,
          addedInputTypes: added.map((tab) =>
            tab.input === undefined
              ? "undefined"
              : (tab.input as object).constructor.name,
          ),
          addedActive: added.map((tab) => tab.isActive),
        };
        assert.equal(counts.get("/a"), count);
        assert.deepEqual(signature, missingSignature);
        blocked = true;
        return {
          signature,
          added: added.map(describe),
          newRequests: 0,
          conclusion:
            "The same command result and public tab-input shape can describe a missed probe or an unrelated concurrent tab. Cleanup cannot safely assume ownership.",
        };
      },
    );
  } catch (error) {
    results.push({
      name: "harness_failure",
      status: "failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  } finally {
    await mkdir(output, { recursive: true });
    await writeFile(
      join(output, "compatibility.json"),
      JSON.stringify(
        {
          vscodeVersion: vscode.version,
          platform: process.platform,
          architecture: process.arch,
          runId: process.env["GOOGLE_FILES_RUN_ID"],
          timingNote:
            "Elapsed values include deliberate observation waits; these are not performance benchmarks.",
          recordedAt: new Date().toISOString(),
          gate: blocked ? "blocked" : "not_established",
          proposedApisUsed: false,
          remoteDebuggingUsed: false,
          privateDocumentsUsed: false,
          results,
          notRun: [
            "restored_tab_reuse",
            "restart_session_persistence",
            "performance_benchmarks",
            "Google_document_editing",
          ],
        },
        null,
        2,
      ) + "\n",
    );
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}
