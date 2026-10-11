/**
 * src/tools/pane.ts — pane mutation + interaction tools.
 *
 * ~30 tools. The biggest category. Compactly written — each tool
 * is the same 12-line pattern (params, output, tool, register).
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_newPane,
  env_closePane,
  env_focusPane,
  env_renamePane,
  env_resizePane,
  env_moveFocus,
  env_moveFocusOrTab,
  env_movePane,
  env_movePaneBackwards,
  env_focusNext,
  env_focusPrev,
  env_focusLast,
  env_toggleFullscreen,
  env_toggleNoUiFullscreen,
  env_toggleEmbedded,
  env_toggleFloating,
  env_showFloating,
  env_hideFloating,
  env_floatingVisible,
  env_togglePinned,
  env_toggleFrames,
  env_setBorderless,
  env_setBorderStyle,
  env_setPaneColor,
  env_clearPane,
  env_breakPane,
  env_editScrollback,
  env_scrollAt,
  env_scrollToPrompt,
  env_selectCommandAt,
  env_copyLastOutput,
  env_listPanes,
} from "../protocol/envelopes.ts";
import { runZellij } from "../transport/cli.ts";
import { COMMON_GUIDELINES, DESTRUCTIVE_GUIDELINES, READONLY_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";
import type { PaneInfoT } from "../transport/types.ts";

const Direction = StringEnum(["left", "right", "up", "down"] as const);
const PaneIdField = Type.Union([Type.String(), Type.Integer()], { description: "Pane id (number from list-panes, or 'terminal_N' from subscribe)" });
const PaneIdParam = { paneId: PaneIdField };
const PaneIdOutput = Type.Object({ paneId: Type.String() });
const OkOutput = Type.Object({ ok: Type.Boolean() });

// ---------- zj_pane_spawn ----------

const PaneSpawnParams = Type.Object({
  command: Type.Optional(Type.String({ description: "Command to run in the new pane. Defaults to 'sh'." })),
  direction: Type.Optional(Direction),
  name: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
  floating: Type.Optional(Type.Boolean()),
  inPlace: Type.Optional(Type.Boolean()),
  blocking: Type.Optional(Type.Boolean()),
  closeOnExit: Type.Optional(Type.Boolean()),
  startSuspended: Type.Optional(Type.Boolean()),
});

const PaneSpawnOutput = Type.Object({
  paneId: Type.Union([Type.Integer(), Type.Null()]),
  command: Type.String(),
  spawnedAt: Type.Number(),
});

const paneSpawnTool = defineTool({
  name: "zj_pane_spawn",
  label: "Zellij: spawn pane",
  description: "Open a new pane running a command. Returns the pane id. For multiple panes at once, prefer zj_layout_apply.",
  parameters: PaneSpawnParams,
  outputSchema: PaneSpawnOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, "For multiple panes at once, prefer zj_layout_apply (atomic) over multiple zj_pane_spawn calls."],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const session = getSession();
      const before = await runZellij(
        session ? ["--session", session, "action", "list-panes", "--json"] : ["action", "list-panes", "--json"],
        { expectJson: true },
      );
      const beforeIds = new Set<number>(
        Array.isArray(before.parsed) ? (before.parsed as PaneInfoT[]).map((p) => p.id) : [],
      );
      const out = await callEnvelope(env_newPane, params, session);
      // Resolve the new pane id.
      let paneId: number | null = null;
      for (let i = 0; i < 10 && paneId === null; i++) {
        await new Promise((r) => setTimeout(r, 50));
        const after = await runZellij(
          session ? ["--session", session, "action", "list-panes", "--json"] : ["action", "list-panes", "--json"],
          { expectJson: true },
        );
        const allPanes = Array.isArray(after.parsed) ? (after.parsed as PaneInfoT[]) : [];
        const newPanes = allPanes.filter((p) => !beforeIds.has(p.id));
        if (newPanes.length > 0) paneId = newPanes[newPanes.length - 1]!.id;
      }
      return okResult(
        paneId !== null ? `spawned pane ${paneId}` : `spawned pane (id pending)`,
        { paneId, command: out.command, spawnedAt: out.spawnedAt },
      );
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_close ----------

const PaneCloseParams = Type.Object(PaneIdParam);
const PaneCloseOutput = Type.Object({ closed: Type.String() });

const paneCloseTool = defineTool({
  name: "zj_pane_close",
  label: "Zellij: close pane",
  description: "Close a pane by id. DESTRUCTIVE.",
  parameters: PaneCloseParams,
  outputSchema: PaneCloseOutput,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, ...DESTRUCTIVE_GUIDELINES],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_closePane, params, getSession());
      return okResult(`closed pane ${params.paneId}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_focus + focus_next/prev/last ----------

const PaneFocusParams = Type.Object(PaneIdParam);
const PaneFocusOutput = Type.Object({ focused: Type.String() });

const paneFocusTool = defineTool({
  name: "zj_pane_focus",
  label: "Zellij: focus pane",
  description: "Focus a specific pane by id.",
  parameters: PaneFocusParams,
  outputSchema: PaneFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_focusPane, params, getSession());
      return okResult(`focused pane ${params.paneId}`, out);
    } catch (err) { return errorResult(err); }
  },
});

const paneFocusNextTool = defineTool({
  name: "zj_pane_focus_next",
  label: "Zellij: focus next pane",
  description: "Move focus to the next pane in tab order.",
  parameters: Type.Object({}),
  outputSchema: PaneFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_focusNext, {}, getSession()); return okResult("focused next pane", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneFocusPrevTool = defineTool({
  name: "zj_pane_focus_prev",
  label: "Zellij: focus previous pane",
  description: "Move focus to the previous pane in tab order.",
  parameters: Type.Object({}),
  outputSchema: PaneFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_focusPrev, {}, getSession()); return okResult("focused previous pane", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneFocusLastTool = defineTool({
  name: "zj_pane_focus_last",
  label: "Zellij: focus last pane",
  description: "Move focus to the previously focused pane.",
  parameters: Type.Object({}),
  outputSchema: PaneFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_focusLast, {}, getSession()); return okResult("focused last pane", o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_rename ----------

const PaneRenameParams = Type.Object({ ...PaneIdParam, name: Type.String() });
const PaneRenameOutput = Type.Object({ paneId: Type.String(), name: Type.String() });

const paneRenameTool = defineTool({
  name: "zj_pane_rename",
  label: "Zellij: rename pane",
  description: "Rename a pane.",
  parameters: PaneRenameParams,
  outputSchema: PaneRenameOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_renamePane, params, getSession()); return okResult(`renamed pane to '${params.name}'`, o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_resize + move_focus + move_focus_or_tab + move + move_backwards ----------

const PaneResizeParams = Type.Object({ direction: Direction });
const PaneResizeOutput = Type.Object({ direction: Type.String() });

const paneResizeTool = defineTool({
  name: "zj_pane_resize",
  label: "Zellij: resize focused pane",
  description: "Resize the focused pane in a direction.",
  parameters: PaneResizeParams,
  outputSchema: PaneResizeOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_resizePane, params, getSession()); return okResult(`resized ${params.direction}`, { direction: params.direction }); }
    catch (e) { return errorResult(e); }
  },
});

const PaneMoveFocusParams = Type.Object({ direction: Direction });
const PaneMoveFocusOutput = Type.Object({ direction: Type.String() });

const paneMoveFocusTool = defineTool({
  name: "zj_pane_move_focus",
  label: "Zellij: move focus",
  description: "Move focus to an adjacent pane in a direction.",
  parameters: PaneMoveFocusParams,
  outputSchema: PaneMoveFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_moveFocus, params, getSession()); return okResult(`moved focus ${params.direction}`, { direction: params.direction }); }
    catch (e) { return errorResult(e); }
  },
});

const PaneMoveFocusOrTabParams = Type.Object({ direction: Direction });

const paneMoveFocusOrTabTool = defineTool({
  name: "zj_pane_move_focus_or_tab",
  label: "Zellij: move focus or tab",
  description: "Move focus to an adjacent pane, or to the next/previous tab if at the edge.",
  parameters: PaneMoveFocusOrTabParams,
  outputSchema: PaneMoveFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_moveFocusOrTab, params, getSession()); return okResult(`moved focus or tab ${params.direction}`, { direction: params.direction }); }
    catch (e) { return errorResult(e); }
  },
});

const paneMoveTool = defineTool({
  name: "zj_pane_move",
  label: "Zellij: move pane",
  description: "Move the focused pane in a direction (swap with neighbor).",
  parameters: PaneMoveFocusParams,
  outputSchema: PaneMoveFocusOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_movePane, params, getSession()); return okResult(`moved pane ${params.direction}`, { direction: params.direction }); }
    catch (e) { return errorResult(e); }
  },
});

const paneMoveBackwardsTool = defineTool({
  name: "zj_pane_move_backwards",
  label: "Zellij: move pane backwards",
  description: "Move the focused pane backwards in the layout.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_movePaneBackwards, {}, getSession()); return okResult("moved pane backwards", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_toggle_fullscreen + toggle_no_ui_fullscreen ----------

const paneToggleFullscreenTool = defineTool({
  name: "zj_pane_toggle_fullscreen",
  label: "Zellij: toggle fullscreen",
  description: "Toggle fullscreen mode for the focused pane.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_toggleFullscreen, {}, getSession()); return okResult("toggled fullscreen", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const paneToggleNoUiFullscreenTool = defineTool({
  name: "zj_pane_toggle_no_ui_fullscreen",
  label: "Zellij: toggle no-UI fullscreen",
  description: "Toggle fullscreen without UI (hides the status bar too).",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_toggleNoUiFullscreen, {}, getSession()); return okResult("toggled no-UI fullscreen", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_toggle_embedded + toggle_floating + floating_show/hide/visible ----------

const PaneToggleEmbeddedParams = Type.Object({ paneId: Type.Optional(PaneIdField) });

const paneToggleEmbeddedTool = defineTool({
  name: "zj_pane_toggle_embedded",
  label: "Zellij: toggle embedded",
  description: "Toggle whether the pane is embedded (inline) or floating.",
  parameters: PaneToggleEmbeddedParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_toggleEmbedded, params, getSession()); return okResult("toggled embedded", o); }
    catch (e) { return errorResult(e); }
  },
});


const paneToggleFloatingTool = defineTool({
  name: "zj_pane_toggle_floating",
  label: "Zellij: toggle floating panes visible",
  description: "Toggle visibility of all floating panes in the current tab.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ visible: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_toggleFloating, {}, getSession()); return okResult("toggled floating panes", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneFloatingShowTool = defineTool({
  name: "zj_pane_floating_show",
  label: "Zellij: show floating panes",
  description: "Show floating panes (make visible).",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ visible: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_showFloating, {}, getSession()); return okResult("showed floating panes", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneFloatingHideTool = defineTool({
  name: "zj_pane_floating_hide",
  label: "Zellij: hide floating panes",
  description: "Hide floating panes.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ visible: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_hideFloating, {}, getSession()); return okResult("hid floating panes", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneFloatingVisibleTool = defineTool({
  name: "zj_pane_floating_visible",
  label: "Zellij: are floating panes visible",
  description: "Report whether floating panes are currently visible. Read-only.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ visible: Type.Boolean() }),
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_floatingVisible, {}, getSession()); return okResult(`floating visible: ${o.visible}`, o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_toggle_pinned + toggle_frames ----------

const PaneTogglePinnedParams = Type.Object({ paneId: Type.Optional(PaneIdField) });

const paneTogglePinnedTool = defineTool({
  name: "zj_pane_toggle_pinned",
  label: "Zellij: toggle pinned",
  description: "Toggle the 'pinned' state of a pane (pinned panes don't auto-close when the layout changes).",
  parameters: PaneTogglePinnedParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_togglePinned, params, getSession()); return okResult("toggled pinned", o); }
    catch (e) { return errorResult(e); }
  },
});

const paneToggleFramesTool = defineTool({
  name: "zj_pane_toggle_frames",
  label: "Zellij: toggle pane frames",
  description: "Toggle pane frame visibility.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_toggleFrames, {}, getSession()); return okResult("toggled pane frames", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_set_borderless + set_border_style + set_color ----------

const PaneSetBorderlessParams = Type.Object({ paneId: PaneIdField, borderless: Type.Boolean() });
const PaneSetBorderlessOutput = Type.Object({ paneId: Type.String(), borderless: Type.Boolean() });

const paneSetBorderlessTool = defineTool({
  name: "zj_pane_set_borderless",
  label: "Zellij: set pane borderless",
  description: "Set whether a pane has a visible border.",
  parameters: PaneSetBorderlessParams,
  outputSchema: PaneSetBorderlessOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_setBorderless, params, getSession()); return okResult(`pane ${params.borderless ? "borderless" : "bordered"}`, o); }
    catch (e) { return errorResult(e); }
  },
});

const PaneSetBorderStyleParams = Type.Object({ paneId: PaneIdField, style: Type.String() });

const paneSetBorderStyleTool = defineTool({
  name: "zj_pane_set_border_style",
  label: "Zellij: set pane border style",
  description: "Set the visual style of a pane's border (e.g. 'solid', 'dashed').",
  parameters: PaneSetBorderStyleParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_setBorderStyle, params, getSession()); return okResult(`border style set`, o); }
    catch (e) { return errorResult(e); }
  },
});

const PaneSetColorParams = Type.Object({
  paneId: PaneIdField,
  fg: Type.Optional(Type.String({ description: "Foreground color (hex like '#ff8800' or palette name)" })),
  bg: Type.Optional(Type.String({ description: "Background color" })),
});

const paneSetColorTool = defineTool({
  name: "zj_pane_set_color",
  label: "Zellij: set pane color",
  description: "Set the foreground/background color of a pane's border.",
  parameters: PaneSetColorParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_setPaneColor, params, getSession()); return okResult("set pane color", o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_clear ----------

const PaneClearParams = Type.Object({ paneId: Type.Optional(PaneIdField) });

const paneClearTool = defineTool({
  name: "zj_pane_clear",
  label: "Zellij: clear pane",
  description: "Clear a pane's screen (or the focused pane if no id given).",
  parameters: PaneClearParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_clearPane, params, getSession()); return okResult("cleared pane", o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_break ----------

const paneBreakTool = defineTool({
  name: "zj_pane_break",
  label: "Zellij: break pane to new tab",
  description: "Break the focused pane out into a new tab.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_breakPane, {}, getSession()); return okResult("broke pane to new tab", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_edit_scrollback ----------

const PaneEditScrollbackParams = Type.Object({ paneId: Type.Optional(PaneIdField), ansi: Type.Optional(Type.Boolean()) });

const paneEditScrollbackTool = defineTool({
  name: "zj_pane_edit_scrollback",
  label: "Zellij: edit scrollback",
  description: "Open a pane's scrollback in $EDITOR.",
  parameters: PaneEditScrollbackParams,
  outputSchema: PaneIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { const o = await callEnvelope(env_editScrollback, params, getSession()); return okResult("opened scrollback in editor", o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_scroll_at + scroll_to_prompt + select_command_at + copy_last_output ----------

const PaneScrollAtParams = Type.Object({
  position: Type.Integer({ description: "Viewport line position" }),
  direction: StringEnum(["up", "down"] as const),
});

const paneScrollAtTool = defineTool({
  name: "zj_pane_scroll_at",
  label: "Zellij: scroll at position",
  description: "Scroll the focused pane at a specific viewport line position.",
  parameters: PaneScrollAtParams,
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_scrollAt, params, getSession()); return okResult(`scrolled ${params.direction} at ${params.position}`, { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const PaneScrollToPromptParams = Type.Object({ direction: StringEnum(["previous", "next"] as const) });

const paneScrollToPromptTool = defineTool({
  name: "zj_pane_scroll_to_prompt",
  label: "Zellij: scroll to prompt",
  description: "Scroll to the previous or next prompt in the focused pane.",
  parameters: PaneScrollToPromptParams,
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_scrollToPrompt, params, getSession()); return okResult(`scrolled to ${params.direction} prompt`, { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const paneSelectCommandAtTool = defineTool({
  name: "zj_pane_select_command_at",
  label: "Zellij: select command at scroll position",
  description: "Select the command at the current scroll position.",
  parameters: Type.Object({}),
  outputSchema: Type.Object({ ok: Type.Boolean() }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_selectCommandAt, {}, getSession()); return okResult("selected command at scroll", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const PaneCopyLastOutputOutput = Type.Object({ output: Type.String() });

const paneCopyLastOutputTool = defineTool({
  name: "zj_pane_copy_last_output",
  label: "Zellij: copy last command output",
  description: "Copy the output of the most recent command in the focused pane.",
  parameters: Type.Object({}),
  outputSchema: PaneCopyLastOutputOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_copyLastOutput, {}, getSession()); return okResult(`copied ${o.output.length} bytes`, o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_pane_wait_exit ----------

const PaneWaitExitParams = Type.Object({
  paneId: PaneIdField,
  timeoutMs: Type.Optional(Type.Integer({ description: "Default 5 min" })),
  pollMs: Type.Optional(Type.Integer({ description: "Default 250 ms" })),
});

const PaneWaitExitOutput = Type.Object({
  paneId: Type.String(),
  exitStatus: Type.Union([Type.Integer(), Type.Null()]),
  durationMs: Type.Number(),
  timedOut: Type.Boolean(),
});

const paneWaitExitTool = defineTool({
  name: "zj_pane_wait_exit",
  label: "Zellij: wait for pane exit",
  description: "Block until a pane's process exits (or the pane is closed). Read-only observer; polling.",
  parameters: PaneWaitExitParams,
  outputSchema: PaneWaitExitOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...READONLY_GUIDELINES, "Long-running; aborts cleanly on signal."],
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const session = getSession();
    const timeoutMs = params.timeoutMs ?? 5 * 60_000;
    const pollMs = params.pollMs ?? 250;
    const started = Date.now();
    const deadline = started + timeoutMs;
    let lastSeen: PaneInfoT | null = null;
    while (Date.now() < deadline) {
      if (signal?.aborted) break;
      const r = await callEnvelope(env_listPanes, {}, session);
      const panes = r as PaneInfoT[];
      const target = panes.find((p) => String(p.id) === String(params.paneId));
      if (!target) {
        return okResult(
          `pane ${params.paneId} no longer exists`,
          { paneId: String(params.paneId), exitStatus: lastSeen?.exit_status ?? null, durationMs: Date.now() - started, timedOut: false },
        );
      }
      lastSeen = target;
      if (target.exited) {
        return okResult(
          `pane ${params.paneId} exited (status ${target.exit_status})`,
          { paneId: String(params.paneId), exitStatus: target.exit_status, durationMs: Date.now() - started, timedOut: false },
        );
      }
      await new Promise((res) => setTimeout(res, pollMs));
    }
    return okResult(
      `timed out waiting for pane ${params.paneId}`,
      { paneId: String(params.paneId), exitStatus: lastSeen?.exit_status ?? null, durationMs: Date.now() - started, timedOut: true },
    );
  },
});

// ---------- Register ----------

export function registerPaneTools(pi: ExtensionAPI): void {
  pi.registerTool(paneSpawnTool);
  pi.registerTool(paneCloseTool);
  pi.registerTool(paneFocusTool);
  pi.registerTool(paneFocusNextTool);
  pi.registerTool(paneFocusPrevTool);
  pi.registerTool(paneFocusLastTool);
  pi.registerTool(paneRenameTool);
  pi.registerTool(paneResizeTool);
  pi.registerTool(paneMoveFocusTool);
  pi.registerTool(paneMoveFocusOrTabTool);
  pi.registerTool(paneMoveTool);
  pi.registerTool(paneMoveBackwardsTool);
  pi.registerTool(paneToggleFullscreenTool);
  pi.registerTool(paneToggleNoUiFullscreenTool);
  pi.registerTool(paneToggleEmbeddedTool);
  pi.registerTool(paneToggleFloatingTool);
  pi.registerTool(paneFloatingShowTool);
  pi.registerTool(paneFloatingHideTool);
  pi.registerTool(paneFloatingVisibleTool);
  pi.registerTool(paneTogglePinnedTool);
  pi.registerTool(paneToggleFramesTool);
  pi.registerTool(paneSetBorderlessTool);
  pi.registerTool(paneSetBorderStyleTool);
  pi.registerTool(paneSetColorTool);
  pi.registerTool(paneClearTool);
  pi.registerTool(paneBreakTool);
  pi.registerTool(paneEditScrollbackTool);
  pi.registerTool(paneScrollAtTool);
  pi.registerTool(paneScrollToPromptTool);
  pi.registerTool(paneSelectCommandAtTool);
  pi.registerTool(paneCopyLastOutputTool);
  pi.registerTool(paneWaitExitTool);
}

void PaneCloseOutput;
void PaneIdOutput;
void PaneResizeOutput;
void PaneMoveFocusOutput;
void PaneSetBorderlessOutput;
void PaneCopyLastOutputOutput;
void PaneWaitExitOutput;
