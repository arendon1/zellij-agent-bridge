/**
 * src/tools/pane.ts — pane mutation + interaction tools.
 *
 * Phase 3 deliverables (mapped to `zellij action <X>` CliActions):
 *
 *   zj_pane_spawn                → `zellij action new-pane` or `zellij run -- ...`
 *                                  returns the id via subsequent list-panes --json
 *   zj_pane_close                → `zellij action close-pane --pane-id <id>`
 *   zj_pane_focus                → `zellij action focus-pane-id <id>`
 *   zj_pane_focus_next           → `zellij action focus-next-pane`
 *   zj_pane_focus_prev           → `zellij action focus-previous-pane`
 *   zj_pane_focus_last           → `zellij action focus-last-pane`
 *   zj_pane_rename               → `zellij action rename-pane --pane-id <id> <name>`
 *   zj_pane_resize               → `zellij action resize` (direction: left|right|up|down)
 *   zj_pane_move                 → `zellij action move-pane --pane-id <id>`
 *   zj_pane_toggle_fullscreen    → `zellij action toggle-fullscreen`
 *   zj_pane_toggle_floating      → `zellij action toggle-floating-panes`
 *   zj_pane_toggle_embedded      → `zellij action toggle-pane-embed-or-floating`
 *   zj_pane_set_borderless       → `zellij action set-pane-borderless ...`
 *   zj_pane_set_color            → `zellij action set-pane-color --pane-id ...`
 *   zj_pane_stack                → `zellij action stack-panes <ids...>`
 *   zj_pane_wait_exit            → polls `list-panes --json` until pane is gone
 *                                  or exited=true (with timeout)
 *   zj_pane_clear                → `zellij action clear --pane-id ...`
 *   zj_pane_edit_scrollback      → `zellij action edit-scrollback --pane-id ...`
 *
 * spawn() design notes:
 *   • Default: `zellij run -- <cmd>` (opens a new pane running the command).
 *   • If `cwd` is given: `--cwd <path>`.
 *   • If `name` is given: `--name <name>`.
 *   • If `floating` is true: `-f`.
 *   • If `in_place` is true: `-i`.
 *   • If `blocking` is true: `--blocking` (useful for one-shot shell-outs).
 *   • Return value: { paneId: PaneId, command: string, spawnedAt: number }
 *     — `paneId` is resolved by diffing list-panes --json before/after.
 *
 * wait_exit() design notes:
 *   • Polls list-panes --json every 250 ms.
 *   • Honors ctx.signal.
 *   • Returns the pane's exit_status if found, else throws on timeout.
 */
export {}; // phase 0 — module body intentionally blank