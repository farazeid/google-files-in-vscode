import * as vscode from "vscode";
import { createServer } from "node:http";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir, cpus, release } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import assert from "node:assert/strict";
interface Api {
  setFixtureOrigin(origin: string): void;
}
interface Sample {
  scenario: string;
  pageReadyMs: number;
  routerGoneMs: number;
}
const allTabs = () =>
  vscode.window.tabGroups.all.flatMap((group) => [...group.tabs]);
async function until(predicate: () => boolean) {
  const until = performance.now() + 10000;
  while (!predicate()) {
    if (performance.now() > until) throw new Error("Fixture timeout");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
export async function run(): Promise<void> {
  const ready = new Map<string, number>();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://fixture");
    res.setHeader("Cache-Control", "no-store");
    if (url.pathname === "/ready") {
      ready.set(url.searchParams.get("key")!, performance.now());
      res.end("ok");
      return;
    }
    if (url.pathname.endsWith("/edit")) {
      res.setHeader("Content-Type", "text/html");
      res.end(
        `<!doctype html><title>Performance fixture</title><input value="Synthetic content"><script>window.addEventListener('load',()=>fetch('/ready?key='+encodeURIComponent(location.pathname)))</script>`,
      );
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const origin = `http://127.0.0.1:${address.port}`;
  const directory = await mkdtemp(join(tmpdir(), "gfb-fixtures-"));
  const samples: Sample[] = [];
  const failures: Array<{ scenario: string; sample: number; reason: string }> =
    [];
  const baseline = process.env["GOOGLE_FILES_BENCH_BASELINE"];
  const disposables: vscode.Disposable[] = [];
  try {
    if (baseline) {
      const source = (await readFile(baseline, "utf8")).replaceAll(
        "https://docs.google.com/",
        origin + "/",
      );
      const module = {
        exports: {} as {
          activate(context: { subscriptions: vscode.Disposable[] }): void;
        },
      };
      const nativeRequire = createRequire(__filename);
      runInNewContext(source, {
        module,
        require: (name: string) =>
          name === "vscode" ? vscode : nativeRequire(name),
        setTimeout,
        clearTimeout,
      });
      module.exports.activate({ subscriptions: disposables });
    } else {
      const extension = vscode.extensions.getExtension(
        "farazeid.google-files-in-vscode",
      );
      assert.ok(extension);
      const api = (await extension.activate()) as Api;
      api.setFixtureOrigin(origin);
    }
    const one = async (id: string, scenario: string) => {
      const path = join(directory, id + ".gdoc");
      await writeFile(path, JSON.stringify({ doc_id: id }));
      const uri = vscode.Uri.file(path);
      const key = `/document/d/${id}/edit`;
      ready.delete(key);
      const previous = new Set(allTabs());
      const start = performance.now();
      if (baseline)
        await vscode.window.showTextDocument(
          await vscode.workspace.openTextDocument(uri),
          { preview: false },
        );
      else
        await vscode.commands.executeCommand(
          "vscode.openWith",
          uri,
          "googleFiles.shortcut",
          { preview: false },
        );
      await until(() => ready.has(key));
      const isRouter = (tab: vscode.Tab) =>
        (tab.input instanceof vscode.TabInputText ||
          tab.input instanceof vscode.TabInputCustom) &&
        tab.input.uri.toString() === uri.toString();
      await until(() => !allTabs().some(isRouter));
      samples.push({
        scenario,
        pageReadyMs: ready.get(key)! - start,
        routerGoneMs: performance.now() - start,
      });
      // Isolated benchmark host: every added tab in this controlled iteration is a synthetic fixture.
      await vscode.window.tabGroups.close(
        allTabs().filter((tab) => !previous.has(tab)),
        true,
      );
    };
    if (process.env["GOOGLE_FILES_BENCH_COLD"] === "1")
      await one("cold", "first-open-fresh-process");
    else {
      await one("warmup", "warmup");
      samples.length = 0;
      for (const scenario of [
        "new-document-browser-warm",
        "reopen-after-close",
      ]) {
        for (let i = 0; i < 30; i++) {
          try {
            await one(
              scenario === "reopen-after-close" ? "reopen" : `new${i}`,
              scenario,
            );
          } catch {
            failures.push({
              scenario,
              sample: i + 1,
              reason:
                "Fixture did not become ready or shortcut did not close within 10 seconds.",
            });
            break;
          }
        }
      }
    }
    const output = process.env["GOOGLE_FILES_BENCH_OUTPUT"];
    assert.ok(output);
    await writeFile(
      output,
      JSON.stringify(
        {
          version: vscode.version,
          platform: process.platform,
          arch: process.arch,
          osRelease: release(),
          cpu: cpus()[0]?.model,
          baseline: !!baseline,
          samples,
          failures,
          conditions:
            "Fresh temporary VS Code profile per process; synthetic loopback HTML; cache disabled; excludes VS Code process launch. Legacy baseline differs only by fixture origin.",
          recordedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } finally {
    for (const disposable of disposables) disposable.dispose();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
