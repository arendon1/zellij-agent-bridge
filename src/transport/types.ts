/**
 * src/transport/types.ts — TypeBox schemas mirroring the JSON shapes zellij
 * emits from its `--json` flags.
 *
 * Source of truth: `zellij action list-panes --json` / `--tab`
 * /`list-tabs --json` / `--panes` / `current-tab-info --json` /
 * `dump-screen` / `dump-layout`. Captured samples live in
 * `tests/fixtures/` and the schemas are validated against them in
 * `tests/codec.test.ts`.
 *
 * Planned schemas (phase 1):
 *
 *   export const PaneGeometry = Type.Object({...});
 *   export const PaneInfo = Type.Object({
 *     id: Type.String(),
 *     type: Type.String(),         // "terminal" | "plugin"
 *     title: Type.String(),
 *     command: Type.Optional(Type.String()),
 *     cwd: Type.Optional(Type.String()),
 *     focused: Type.Boolean(),
 *     is_floating: Type.Boolean(),
 *     is_plugin: Type.Boolean(),
 *     geometry: PaneGeometry,
 *     exited: Type.Boolean(),
 *     exit_status: Type.Optional(Type.Number()),
 *     tab_position: Type.Number(),
 *   });
 *   export type PaneInfoT = Static<typeof PaneInfo>;
 *
 *   export const TabInfo = Type.Object({
 *     position: Type.Number(),
 *     name: Type.String(),
 *     active: Type.Boolean(),
 *     ...   (display_area, swap layout, panes counts, etc.)
 *   });
 *
 *   export const ClientInfo = Type.Object({
 *     pane_id: Type.String(),
 *     ...   (id, focused, geometry, etc.)
 *   });
 *
 *   export const SubscribeEvent = Type.Union([
 *     Type.Object({ pane_id: Type.String(), viewport: Type.Array(Type.String()),
 *                    scrollback: Type.Optional(Type.Array(Type.String())),
 *                    is_initial: Type.Boolean() }),
 *     Type.Object({ SubscribedPaneClosed: Type.Object({ pane_id: Type.String() }) }),
 *   ]);
 *
 * These schemas double as the `outputSchema` for read tools, so codemode
 * callers can consume `structuredContent` without re-parsing.
 */
export {}; // phase 0 — module body intentionally blank