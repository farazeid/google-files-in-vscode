import * as vscode from "vscode";
import type { BrowserAdapter } from "./coordinator";
import { OpenError } from "./errors";
/** Included only in the development build; production calls are compile-time eliminated. */
export function createDevelopmentControls(
  context: vscode.ExtensionContext,
  browser: BrowserAdapter,
) {
  let simulation = "none";
  let fixtureOrigin: string | undefined;
  const panels = new Map<string, vscode.WebviewPanel>();
  const adapter: BrowserAdapter = {
    async open(url) {
      if (simulation === "unavailable") throw new OpenError("unavailable");
      if (simulation === "failed") throw new OpenError("failed");
      if (simulation === "timeout") return new Promise<void>(() => undefined);
      if (simulation === "success") return;
      await browser.open(
        fixtureOrigin ? fixtureOrigin + new URL(url).pathname : url,
      );
    },
  };
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "googleFiles.dev.simulateFailure",
      async () => {
        simulation =
          (await vscode.window.showQuickPick(
            ["none", "unavailable", "failed", "timeout", "success"],
            { title: "Google Files development-only simulation" },
          )) ?? "none";
      },
    ),
  );
  return {
    adapter,
    panels,
    api: {
      setFixtureOrigin(value: string) {
        fixtureOrigin = value;
      },
      getHtml(uri: string) {
        return panels.get(uri)?.webview.html;
      },
      setSimulation(value: string) {
        simulation = value;
      },
      openFixture(url: string) {
        return browser.open(url);
      },
    },
  };
}
