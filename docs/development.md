# Development and verification

The runtime registry in `src/file-types.ts` defines supported shortcut suffixes, application paths, and resource prefixes. Keep the static VS Code manifest readable; the manifest contract test catches drift in selectors and context menus. Add independent resolver cases whenever adding a type.

`extension.ts` registers services and commands. `shortcut-reader.ts` handles VS Code file access; `shortcut.ts` validates JSON and URLs without loading VS Code. `router.ts` owns each custom-editor panel and its cancellation lifecycle. `coordinator.ts` serializes browser handoffs. `development.ts` supplies test-only failure simulation and fixture routing. Its creation is removed at build time from the production bundle.

## Tooling

Oxlint replaces ESLint and typescript-eslint. Every enabled rule in the previous recommended TypeScript configuration was mapped explicitly into `.oxlintrc.json`; shared TypeScript-aware rules use their core names. The underscore-prefixed argument exception is retained. Correctness checks also cover all launch scripts and the compatibility harness, which were only partially covered before. TypeScript checking remains separate; the previous configuration did not enable type-aware ESLint rules.

Oxfmt replaces Prettier with an explicit 80-column print width. Generated output, downloaded VS Code installations, lockfile formatting, and historical evidence are excluded from formatting. `npm test` checks types, lint, formatting, and unit tests; `npm run lint:fix` applies safe fixes and `npm run format` formats maintained files.

## Test and package tooling

`scripts/test-environment.mjs` shares executable/CLI discovery and isolated-profile arguments. Override `VSCODE_EXECUTABLE` and optionally `VSCODE_CLI` for other installations. Profiles are retained under the system temporary directory for failure investigation; launchers do not delete user profiles.

Package filenames and diagnostics derive the version from `package.json`. `npm run package` builds and validates through the prepublish hook, then checks the actual archive with `scripts/inspect-package.mjs`. Inspection checks the file allowlist, manifest contributions, version, runtime equality, and absence of development controls. The ZIP reader uses macOS `unzip`, consistent with the supported release environment. Archive metadata remains in `evidence/package-inspection.json`.

CI runs integration and packaged-profile checks for minimum VS Code 1.138.0 and current stable on macOS. It produces separate artifacts and never publishes automatically. Local tests do not establish that a remote CI run has passed.

Compatibility investigations remain separate from release acceptance: the reuse harness intentionally exits 2 while reliable ownership is unavailable. Historical performance samples are retained unchanged; they do not measure later builds. Manual acceptance is tied to the package hash recorded in its report and is not silently transferred to a rebuilt artifact.
