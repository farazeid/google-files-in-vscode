# Local performance evidence

The current six-type build was measured on an Apple M4 Pro, macOS kernel 27.0.0, VS Code 1.139.0. These are synthetic loopback pages, not Google documents. The source data is in `evidence/benchmarks/summary.json`; per-process samples are alongside it. The previous-extension baseline below was measured earlier on the same machine under the same fixture method, but was not rerun alongside this build.

## Method

The current build used ten fresh temporary VS Code processes for first-open measurements. A separate fresh process performed one discarded warmup, thirty different-document openings, and thirty reopen-after-close attempts. Browser caching was disabled by the fixture server. Readiness is a page-load event followed by a loopback marker request. VS Code process launch time is excluded. The earlier baseline used the same sample design, but its rapid-reopen series stopped after one success.

The current variant exercised the real custom-editor route with a development-only URL-origin override. The baseline used an isolated, read-only copy of the user's modified Open Google Drive extension; only its Google URL origins were substituted with the same fixture origin. The installed original extension was not edited. The host had no other user extensions enabled.

Measurements include the normal VS Code routing costs of each design. The second endpoint measures when the shortcut tab disappears, including the old extension's 500 ms cleanup timer. That timer does not delay starting navigation.

## Results

| Scenario                    | Samples current / earlier baseline | Page-ready median, current / baseline | Page-ready p95, current / baseline | Shortcut gone median, current / baseline |
| --------------------------- | ---------------------------------- | ------------------------------------- | ---------------------------------- | ---------------------------------------- |
| First open in fresh process | 10 / 10                            | 102 / 93 ms                           | 109 / 107 ms                       | 105 / 586 ms                             |
| New document, browser warm  | 30 / 30                            | 72 / 72 ms                            | 85 / 80 ms                         | 76 / 530 ms                              |
| Reopen after close          | 30 / 1                             | 71 / 74 ms                            | 76 ms / insufficient baseline      | 75 / 533 ms                              |

The old extension failed to reopen the same shortcut on the second rapid reopen attempt within the ten-second observation window. The baseline series was stopped and recorded as incomplete, not padded with successful timings. Its single successful reopen sample is not a meaningful distribution.

## Interpretation and release gate

Warm new-document readiness is close to the earlier baseline; shortcut cleanup is more than 450 ms faster in these runs. The current build completed all thirty rapid reopen samples. Existing-tab switching is not measured because reuse is explicitly deferred.

In the current run, first-open readiness is approximately 10% slower at the median and 2% slower at p95 than the earlier baseline. This cross-run comparison is directional because the baseline was not collected concurrently. The previous build's 122 / 93 ms median comparison exceeded the planned 20% review threshold; investigation found that waiting for a webview-ready handshake substantially increased startup cost. Returning from custom-editor resolution before starting routing removed that wait and reduced the initial median from approximately 199 ms to 122 ms. The latest refactor and run reduced it to 102 ms; these measurements do not isolate which change caused that difference.

The user **accepted the earlier cold-opening regression and new-tab behavior for v0.1.0 on 24 September 2026**. The present run shows no greater-than-20% timing regression against that historical baseline, but it is not a same-session A/B test. This acceptance does not waive other release checks. No claim of faster Google page loads is made.

## Reproduce

```sh
npm run build:test
GOOGLE_FILES_BASELINE=/absolute/path/to/patched/open-gdrive/extension.js node scripts/run-benchmarks.mjs
```

Without the baseline environment variable, only the current implementation is measured. Use `--resume` only to continue an interrupted run with unchanged code and conditions. Running normally replaces the sample files and summary. Timings vary with system load; deterministic correctness assertions are separate from these measurements.
