import * as vscode from "vscode";
import { randomBytes } from "node:crypto";
import type { OpenCoordinator } from "./coordinator";
import { safeError } from "./errors";
import type { GoogleFile } from "./shortcut";
import { readShortcut } from "./shortcut-reader";
import { errorPage } from "./presentation";
export function createRouter(
  coordinator: OpenCoordinator,
  external: (uri: vscode.Uri) => Promise<void>,
  log: (event: string, elapsedMs?: number) => void,
  panels?: Map<string, vscode.WebviewPanel>,
): vscode.CustomReadonlyEditorProvider {
  const provider: vscode.CustomReadonlyEditorProvider = {
    async openCustomDocument(uri) {
      return { uri, dispose() {} };
    },
    async resolveCustomEditor(document, panel, token) {
      let disposed = false;
      let running = false;
      const abort = new AbortController();
      panels?.set(document.uri.toString(), panel);
      const listeners: vscode.Disposable[] = [];
      panel.webview.options = { enableScripts: true, localResourceRoots: [] };
      const run = async (): Promise<void> => {
        if (running || disposed || token.isCancellationRequested) return;
        running = true;
        let file: GoogleFile | undefined;
        panel.webview.html =
          '<!doctype html><html lang="en"><head><meta http-equiv="Content-Security-Policy" content="default-src \'none\'"></head><body><p role="status">Opening Google file…</p></body></html>';
        try {
          file = await readShortcut(document.uri);
          if (disposed || token.isCancellationRequested) return;
          const result = await coordinator.open(file, abort.signal);
          log("opened", result.elapsedMs);
          if (!disposed) panel.dispose();
        } catch (error) {
          const safe = safeError(error);
          log(safe.code);
          if (!disposed)
            panel.webview.html = errorPage(
              safe.message,
              file !== undefined,
              randomBytes(16).toString("hex"),
            );
        } finally {
          running = false;
        }
      };
      listeners.push(
        panel.webview.onDidReceiveMessage((message: unknown) => {
          if (!message || typeof message !== "object" || disposed) return;
          const action = (message as { action?: unknown }).action;
          if (action === "retry") void run();
          if (action === "external") void external(document.uri);
        }),
      );
      listeners.push(token.onCancellationRequested(() => abort.abort()));
      listeners.push(
        panel.onDidDispose(() => {
          disposed = true;
          abort.abort();
          panels?.delete(document.uri.toString());
          for (const listener of listeners) listener.dispose();
        }),
      );
      // Return control to VS Code before starting asynchronous routing; do not hold
      // resolveCustomEditor open until the panel is disposed.
      setImmediate(() => {
        void run();
      });
    },
  };
  return provider;
}
