/**
 * src/multitask/worker.ts — `WorkerHandle`, the abstraction the rest of
 * the multitask layer sits on.
 *
 * A worker is one pane running one command. Lifecycle:
 *
 *   1. spawn()        — create pane, return handle
 *   2. write()        — send chars/keys into the pane's PTY
 *   3. read()         — synchronous dump-screen
 *   4. subscribe()    — async iterator over viewport updates
 *   5. waitExit()     — block until the pane's process exits
 *   6. close()        — close pane (best-effort if the process is hung)
 *
 * The handle is intentionally not disposable — the caller decides when to
 * close the pane. This lets the agent leave worker panes open across
 * multiple turns (e.g. "let me read that pane again later").
 *
 * Used by:
 *   • `src/multitask/farm.ts` — `zj_farm_spawn` returns WorkerHandle[].
 *   • `src/multitask/reducer.ts` — `zj_pane_collect_lines` takes a
 *     WorkerHandle and a regex.
 *   • Any tool that needs to talk to a specific pane (e.g. a future
 *     "spawn a debug session and attach a debugger").
 *
 * Phase 5 — implementation.
 */
export {}; // phase 0 — module body intentionally blank