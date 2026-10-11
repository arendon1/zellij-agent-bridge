/**
 * src/tools/subscribe.ts — long-running pane render stream.
 *
 * Phase 2 deliverable:
 *
 *   zj_pane_subscribe  → wraps `zellij subscribe --format json --pane-id <id>
 *                          [--scrollback [N]] [--ansi]`
 *
 * Two modes:
 *   • "until-prompt"  — stream until pane's prompt is detected (default regex),
 *                        then return final viewport + scrollback snapshot.
 *                        Best for: "wait for this CLI tool to be ready"
 *   • "for-duration"  — stream for N ms, then return whatever was captured.
 *                        Best for: "show me what happened in the last 30s"
 *   • "until-match"   — stream until a regex matches a viewport line, return
 *                        early with the matched line + a few lines of context.
 *                        Best for: "wait for the test runner to print 'OK'"
 *
 * Implementation:
 *   • execute() returns a Promise that resolves when the stop condition
 *     is met. Uses `onUpdate(partialResult)` to push intermediate events
 *     to the UI as a scrolling transcript.
 *   • Honors ctx.signal (abort = clean up child + resolve early).
 *   • Spawns `zellij subscribe` via the streaming variant of runZellij.
 *   • Cleans up the child in session_shutdown.
 *
 * This is the bridge between "passive read" (query.ts) and "interactive
 * wait-for" (multitask/reducer.ts) — most of the multitask patterns in
 * docs/multitask-patterns.md are built on top of this tool.
 */
export {}; // phase 0 — module body intentionally blank