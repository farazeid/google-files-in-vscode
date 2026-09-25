# ADR 002: Release new-tab behavior without ownership inference

Status: accepted by the user's “Do it” instruction after the scope-reduction recommendation.

ADR 001 remains valid for the attempted global reuse/probe-cleanup design, but does not prohibit a useful new-tab extension. Reliable tracking of extension-created tabs also cannot be established from the command's undefined return and the stable API's unknown browser tab input. The user explicitly accepted a new-tab fallback in that case.

## Revised contract

- A completed request opens a new integrated-browser tab using the URL string form of `workbench.action.browser.open`.
- Concurrent requests for one document share a pending operation. A later request opens another tab.
- Do not call URL reuse filters, enumerate browser URLs, infer identity from labels, or close any browser tab.
- Dispose only the custom-editor WebviewPanel provided directly to this extension, after returning from editor resolution and completing browser handoff.
- The existing browser command is isolated in `src/browser.ts`; no proposed API flags are needed.
- A timeout does not cancel VS Code's command. Retain the in-flight lock until that underlying operation settles. Never automatically retry a timed-out handoff.
- User cancellation prevents queued work, but cannot undo an already executing command.

The full-tab-reuse gate from ADR 001 is deferred by explicit scope revision. Package validation and manual acceptance still precede public publishing. A production bundle must exclude test hooks, loopback fixture overrides, and failure simulations.

## Release acceptance, 24 September 2026

The user explicitly accepted new-tab behavior and the recorded cold-opening performance regression for v0.1.0. The compatibility harness was rerun on VS Code 1.139.0 and reproduced the same ambiguous probe ownership as 1.138.0. No unsafe tab cleanup or reload-based reuse was added. See `evidence/compatibility.json` and `docs/manual-acceptance.md`.
