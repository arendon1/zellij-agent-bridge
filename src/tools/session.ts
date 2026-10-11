/**
 * src/tools/session.ts — session-level tools.
 *
 * Phase 2 deliverables:
 *   • zj_session_ls        → `zellij list-sessions` (--short)
 *   • zj_session_new       → `zellij attach -b -- <layout>` or `zellij --layout-string <KDL>`
 *   • zj_session_kill      → `zellij kill-session <name>`  [DESTRUCTIVE]
 *   • zj_session_kill_all  → `zellij kill-all-sessions --yes`  [DESTRUCTIVE]
 *   • zj_session_attach_info → returns the calling agent's current session + pane id
 *                              (uses ZELLIJ_SESSION_NAME env + ZELLIJ_PANE_ID env)
 *   • zj_session_rename    → `zellij action rename-session <name>`
 *
 * Naming convention: every tool is prefixed `zj_` so the model can
 * pattern-match on the namespace. Annotations:
 *   • read-only tools → readOnlyHint: true
 *   • mutating tools  → destructiveHint: false
 *   • kill tools      → destructiveHint: true, idempotentHint: true
 *
 * The `attach_info` tool is interesting: when an agent runs *inside* a
 * zellij session (as a child pane), the tool reports its own pane id so
 * the agent can target itself. The README quickstart depends on this.
 */
export {}; // phase 0 — module body intentionally blank