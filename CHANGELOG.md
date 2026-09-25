# Changelog

## 0.1.0 — Local review build

- Open local Google Docs, Sheets, Slides, Vids, Forms, and Drawings shortcuts in VS Code browser tabs.
- Validate shortcut IDs, Google URLs, document types, and access parameters.
- Coalesce in-flight duplicate requests and serialize browser handoffs.
- Provide explicit retry/external-browser recovery with a bounded handoff timeout.
- Keep shortcut files and existing browser tabs untouched.
- Add opt-in local diagnostics and deterministic tests.
- Deliberately open a new tab for each completed open; browser-tab reuse is deferred.
