import * as vscode from "vscode";
import { extname } from "node:path";
import { OpenError } from "./errors";
import {
  resolveShortcut,
  MAX_SHORTCUT_BYTES,
  type GoogleFile,
} from "./shortcut";
export async function readShortcut(uri: vscode.Uri): Promise<GoogleFile> {
  if (uri.scheme !== "file" || vscode.env.remoteName)
    throw new OpenError("unsupported");
  let bytes: Uint8Array;
  try {
    if ((await vscode.workspace.fs.stat(uri)).size > MAX_SHORTCUT_BYTES)
      throw new OpenError("invalid");
    bytes = await vscode.workspace.fs.readFile(uri);
  } catch (error) {
    if (error instanceof OpenError) throw error;
    throw new OpenError("unreadable");
  }
  if (bytes.byteLength > MAX_SHORTCUT_BYTES) throw new OpenError("invalid");
  return resolveShortcut(extname(uri.fsPath), new TextDecoder().decode(bytes));
}
