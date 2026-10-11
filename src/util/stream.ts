/**
 * src/util/stream.ts — NDJSON line parser for `zellij subscribe` output
 * and the streaming variant of runZellij.
 *
 * Two callers:
 *
 *   1. `src/transport/cli.ts#runZellijStreaming` — yields parsed events
 *      from a long-running child. Uses an async iterable so the tool
 *      layer can `for await (const ev of stream)`.
 *
 *   2. `src/tools/subscribe.ts#zj_pane_subscribe` — wraps (1) and surfaces
 *      viewport events to the model via onUpdate.
 *
 * Implementation:
 *   • Use `readline.createInterface({ input: child.stdout })`.
 *   • For each non-empty line, JSON.parse and yield.
 *   • Treat `{ SubscribedPaneClosed: { pane_id } }` as terminal.
 *   • On child exit, flush any remaining buffer then close the iterator.
 *
 * Why NDJSON and not protobuf:
 *   `zellij subscribe --format json` is built-in and stable. The raw IPC
 *   stream is protobuf (see the research notes in docs/zellij-surface.md)
 *   but exposing that would mean shipping the proto file + a runtime,
 *   which is a v2 concern. The CLI NDJSON path is plenty fast for
 *   pane-state streams.
 */
export {}; // phase 0 — module body intentionally blank