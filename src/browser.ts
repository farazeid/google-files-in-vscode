import * as vscode from "vscode";
import { OpenError } from "./errors";
import type { BrowserAdapter } from "./coordinator";

export const BROWSER_COMMAND = "workbench.action.browser.open";

export class IntegratedBrowser implements BrowserAdapter {
  async open(url: string): Promise<void> {
    if (
      vscode.env.uiKind !== vscode.UIKind.Desktop ||
      vscode.env.remoteName ||
      !(await vscode.commands.getCommands()).includes(BROWSER_COMMAND)
    )
      throw new OpenError("unavailable");
    try {
      await vscode.commands.executeCommand(BROWSER_COMMAND, url);
    } catch {
      throw new OpenError("failed");
    }
  }
}
