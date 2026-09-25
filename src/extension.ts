import * as vscode from "vscode";
import { IntegratedBrowser } from "./browser";
import { OpenCoordinator } from "./coordinator";
import { OpenError, safeError } from "./errors";
import { readShortcut } from "./shortcut-reader";
import { createRouter } from "./router";
import { createDevelopmentControls } from "./development";
declare const __TEST__: boolean;
const VIEW = "googleFiles.shortcut";
export function activate(context: vscode.ExtensionContext): unknown {
  const output = vscode.window.createOutputChannel("Google Files");
  context.subscriptions.push(output);
  const adapter = new IntegratedBrowser();
  const development = __TEST__
    ? createDevelopmentControls(context, adapter)
    : undefined;
  const coordinator = new OpenCoordinator(development?.adapter ?? adapter);
  function log(event: string, elapsedMs?: number): void {
    if (
      vscode.workspace
        .getConfiguration("googleFiles")
        .get<boolean>("diagnostics.enabled", false)
    )
      output.appendLine(
        JSON.stringify({
          event,
          ...(elapsedMs === undefined
            ? {}
            : { elapsedMs: Math.round(elapsedMs * 100) / 100 }),
        }),
      );
  }
  async function external(uri: vscode.Uri): Promise<void> {
    try {
      const file = await readShortcut(uri);
      if (!(await vscode.env.openExternal(vscode.Uri.parse(file.url))))
        throw new OpenError("failed");
    } catch (error) {
      void vscode.window.showErrorMessage(safeError(error).message);
    }
  }
  const provider = createRouter(
    coordinator,
    external,
    log,
    development?.panels,
  );
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(VIEW, provider, {
      supportsMultipleEditorsPerDocument: false,
    }),
  );
  function selected(argument?: vscode.Uri): vscode.Uri | undefined {
    if (argument instanceof vscode.Uri) return argument;
    const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
    if (
      input instanceof vscode.TabInputCustom ||
      input instanceof vscode.TabInputText
    )
      return input.uri;
    return undefined;
  }
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "googleFiles.open",
      async (argument?: vscode.Uri) => {
        const uri = selected(argument);
        if (!uri) {
          void vscode.window.showInformationMessage(
            "Select a Google shortcut in the Explorer first.",
          );
          return;
        }
        await vscode.commands.executeCommand("vscode.openWith", uri, VIEW, {
          preview: false,
        });
      },
    ),
    vscode.commands.registerCommand(
      "googleFiles.openExternal",
      async (argument?: vscode.Uri) => {
        const uri = selected(argument);
        if (uri) await external(uri);
        else
          void vscode.window.showInformationMessage(
            "Select a Google shortcut in the Explorer first.",
          );
      },
    ),
    vscode.commands.registerCommand("googleFiles.diagnostics", () => {
      output.appendLine(
        `Google Files ${context.extension.packageJSON.version}; VS Code ${vscode.version}; ${process.platform}/${process.arch}; browser mode: new tab per completed open.`,
      );
      output.appendLine(
        `Timing diagnostics: ${vscode.workspace.getConfiguration("googleFiles").get("diagnostics.enabled", false) ? "enabled" : "disabled"}. Browser handoff is not page readiness.`,
      );
      output.show(true);
    }),
  );
  return development?.api;
}
