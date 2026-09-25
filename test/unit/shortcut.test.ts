import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShortcut } from "../../src/shortcut";
import { OpenError } from "../../src/errors";
for (const [extension, kind, resource] of [
  [".gdoc", "document", "document"],
  [".gsheet", "spreadsheets", "spreadsheet"],
  [".gslides", "presentation", "presentation"],
  [".gvid", "videos", "vid"],
  [".gform", "forms", "form"],
  [".gdraw", "drawings", "drawing"],
]) {
  test(`${extension}: all pointer forms agree`, () => {
    for (const data of [
      { doc_id: "Example-ID_1" },
      { resource_id: `${resource}:Example-ID_1` },
      { url: `https://docs.google.com/${kind}/d/Example-ID_1/edit` },
      { url: "https://drive.google.com/open?id=Example-ID_1" },
    ]) {
      assert.equal(
        resolveShortcut(extension!, JSON.stringify(data)).url,
        `https://docs.google.com/${kind}/d/Example-ID_1/edit`,
      );
    }
  });
}
test("preserves access key, account and fragment without duplicating identity", () => {
  const file = resolveShortcut(
    ".gsheet",
    JSON.stringify({
      doc_id: "abc",
      url: "https://docs.google.com/spreadsheets/u/2/d/abc/edit?resourcekey=secret#gid=42",
    }),
  );
  assert.equal(file.key, "spreadsheets:abc");
  assert.equal(new URL(file.url).searchParams.get("resourcekey"), "secret");
  assert.equal(new URL(file.url).searchParams.get("authuser"), "2");
  assert.equal(new URL(file.url).hash, "#gid=42");
});
for (const data of [
  null,
  [],
  {},
  { doc_id: "" },
  { doc_id: "abc/def" },
  { doc_id: 42 },
  { doc_id: "a", resource_id: "document:b" },
  { doc_id: "a", url: "https://docs.google.com/document/d/b/edit" },
  { resource_id: "spreadsheet:a" },
  { url: "http://docs.google.com/document/d/a/edit" },
  { url: "https://evil.example/document/d/a/edit" },
  { url: "https://docs.google.com.evil.example/document/d/a/edit" },
  { url: "https://user:pass@docs.google.com/document/d/a/edit" },
  { url: "https://docs.google.com/document/d/a/copy" },
  { url: "https://docs.google.com/spreadsheets/d/a/edit" },
  { url: "https://drive.google.com/open?id=a&id=b" },
  { url: "file:///private/file" },
  { url: "https://docs.google.com:444/document/d/a/edit" },
]) {
  test(`rejects unsafe or conflicting shortcut ${JSON.stringify(data)}`, () =>
    assert.throws(
      () => resolveShortcut(".gdoc", JSON.stringify(data)),
      (e: unknown) => e instanceof OpenError && e.code === "invalid",
    ));
}
test("invalid JSON and unsupported extensions have safe errors", () => {
  assert.throws(
    () => resolveShortcut(".gdoc", "private invalid content"),
    (e: unknown) =>
      e instanceof OpenError && !e.message.includes("private invalid content"),
  );
  assert.throws(
    () => resolveShortcut(".pdf", "{}"),
    (e: unknown) => e instanceof OpenError && e.code === "unsupported",
  );
});
test("each read resolves the current contents", () => {
  assert.notEqual(
    resolveShortcut(".gdoc", '{"doc_id":"before"}').key,
    resolveShortcut(".gdoc", '{"doc_id":"after"}').key,
  );
});

for (const [ext, kind] of [
  [".gvid", "videos"],
  [".gform", "forms"],
  [".gdraw", "drawings"],
]) {
  test(`${ext}: preserves access and position and rejects mismatches`, () => {
    const file = resolveShortcut(
      ext!,
      JSON.stringify({
        doc_id: "fixture",
        url: `https://docs.google.com/${kind}/u/2/d/fixture/edit?resourcekey=secret#position`,
      }),
    );
    assert.equal(file.key, `${kind}:fixture`);
    assert.equal(new URL(file.url).searchParams.get("authuser"), "2");
    assert.equal(new URL(file.url).searchParams.get("resourcekey"), "secret");
    assert.equal(new URL(file.url).hash, "#position");
    for (const data of [
      {
        doc_id: "other",
        url: `https://docs.google.com/${kind}/d/fixture/edit`,
      },
      { resource_id: "document:fixture" },
      { url: "https://docs.google.com/document/d/fixture/edit" },
      { url: `https://evil.example/${kind}/d/fixture/edit` },
      { url: `https://docs.google.com/${kind}/d/fixture/copy` },
    ])
      assert.throws(
        () => resolveShortcut(ext!, JSON.stringify(data)),
        OpenError,
      );
  });
}
test("Forms respondent IDs cannot be mistaken for editable file IDs", () => {
  for (const url of [
    "https://docs.google.com/forms/d/e/published-id/viewform",
    "https://forms.gle/short-id",
  ])
    assert.throws(
      () => resolveShortcut(".gform", JSON.stringify({ url })),
      OpenError,
    );
});
