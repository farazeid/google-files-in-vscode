/** Supported Drive shortcut types. The manifest is checked against this registry. */
export const FILE_TYPES = [
  { extension: ".gdoc", kind: "document", resources: ["document"] },
  { extension: ".gsheet", kind: "spreadsheets", resources: ["spreadsheet"] },
  { extension: ".gslides", kind: "presentation", resources: ["presentation"] },
  { extension: ".gvid", kind: "videos", resources: ["vid", "video"] },
  { extension: ".gform", kind: "forms", resources: ["form"] },
  { extension: ".gdraw", kind: "drawings", resources: ["drawing"] },
] as const;
export type GoogleKind = (typeof FILE_TYPES)[number]["kind"];
export const SUPPORTED_EXTENSIONS = FILE_TYPES.map(
  ({ extension }) => extension,
);
export const CONTEXT_WHEN = `resourceScheme == file && resourceExtname =~ /\\.(${SUPPORTED_EXTENSIONS.map((extension) => extension.slice(1)).join("|")})$/`;
