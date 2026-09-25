import { OpenError } from "./errors";
import { FILE_TYPES, type GoogleKind } from "./file-types";
export type { GoogleKind } from "./file-types";
export interface GoogleFile {
  readonly kind: GoogleKind;
  readonly id: string;
  readonly key: string;
  readonly url: string;
}
const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-zA-Z0-9_-]{1,512}$/.test(value);
export const MAX_SHORTCUT_BYTES = 1024 * 1024;
export function resolveShortcut(
  extension: string,
  content: string,
): GoogleFile {
  const type = FILE_TYPES.find(
    (type) => type.extension === extension.toLowerCase(),
  );
  const kind = type?.kind;
  if (!type || !kind) throw new OpenError("unsupported");
  let value: unknown;
  try {
    value = JSON.parse(content.replace(/^\uFEFF/, ""));
  } catch {
    throw new OpenError("invalid");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new OpenError("invalid");
  const data = value as Record<string, unknown>;
  const ids: string[] = [];
  if (data["doc_id"] !== undefined) {
    if (!validId(data["doc_id"])) throw new OpenError("invalid");
    ids.push(data["doc_id"]);
  }
  if (data["resource_id"] !== undefined) {
    if (typeof data["resource_id"] !== "string") throw new OpenError("invalid");
    const match = /^([a-z]+):([a-zA-Z0-9_-]{1,512})$/.exec(data["resource_id"]);
    if (!match || !type.resources.some((resource) => resource === match[1]))
      throw new OpenError("invalid");
    ids.push(match[2]!);
  }
  let supplied: URL | undefined;
  if (data["url"] !== undefined) {
    if (typeof data["url"] !== "string") throw new OpenError("invalid");
    try {
      supplied = new URL(data["url"]);
    } catch {
      throw new OpenError("invalid");
    }
    if (
      supplied.protocol !== "https:" ||
      supplied.username ||
      supplied.password ||
      supplied.port ||
      !["docs.google.com", "drive.google.com"].includes(supplied.hostname)
    )
      throw new OpenError("invalid");
    if (supplied.pathname === "/open") {
      const id = supplied.searchParams.get("id");
      if (!validId(id) || supplied.searchParams.getAll("id").length !== 1)
        throw new OpenError("invalid");
      ids.push(id);
    } else {
      const match =
        /^\/([a-z]+)\/(?:u\/\d+\/)?d\/([a-zA-Z0-9_-]{1,512})(?:\/(?:edit|view|preview))?\/?$/.exec(
          supplied.pathname,
        );
      if (
        supplied.hostname !== "docs.google.com" ||
        !match ||
        match[1] !== kind
      )
        throw new OpenError("invalid");
      ids.push(match[2]!);
    }
  }
  if (ids.length === 0 || new Set(ids).size !== 1)
    throw new OpenError("invalid");
  const id = ids[0]!;
  const target = new URL(`https://docs.google.com/${kind}/d/${id}/edit`);
  if (supplied) {
    target.search = supplied.search;
    target.searchParams.delete("id");
    target.hash = supplied.hash;
    const account = /^\/(?:[a-z]+)\/u\/(\d+)\//.exec(supplied.pathname);
    if (account && !target.searchParams.has("authuser"))
      target.searchParams.set("authuser", account[1]!);
  }
  return { kind, id, key: `${kind}:${id}`, url: target.toString() };
}
