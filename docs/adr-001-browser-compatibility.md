# ADR 001: Browser compatibility gate

The v0.1.0 scope was subsequently revised in [ADR 002](adr-002-new-tab-release.md). These findings apply to the deferred reuse/probe-cleanup design.

- Status: blocked; production adapter not approved
- Tested environment: VS Code 1.138.0, macOS arm64
- API policy: stable APIs first; isolated working internal commands allowed; no proposed API flags or VS Code patching

## Requirement

Find and focus matching integrated-browser tabs without navigation or reload, including tabs not opened by the extension and tabs restored after restart. Concurrent user activity must not cause unrelated tabs to be closed or navigated.

The approved plan explicitly requires stopping browser integration if this cannot be established reliably using ordinary stable VS Code.

## Candidate and runtime evidence

The harness calls `workbench.action.browser.open` with the same argument forms used in VS Code's browser implementation. It uses `window.tabGroups`, `commands.getCommands`, and `commands.executeCommand`. It does not import VS Code internals or use page titles for identity.

| Invocation                              | Observed result                                      |
| --------------------------------------- | ---------------------------------------------------- |
| `{ url }` or URL string                 | New browser tab; fixture document requested          |
| `{ reuseUrlFilter }`, matching URL      | Existing tab focused; no additional document request |
| `{ url, reuseUrlFilter }`, matching URL | Existing document requested again                    |
| `{ reuseUrlFilter }`, no matching URL   | New blank tab                                        |

All command calls return `undefined`. Browser tabs expose `input: undefined` through the stable tab API, with no public URL or browser-resource identity.

The concurrency reproducer issues an unrelated browser-opening command alongside a successful match. The observable command return and new-tab input/active shape are identical to those of the no-match probe. The event loop scheduling is tested inside the same Extension Development Host; no real user input is required to reproduce the race.

A production coordinator can serialize its own requests, but cannot serialize all user actions and other extensions. It therefore cannot infer ownership solely from a new tab appearing while its command is pending. Matching by page title is explicitly excluded and would not resolve ownership reliably.

Two isolated runs reproduced the issue; the second also asserts that a previously inactive browser tab actually receives focus and compares the active state of the new tab. The latest run is in `evidence/compatibility.json`.

## Decision

Do not ship an adapter that treats every newly observed unknown tab as its own probe. Do not publish an implementation that reloads matching documents, ignores manual/restored tabs, leaves arbitrary probe tabs behind, or relies on authenticated-page inspection.

The tested command-based candidate fails the ownership gate. This is not a proof that every future API or alternative implementation is impossible. It is sufficient to reject this candidate under the agreed release criteria.

A future candidate must establish both a reliable open/focus operation and an observable result identifying the affected tab, or an equivalently race-safe mechanism. It must pass the same reproducer without weakening the requirements. An upstream command returning structured results, or suitable stabilized browser APIs, would address the missing capability. Proposed APIs are not enabled as a workaround.

## What has not been established

- Reload-free matching across process restart, restored tabs, and every Google URL variant.
- Preservation of editor selection/scroll position, and document editing/saving.
- Session persistence after application or computer restart.
- Minimum/current-stable compatibility beyond the installed 1.138.0 build.
- Performance targets, Google network timings, or comparative benchmarks.
- Marketplace readiness or publisher/repository availability.

The runner's elapsed values measure test steps, including intentional waits; they are not performance results. Fixed waits are confined to this observation harness, not a production cleanup implementation.

## Sources inspected

- [Browser tab command implementation](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/contrib/browserView/electron-browser/features/browserTabManagementFeatures.ts)
- [Stable editor-tab projection](https://github.com/microsoft/vscode/blob/main/src/vs/workbench/api/browser/mainThreadEditorTabs.ts)
- [Proposed browser API](https://github.com/microsoft/vscode/blob/main/src/vscode-dts/vscode.proposed.browser.d.ts)
- [Microsoft's proposed API publishing guidance](https://code.visualstudio.com/api/advanced-topics/using-proposed-api)

Runtime observations, rather than the moving `main` branch, are the evidence for the installed version.
