/**
 * src/tools/tab.ts — tab mutation tools.
 *
 * Phase 3 deliverables:
 *
 *   zj_tab_new              → `zellij action new-tab [--name N]`
 *                             returns new tab id (parsed from stderr / next list-tabs)
 *   zj_tab_close            → `zellij action close-tab`
 *   zj_tab_close_id         → `zellij action close-tab-by-id <id>`
 *   zj_tab_goto             → `zellij action go-to-tab <idx>`
 *   zj_tab_goto_id          → `zellij action go-to-tab-by-id <id>`
 *   zj_tab_goto_name        → `zellij action go-to-tab-name <name>` (-c to create)
 *   zj_tab_next             → `zellij action go-to-next-tab`
 *   zj_tab_prev             → `zellij action go-to-previous-tab`
 *   zj_tab_rename           → `zellij action rename-tab <name>`
 *   zj_tab_rename_id        → `zellij action rename-tab-by-id <id> <name>`
 *   zj_tab_move             → `zellij action move-tab <dir>`
 *   zj_tab_apply_swap       → `zellij action apply-tiled-swap-layout <name>`
 *                             (or --floating variant)
 *   zj_tab_override_layout  → `zellij action override-layout --layout-string <KDL>`
 *                             [--retain-existing-terminal-panes]
 *                             [--retain-existing-plugin-panes]
 *                             [--apply-only-to-active-tab]
 *
 * Tabs are how an agent groups a farm of worker panes so they don't
 * clutter the user's workspace — the multitask/farm layer creates a
 * dedicated tab for each batch of workers.
 */
export {}; // phase 0 — module body intentionally blank