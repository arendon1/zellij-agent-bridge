/**
 * tests/multitask.test.ts — coverage for src/multitask/{worker,farm,reducer}.ts.
 *
 * Phase 5 will fill these in. Each test requires a live zellij session
 * named `zj-bridge-test` to exist; the test runner creates one in
 * `beforeAll` and tears it down in `afterAll`.
 *
 * Planned tests:
 *
 *   • `spawn` returns a WorkerHandle with a valid paneId resolvable via list-panes.
 *   • `spawn` followed by `close` removes the pane from list-panes.
 *   • `write` then `read` returns the written text in the screen.
 *   • `subscribe` until-match resolves with the matched line.
 *   • `subscribe` for-duration resolves after the deadline.
 *   • `subscribe` honors ctx.signal — resolves with last viewport on cancel.
 *   • `waitExit` resolves when the pane's command exits.
 *   • `waitExit` throws on timeout.
 *   • `farm.spawn` returns N handles.
 *   • `farm.collect(mode: all)` waits for all handles to exit.
 *   • `farm.collect(mode: any)` resolves as soon as one exits.
 *   • `farm.collect` honors deadlineMs and returns `timedOut: true`.
 *   • `farm.status` returns one screen per handle.
 *   • `reduce` with mode "max" picks the handle with the most regex matches.
 *   • `reduce` with mode "sum" concatenates matches across handles.
 *   • `reduce` with mode "all" returns per-handle counts.
 *
 * CI-friendly mode: skip when `ZJ_BRIDGE_FAKE=1`, use the recorded
 * scrollback fixtures instead.
 */
export {}; // phase 0 — module body intentionally blank