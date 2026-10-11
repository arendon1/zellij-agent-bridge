/**
 * Shared types — small set of cross-cutting type aliases used across
 * src/transport, src/tools, and src/multitask.
 *
 * Pane/tab ids are intentionally `string | number` because zellij
 * uses both forms in different places (bare numbers in
 * `list-panes --json`, `"terminal_N"` strings in `subscribe --format
 * json`). Tools accept either.
 */

import type { ExtensionToolContext } from "@earendil-works/pi-coding-agent";

/** A zellij pane id — either the bare numeric form (list-panes) or the "terminal_N" form (subscribe). */
export type PaneId = string | number;

/** A zellij tab id — numeric. */
export type TabId = string | number;

/** A zellij session name (or empty string for current session). */
export type SessionName = string;

/**
 * Per-tool context — pi's `ExtensionToolContext` (which itself extends
 * `ExtensionContext` and adds `tools`, `executeTool`, etc.) plus the
 * transport handle so every tool gets a consistent way to invoke the
 * CLI.
 */
export interface ZjToolContext extends ExtensionToolContext {
  /** Override session name for this call (undefined = current session). */
  session?: SessionName;
  /**
   * Whether destructive tool calls are auto-approved. When false, the
   * permission gate prompts the user. Default false.
   */
  confirmDestructive: boolean;
}

/**
 * A handle returned by `multitask/worker.ts#spawn` representing a single
 * pane-based worker. The caller can then send input, read screen, wait
 * for exit, etc. through this handle.
 */
export interface WorkerHandle {
  readonly session: SessionName;
  readonly paneId: PaneId;
  readonly command: string;
  readonly spawnedAt: number;
}
