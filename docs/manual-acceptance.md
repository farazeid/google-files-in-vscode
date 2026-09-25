# Manual acceptance — 24 September 2026

Environment: macOS arm64, desktop VS Code 1.139.0, existing Google login, local My Drive workspace. Tests used the six user-designated disposable Untitled files. No private document URLs, account identifiers, or screenshots are included in this report.

The earlier three-type extension was initially installed. It was updated to the six-type VSIX and VS Code reloaded before testing the added types. Installed runtime bytes match the project runtime. Open Google Drive is disabled in the normal profile. Tested VSIX SHA-256: b45d1c064b1a5a27daecaa800f128ceed98311b099c5b3ad00e72d96e7f7974e.

| App      | Open/edit/save                                                  | Persistence evidence                                                                                                                          |
| -------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Docs     | Pass: inserted acceptance text, observed Saved to Drive         | Marker visible after browser reload; shortcut reopening creates another tab as documented. Initial edit used the previous three-type runtime. |
| Slides   | Pass: inserted subtitle text, observed Saved to Drive           | Marker present after browser reload and application restart                                                                                   |
| Sheets   | Pass: inserted marker in A1, observed Saved to Drive            | Formula bar contains marker after browser reload and application restart                                                                      |
| Forms    | Pass: edited form description, observed all changes saved       | Description persists after browser reload and application restart; form was not published                                                     |
| Drawings | Pass: inserted text box, observed Saved to Drive                | Marker present after browser reload and application restart                                                                                   |
| Vids     | Pass for scene editing: inserted title, observed Saved to Drive | Marker persists after browser reload and application restart                                                                                  |

## Session checks

Google login survived a window reload and a full VS Code quit/relaunch. The fresh application session is recorded in VS Code's 20260924T170527 log directory. Restored browser tabs were present and Google editing surfaces opened without requesting sign-in. This is an observation for the current account/settings, not a guarantee of indefinite authentication. No browser storage setting was changed.

Computer reboot persistence remains untested. It requires a user-managed reboot and subsequent check, because rebooting interrupts this task. Recorder permissions, media uploads, AI generation, Forms responses/publication, and exhaustive Google-app functionality are outside these basic edit/save checks.

## Final-package smoke check — 25 September 2026

The current VSIX (SHA-256 `0e915930c1c7139a6174a500429c86be02e30daffdab049d64f3181f76b0bcf2`) was installed in separate fresh profiles on VS Code 1.138.0 and 1.139.0. Both checks passed for all six file associations, activation, custom-editor registration, absence of development commands, and unchanged shortcut bytes. See `evidence/packaged-1.138.0.json` and `evidence/packaged.json`. These isolated checks did not use a Google login or repeat the six live editing tests above.

## Additional finding: Vids rendered playback

The Vids editor opens and saves text correctly. Its Play viewer displayed a black frame with an accessibility Error Icon and stayed at 0 of 5 seconds when playback was requested. Reproduced before and after the full VS Code restart. The UI did not expose an explanatory error message. Cause is not established; no claim is made that this is a codec issue, Google-side issue, or an extension defect. Playback has not passed acceptance. On 25 September 2026, the user asked to defer this issue for now. The README retains the playback limitation; v0.1.0 makes no claim that rendered Vids playback works in the integrated browser.

## Release decisions

The user explicitly selected: “Accept for v0.1.0; document both limitations.” This accepts new tabs on repeated opens and the recorded cold fixture regression (122 ms versus 93 ms median). It is not approval to publish now.

The tab-reuse harness was rerun on 1.139.0. Known-match focus makes zero new requests, but a missing match and a concurrent unrelated tab still produce indistinguishable public observations. The ownership gate remains blocked. No production workaround was added.

Public release is still pending the computer-reboot session check and repository/listing/final-artifact review steps. Vids playback investigation is deferred with a documented limitation.
