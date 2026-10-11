/**
 * tests/transport.test.ts — coverage for src/transport/cli.ts.
 *
 * Phase 1 will fill these in. Each test requires a live `zellij` binary
 * (`which zellij` must succeed, version ≥0.45) OR a `ZJ_BRIDGE_FAKE=1`
 * env var that uses fixtures instead of the real CLI.
 *
 * Planned tests (one per behaviour, not per call):
 *
 *   • `runZellij(['list-sessions'])` returns trimmed string[].
 *   • `runZellij(['action','list-panes','--json'])` returns parsed PaneInfo[].
 *   • `runZellij(['action','list-tabs','--json'])` returns parsed TabInfo[].
 *   • `runZellij(['action','current-tab-info','--json'])` returns TabInfo.
 *   • `runZellij(['action','dump-screen','--pane-id','terminal_1'])` returns text.
 *   • `runZellij(['action','dump-layout'])` returns KDL string.
 *   • Non-zero exit code produces a typed ZellijError with kind from classify().
 *   • `runZellij` honors ctx.signal — child receives SIGTERM, then SIGKILL.
 *   • `runZellij` honors timeoutMs — child receives SIGTERM at deadline.
 *   • `runZellij` rejects input exceeding maxOutputBytes (default 10 MB).
 *   • `runZellijStreaming` yields parsed NDJSON events in order.
 *   • `runZellijStreaming` closes iterator cleanly on SubscribedPaneClosed.
 *   • `runZellijStreaming` closes iterator on child exit.
 *
 * Skip pattern (when zellij is unavailable):
 *
 *   const hasZellij = await exec('which zellij').then(() => true).catch(() => false);
 *   if (!hasZellij) test.skip(...)
 */
export {}; // phase 0 — module body intentionally blank