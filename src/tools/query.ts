/**
 * src/tools/query.ts — structured reads.
 *
 * Phase 2 deliverables:
 *
 *   zj_pane_list       → `zellij action list-panes --json [--tab] [--command] [--state] [--geometry] [--all]`
 *                        outputSchema: PaneInfo[]
 *   zj_tab_list        → `zellij action list-tabs --json [--state] [--dimensions] [--panes] [--layout] [--all]`
 *                        outputSchema: TabInfo[]
 *   zj_tab_current     → `zellij action current-tab-info --json`
 *                        outputSchema: TabInfo (current only)
 *   zj_clients_list    → `zellij action list-clients` (plain text)
 *   zj_session_dump_layout → `zellij action dump-layout` (returns KDL string)
 *   zj_pane_read_screen    → `zellij action dump-screen --pane-id <id> [--full] [--ansi]`
 *                        returns: string; with --ansi returns: string (ANSI codes preserved)
 *
 * These are all readOnlyHint:true. Use `outputSchema` + `structuredContent`
 * so codemode callers can do `list.panes.filter(p => p.focused)`.
 *
 * `zj_pane_read_screen` is the workhorse — the agent uses it to inspect
 * pane contents whenever subscribe isn't appropriate (one-shot check).
 */
export {}; // phase 0 — module body intentionally blank