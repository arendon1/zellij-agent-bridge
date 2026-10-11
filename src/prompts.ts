/**
 * src/prompts.ts — model-facing context for the zj_* tools.
 *
 * The pi extension API gives us three surfaces for talking to the
 * model:
 *
 *   1. `promptSnippet` on each tool — one-line "Available tools" entry.
 *   2. `promptGuidelines` on each tool — bullets in the Guidelines section.
 *   3. `before_agent_start` event — can return a `systemPrompt` string
 *      that is prepended to the model's view of the system prompt.
 *
 * This module owns (3) and exports a const for (1)/(2) that the per-
 * category tool files can import. The goal: keep the model's behavior
 * consistent across all 50+ tools without each tool having to repeat
 * the same guidelines.
 *
 * The model sees these guidelines at the start of every turn. They
 * must be terse — every token here is paid on every turn.
 */

/** Per-tool "Available tools" entry. The model uses this to pick tools. */
export const TOOL_SNIPPET =
  "zj_* — full programmatic control of zellij (sessions, panes, tabs, layouts, streaming). Use zj_doctor to diagnose setup.";

/**
 * Pre-pended to the system prompt for every turn. This is the only
 * place the model learns the multitask patterns, the "do not use bash
 * to call zellij" rule, and the destructive-tool semantics.
 *
 * Tuned for token efficiency. The model already has access to each
 * tool's per-tool `description` and `promptGuidelines`; this block
 * is only for cross-tool behavior.
 */
export const SYSTEM_PROMPT_PREAMBLE = `You have access to a zellij-agent-bridge (zj_*) tool family. It gives you full programmatic control of the zellij terminal multiplexer.

You are running inside a zellij session. The bridge knows your pane id and session name. You can interact with yourself (read your own screen, scrollback), with other panes you spawn, and with the zellij state itself.

When to use zj_* vs the built-in bash tool:
  - Use zj_* for any zellij state mutation: pane/tab layout, session control, watching pane output, etc. Never call \`zellij\` from bash — always use the zj_* tool, because the bridge handles JSON parsing, error mapping, and pane-id resolution.
  - Use bash for everything else: file IO, git, npm, build tools, etc.

Multitask patterns:
  - Need to run multiple investigations in parallel? Use zj_farm_spawn to spawn N panes at once, then zj_farm_collect to wait. Pattern: sharded test suites, parallel codemods, multi-repo probes.
  - Need to wait for a long-running command? Use zj_pane_subscribe (returns streaming updates) or zj_pane_wait_for (returns when a regex matches).
  - Need to pipe stdout of one process into another across panes? Use zj_pane_pipe (phase 6). For now, read+write works.

Introspection first:
  - Before mutating zellij state, call zj_session_attach_info (where am I?) and zj_pane_list (what panes exist?). The model has no implicit context about the user's session.
  - If a zj_* tool fails unexpectedly, call zj_doctor to see whether the zellij binary is still there and at the right version.

Destructive operations:
  - zj_session_kill, zj_pane_close, zj_tab_close, zj_session_kill_all, zj_session_detach and other "💥" tools require interactive confirmation. They will be BLOCKED in non-interactive modes. Do not call them unless the user has explicitly asked for the action.
  - The user can pre-approve destructive actions in settings — read their request for context.

When you are done with a worker pane and the user hasn't asked you to keep it open, close it: zj_pane_close. Do not leave orphan panes.

Panes and tabs have unstable IDs across zellij restarts. If you lose track, re-run zj_pane_list. The bridge does not cache pane state.`;

/**
 * Per-tool promptGuidelines bullets that every mutating tool should
 * attach. Each tool category imports this and adds its own
 * tool-specific bullets.
 */
export const COMMON_GUIDELINES: string[] = [
  "Pane and tab IDs are unstable across zellij restarts. Re-run zj_pane_list if you lose track.",
  "If the tool fails, run zj_doctor to confirm zellij is installed and at the right version.",
  "When done with a pane, close it (zj_pane_close) unless the user asked to keep it open.",
];

/**
 * Per-tool promptGuidelines for destructive tools. Imported by tools
 * with `destructiveHint: true` so the model sees the warning.
 */
export const DESTRUCTIVE_GUIDELINES: string[] = [
  "This is a destructive operation. Confirm with the user before invoking unless they have explicitly asked for the action in this turn.",
  "In non-interactive modes, this tool is BLOCKED. Switch to interactive mode (TUI) or have the user pre-approve via settings.",
];

/**
 * Per-tool promptGuidelines for streaming tools (zj_pane_subscribe,
 * zj_farm_collect, zj_pane_wait_for). Tells the model the tool
 * streams via onUpdate and honors cancellation.
 */
export const STREAMING_GUIDELINES: string[] = [
  "Long-running tool. Streams partial output via onUpdate and honors AbortSignal.",
  "Returns a final structuredContent when the stop condition is met (regex match, deadline, etc.) or on cancellation.",
];

/**
 * Per-tool promptGuidelines for read-only tools. Reinforces that the
 * tool is safe to call freely.
 */
export const READONLY_GUIDELINES: string[] = [
  "Read-only. Safe to call any number of times. No side effects on zellij state.",
];
