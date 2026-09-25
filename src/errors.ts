import { SUPPORTED_EXTENSIONS } from "./file-types";
export type ErrorCode =
  | "unreadable"
  | "invalid"
  | "unsupported"
  | "unavailable"
  | "failed"
  | "timeout"
  | "cancelled"
  | "busy";
const messages: Record<ErrorCode, string> = {
  unreadable:
    "The shortcut could not be read. Check that Google Drive has made it available locally, then retry.",
  invalid:
    "This shortcut is not a valid Google file. Check its document ID and Google URL using Reopen Editor With → Text Editor.",
  unsupported: `Only local ${SUPPORTED_EXTENSIONS.join(", ")} shortcuts are supported.`,
  unavailable:
    "The integrated browser is unavailable. Use desktop VS Code 1.138.0 or newer, or open this document externally.",
  failed:
    "VS Code could not open the browser tab. Retry or open the document externally.",
  timeout:
    "Opening the browser took too long. It may still finish. Wait before retrying to avoid duplicate tabs.",
  cancelled: "Opening was cancelled.",
  busy: "The previous browser request is still finishing. Wait before retrying, or reload VS Code if it remains stuck.",
};
export class OpenError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
    this.name = "OpenError";
  }
}
export function safeError(error: unknown): OpenError {
  return error instanceof OpenError ? error : new OpenError("failed");
}
