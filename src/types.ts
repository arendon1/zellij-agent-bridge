/**
 * Shared types — small set of cross-cutting type aliases used across
 * src/transport, src/tools, and src/multitask. Avoid putting tool-specific
 * schemas here; those live next to the tool that owns them.
 *
 * The big items in here:
 *
 *  • PaneId / TabId — branded strings so the type system can tell pane and
 *    tab IDs apart (zellij emits both as plain strings like "terminal_3" or
 *    a numeric tab ID; the brand is purely a TS marker).
 *
 *  • ZjToolContext — extension of pi's ExtensionToolContext that adds the
 *    zellij transport + permission gate state. Each tool's execute()
 *    receives this instead of the raw ctx.
 *
 *  • WorkerHandle / FarmSpec — types consumed by the multitask layer.
 */

import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";

/** Zellij pane id, e.g. `"terminal_3"`, `"plugin_7"`. Branded for clarity. */
export type PaneId = string & { readonly __brand: "PaneId" };

/** Zellij tab id (numeric). Branded. */
export type TabId = string & { readonly __brand: "TabId" };

/** A zellij session name (or empty string for current session). */
export type SessionName = string;

/**
 * Per-tool context — pi's `ExtensionToolContext` (which itself extends
 * `ExtensionContext` and adds `tools`, `executeTool`, etc.) plus the
 * transport handle so every tool gets a consistent way to invoke the
 * CLI. See `src/transport/cli.ts` for the underlying `runZellij` shape.
 *
 * Every `execute()` in `src/tools/**` should type its `ctx` as
 * `ZjToolContext`, not `ExtensionToolContext`, so the transport is
 * reachable without a separate import.
 */
export interface ZjToolContext extends ExtensionToolContext {
  /** Override session name for this call (empty = current session). */
  session?: SessionName;
  /**
   * Whether to surface destructive tool calls to the user for confirmation.
   * Tools read this and short-circuit when false.
   */
  confirmDestructive: boolean;
}

/**
 * A handle returned by `multitask/worker.ts#spawn` representing a single
 * pane-based worker. The caller can then send input, read screen, wait
 * for exit, etc. through this handle.
 *
 * (Phase 5 — shape will evolve.)
 */
export interface WorkerHandle {
  readonly session: SessionName;
  readonly paneId: PaneId;
  readonly command: string;
  readonly spawnedAt: number;
  // ...more in phase 5
}