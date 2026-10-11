/**
 * src/tools/layout.ts — layout tools.
 *
 * Phase 4 deliverables:
 *
 *   zj_layout_apply             → `zellij action override-layout --layout-string <KDL>`
 *                                  (or --layout <path> for file input)
 *                                  flags:
 *                                    --retain-existing-terminal-panes
 *                                    --retain-existing-plugin-panes
 *                                    --apply-only-to-active-tab
 *   zj_layout_apply_file        → same, but reads KDL from a file
 *   zj_layout_dump              → `zellij action dump-layout`  (returns KDL string)
 *   zj_layout_apply_swap_tiled  → `zellij action apply-tiled-swap-layout <name>`
 *   zj_layout_apply_swap_float  → `zellij action apply-floating-swap-layout <name>`
 *
 * Why this matters for multitask:
 *   The agent can hand the user a single `zj_layout_apply` call with a
 *   KDL string describing N tiled panes (e.g. 2x2 grid with named
 *   panes for "build", "test", "lint", "bench") and zellij spawns them
 *   atomically — much faster than N sequential `zj_pane_spawn` calls.
 *
 * KDL examples ship in `examples/kdl/` (to be added in phase 4).
 */
export {}; // phase 0 — module body intentionally blank