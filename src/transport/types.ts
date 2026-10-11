/**
 * src/transport/types.ts — TypeBox schemas mirroring the JSON shapes
 * zellij emits from its `--json` flags.
 *
 * Source of truth: real captures in tests/fixtures/ from zellij 0.45.1.
 * Pane ids come back as NUMBERS from list-panes --json, but as
 * "terminal_N" strings from subscribe --format json — both are
 * accepted. Use this when validating read results in tests.
 */

import { Type, type Static } from "typebox";

// ---------- Pane ----------

export const PaneGeometry = Type.Object({
  x: Type.Integer(),
  y: Type.Integer(),
  rows: Type.Integer(),
  columns: Type.Integer(),
  content_x: Type.Integer(),
  content_y: Type.Integer(),
  content_rows: Type.Integer(),
  content_columns: Type.Integer(),
});
export type PaneGeometryT = Static<typeof PaneGeometry>;

export const PaneInfo = Type.Object({
  /** Numeric pane id. Subscribe uses "terminal_<id>" form; this is bare. */
  id: Type.Integer(),
  is_plugin: Type.Boolean(),
  is_focused: Type.Boolean(),
  is_fullscreen: Type.Boolean(),
  is_floating: Type.Boolean(),
  is_suppressed: Type.Boolean(),
  is_held: Type.Boolean(),
  is_selectable: Type.Boolean(),
  title: Type.String(),
  exited: Type.Boolean(),
  exit_status: Type.Union([Type.Integer(), Type.Null()]),
  pane_x: Type.Integer(),
  pane_content_x: Type.Integer(),
  pane_y: Type.Integer(),
  pane_content_y: Type.Integer(),
  pane_rows: Type.Integer(),
  pane_content_rows: Type.Integer(),
  pane_columns: Type.Integer(),
  pane_content_columns: Type.Integer(),
  cursor_coordinates_in_pane: Type.Union([
    Type.Array(Type.Integer()),
    Type.Null(),
  ]),
  terminal_command: Type.Union([Type.String(), Type.Null()]),
  plugin_url: Type.Union([Type.String(), Type.Null()]),
  tab_id: Type.Integer(),
  tab_position: Type.Integer(),
  tab_name: Type.String(),
  /** zellij 0.45+ adds these. */
  pane_command: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  pane_cwd: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  default_fg: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  default_bg: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  index_in_pane_group: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});
export type PaneInfoT = Static<typeof PaneInfo>;

// ---------- Tab ----------

export const TabInfo = Type.Object({
  position: Type.Integer(),
  name: Type.String(),
  active: Type.Boolean(),
  panes_to_hide: Type.Integer(),
  is_fullscreen_active: Type.Boolean(),
  is_sync_panes_active: Type.Boolean(),
  are_floating_panes_visible: Type.Boolean(),
  other_focused_clients: Type.Array(Type.Unknown()),
  active_swap_layout_name: Type.String(),
  is_swap_layout_dirty: Type.Boolean(),
  viewport_rows: Type.Integer(),
  viewport_columns: Type.Integer(),
  display_area_rows: Type.Integer(),
  display_area_columns: Type.Integer(),
  selectable_tiled_panes_count: Type.Integer(),
  selectable_floating_panes_count: Type.Integer(),
  tab_id: Type.Integer(),
  has_bell_notification: Type.Boolean(),
  is_flashing_bell: Type.Boolean(),
});
export type TabInfoT = Static<typeof TabInfo>;

// ---------- Client ----------

/** Parsed shape of `zellij action list-clients`. Plain text; rows are tab-separated. */
export interface ClientRow {
  clientId: number;
  paneId: string | number;
  runningCommand: string;
}
export const ClientListHeaders = ["CLIENT_ID", "ZELLIJ_PANE_ID", "RUNNING_COMMAND"] as const;

// ---------- Subscribe event ----------

/**
 * `zellij subscribe --format json --pane-id ...` NDJSON event shapes.
 * Real shape: `{event: "pane_update", is_initial, pane_id: "terminal_0",
 * scrollback, viewport: string[]}`. Close event:
 * `{event: "pane_closed", pane_id}` (not always present in the stream;
 * the process usually just exits).
 */
export const SubscribeEvent = Type.Object({
  event: Type.Union([Type.Literal("pane_update"), Type.Literal("pane_closed")]),
  is_initial: Type.Optional(Type.Boolean()),
  pane_id: Type.String(), // always "terminal_<n>" form
  scrollback: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
  viewport: Type.Optional(Type.Array(Type.String())),
});
export type SubscribeEventT = Static<typeof SubscribeEvent>;

// ---------- Mode / theme (small enums the user might query) ----------

export const ZellijMode = Type.Union([
  Type.Literal("normal"),
  Type.Literal("locked"),
  Type.Literal("pane"),
  Type.Literal("tab"),
  Type.Literal("resize"),
  Type.Literal("move"),
  Type.Literal("prompt"),
  Type.Literal("tmux"),
  Type.Literal("search"),
  Type.Literal("entersearch"),
  Type.Literal("renametab"),
  Type.Literal("renamepane"),
  Type.Literal("scroll"),
]);
export type ZellijModeT = Static<typeof ZellijMode>;
