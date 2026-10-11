/**
 * src/tools/tab.ts — tab mutation tools.
 *
 * 14 tools. Mirrors the pane.ts pattern.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_newTab,
  env_closeTab,
  env_gotoTab,
  env_gotoNextTab,
  env_gotoPrevTab,
  env_renameTab,
  env_moveTab,
  env_moveTabTo,
  env_undoRenameTab,
  env_toggleTab,
} from "../protocol/envelopes.ts";
import { COMMON_GUIDELINES, DESTRUCTIVE_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";

const TabIdField = Type.Union([Type.String(), Type.Integer()]);
const TabIdParam = { tabId: Type.Optional(TabIdField) };
const TabIdOutput = Type.Object({ tabId: TabIdField });
const OkOutput = Type.Object({ ok: Type.Boolean() });
const Direction = StringEnum(["left", "right"] as const);

// ---------- zj_tab_new ----------

const TabNewParams = Type.Object({
  name: Type.Optional(Type.String()),
  cwd: Type.Optional(Type.String()),
});
const TabNewOutput = Type.Object({
  tabId: TabIdField,
  name: Type.Optional(Type.String()),
});

const tabNewTool = defineTool({
  name: "zj_tab_new",
  label: "Zellij: new tab",
  description: "Create a new tab. Optionally set its name and initial cwd.",
  parameters: TabNewParams,
  outputSchema: TabNewOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const o = await callEnvelope(env_newTab, params, getSession());
      const out: { tabId: string | number; name?: string } = { tabId: o.tabId };
      if (o.name !== undefined) out.name = o.name;
      return okResult(`created tab '${o.name ?? o.tabId}'`, out);
    } catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_close ----------

const TabCloseParams = Type.Object(TabIdParam);
const TabCloseOutput = Type.Object({ closed: TabIdField });

const tabCloseTool = defineTool({
  name: "zj_tab_close",
  label: "Zellij: close tab",
  description: "Close a tab (or the current one if no id). DESTRUCTIVE.",
  parameters: TabCloseParams,
  outputSchema: TabCloseOutput,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, ...DESTRUCTIVE_GUIDELINES],
  async execute(_id, params, _s, _u, _c) {
    try {
      const o = await callEnvelope(env_closeTab, params, getSession());
      return okResult(`closed tab ${params.tabId ?? "(current)"}`, o);
    } catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_goto ----------

const TabGotoParams = Type.Object({
  index: Type.Optional(Type.Integer({ description: "Tab index (0-based)" })),
  tabId: Type.Optional(TabIdField),
  name: Type.Optional(Type.String({ description: "Tab name" })),
  create: Type.Optional(Type.Boolean({ description: "If name doesn't match, create it" })),
});
const TabGotoOutput = Type.Object({
  tabId: TabIdField,
  created: Type.Optional(Type.Boolean()),
});

const tabGotoTool = defineTool({
  name: "zj_tab_goto",
  label: "Zellij: go to tab",
  description: "Switch to a tab by index, id, or name. If name and create=true, creates the tab when missing.",
  parameters: TabGotoParams,
  outputSchema: TabGotoOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const o = await callEnvelope(env_gotoTab, params, getSession());
      const out: { tabId: string | number; created?: boolean } = { tabId: o.tabId };
      if (o.created !== undefined) out.created = o.created;
      return okResult(`switched to tab ${params.index ?? params.tabId ?? params.name}`, out);
    } catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_next / prev ----------

const tabNextTool = defineTool({
  name: "zj_tab_next",
  label: "Zellij: next tab",
  description: "Switch to the next tab.",
  parameters: Type.Object({}),
  outputSchema: TabIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_gotoNextTab, {}, getSession()); return okResult("next tab", o); }
    catch (e) { return errorResult(e); }
  },
});

const tabPrevTool = defineTool({
  name: "zj_tab_prev",
  label: "Zellij: previous tab",
  description: "Switch to the previous tab.",
  parameters: Type.Object({}),
  outputSchema: TabIdOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { const o = await callEnvelope(env_gotoPrevTab, {}, getSession()); return okResult("previous tab", o); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_rename ----------

const TabRenameParams = Type.Object({
  ...TabIdParam,
  name: Type.String(),
});
const TabRenameOutput = Type.Object({ tabId: TabIdField, name: Type.String() });

const tabRenameTool = defineTool({
  name: "zj_tab_rename",
  label: "Zellij: rename tab",
  description: "Rename a tab (by id) or the current tab (omit id).",
  parameters: TabRenameParams,
  outputSchema: TabRenameOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const o = await callEnvelope(env_renameTab, params, getSession());
      return okResult(`renamed tab to '${params.name}'`, o);
    } catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_move + move_to ----------

const TabMoveParams = Type.Object({ direction: Direction });

const tabMoveTool = defineTool({
  name: "zj_tab_move",
  label: "Zellij: move tab",
  description: "Move the current tab left or right in the tab order.",
  parameters: TabMoveParams,
  outputSchema: OkOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_moveTab, params, getSession()); return okResult(`moved tab ${params.direction}`, { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const TabMoveToParams = Type.Object({ position: Type.Integer({ description: "0-based target position" }) });

const tabMoveToTool = defineTool({
  name: "zj_tab_move_to",
  label: "Zellij: move tab to position",
  description: "Move the current tab to a specific 0-based position.",
  parameters: TabMoveToParams,
  outputSchema: OkOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try { await callEnvelope(env_moveTabTo, params, getSession()); return okResult(`moved tab to position ${params.position}`, { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- zj_tab_undo_rename + toggle ----------

const tabUndoRenameTool = defineTool({
  name: "zj_tab_undo_rename",
  label: "Zellij: undo tab rename",
  description: "Undo the most recent tab rename.",
  parameters: Type.Object({}),
  outputSchema: OkOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_undoRenameTab, {}, getSession()); return okResult("undid tab rename", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

const tabToggleTool = defineTool({
  name: "zj_tab_toggle",
  label: "Zellij: toggle tab",
  description: "Toggle the current tab (hide/show).",
  parameters: Type.Object({}),
  outputSchema: OkOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _p, _s, _u, _c) {
    try { await callEnvelope(env_toggleTab, {}, getSession()); return okResult("toggled tab", { ok: true }); }
    catch (e) { return errorResult(e); }
  },
});

// ---------- Register ----------

export function registerTabTools(pi: ExtensionAPI): void {
  pi.registerTool(tabNewTool);
  pi.registerTool(tabCloseTool);
  pi.registerTool(tabGotoTool);
  pi.registerTool(tabNextTool);
  pi.registerTool(tabPrevTool);
  pi.registerTool(tabRenameTool);
  pi.registerTool(tabMoveTool);
  pi.registerTool(tabMoveToTool);
  pi.registerTool(tabUndoRenameTool);
  pi.registerTool(tabToggleTool);
}

void TabCloseOutput;
void TabGotoOutput;
void TabRenameOutput;
