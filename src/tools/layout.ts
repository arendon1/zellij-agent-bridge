/**
 * src/tools/layout.ts — layout tools.
 *
 * 6 tools: apply, dump, apply_swap_tiled, apply_swap_floating,
 * swap_next, swap_prev.
 *
 * `zj_layout_apply` is the headline multitask enabler — it can
 * spawn N panes atomically via a KDL layout string, faster than
 * N sequential `zj_pane_spawn` calls.
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_applyLayout,
  env_dumpLayout,
  env_applyTiledSwap,
  env_applyFloatingSwap,
  env_nextSwapLayout,
  env_prevSwapLayout,
} from "../protocol/envelopes.ts";
import { runZellij } from "../transport/cli.ts";
import { COMMON_GUIDELINES, READONLY_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";
import type { PaneInfoT } from "../transport/types.ts";

// ---------- zj_layout_apply ----------

const LayoutApplyParams = Type.Object({
  kdl: Type.Optional(Type.String({ description: "KDL layout string (preferred for dynamic layouts)" })),
  path: Type.Optional(Type.String({ description: "Path to a .kdl layout file" })),
  retainTerminalPanes: Type.Optional(Type.Boolean()),
  retainPluginPanes: Type.Optional(Type.Boolean()),
  activeTabOnly: Type.Optional(Type.Boolean()),
});

const LayoutApplyOutput = Type.Object({
  panes: Type.Array(Type.Union([Type.Integer(), Type.String()])),
  applied: Type.Boolean(),
});

const layoutApplyTool = defineTool({
  name: "zj_layout_apply",
  label: "Zellij: apply layout",
  description: "Apply a KDL layout to the current tab, atomically spawning all named panes. The preferred way to spawn N panes at once — much faster than N sequential zj_pane_spawn calls. Returns the list of pane ids created.",
  parameters: LayoutApplyParams,
  outputSchema: LayoutApplyOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [
    ...COMMON_GUIDELINES,
    "This is the atomic N-pane spawner. Prefer it over N sequential zj_pane_spawn calls when you know the layout up front.",
    "After the apply, zj_pane_list will reflect the new panes; this tool returns their ids directly.",
  ],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const session = getSession();
      // Snapshot before, apply, then diff to find new pane ids.
      const before = await runZellij(
        session ? ["--session", session, "action", "list-panes", "--json"] : ["action", "list-panes", "--json"],
        { expectJson: true },
      );
      const beforeIds = new Set<number>(
        Array.isArray(before.parsed) ? (before.parsed as PaneInfoT[]).map((p) => p.id) : [],
      );
      await callEnvelope(env_applyLayout, params, session);
      const after = await runZellij(
        session ? ["--session", session, "action", "list-panes", "--json"] : ["action", "list-panes", "--json"],
        { expectJson: true },
      );
      const allPanes = Array.isArray(after.parsed) ? (after.parsed as PaneInfoT[]) : [];
      const newPanes = allPanes.filter((p) => !beforeIds.has(p.id)).map((p) => p.id);
      return okResult(
        `applied layout: ${newPanes.length} new pane(s)`,
        { panes: newPanes, applied: true },
      );
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_layout_dump ----------

const LayoutDumpOutput = Type.String();

const layoutDumpTool = defineTool({
  name: "zj_layout_dump",
  label: "Zellij: dump layout (alias)",
  description: "Dump the current layout of the active tab as a KDL string. Read-only. (Alias for zj_query's zj_layout_dump.)",
  parameters: Type.Object({}),
  outputSchema: LayoutDumpOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_dumpLayout, {}, getSession());
      return okResult(`layout: ${out.length} bytes of KDL`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_layout_apply_swap_tiled ----------

const ApplySwapTiledParams = Type.Object({
  name: Type.String({ description: "Name of the saved swap layout" }),
});

const ApplySwapTiledOutput = Type.Object({ applied: Type.String() });

const layoutApplySwapTiledTool = defineTool({
  name: "zj_layout_apply_swap_tiled",
  label: "Zellij: apply tiled swap layout",
  description: "Apply a saved tiled swap layout to the current tab by name.",
  parameters: ApplySwapTiledParams,
  outputSchema: ApplySwapTiledOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_applyTiledSwap, params, getSession());
      return okResult(`applied tiled swap: ${out.applied}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_layout_apply_swap_floating ----------

const ApplySwapFloatingParams = Type.Object({
  name: Type.String({ description: "Name of the saved swap layout" }),
});

const ApplySwapFloatingOutput = Type.Object({ applied: Type.String() });

const layoutApplySwapFloatingTool = defineTool({
  name: "zj_layout_apply_swap_floating",
  label: "Zellij: apply floating swap layout",
  description: "Apply a saved floating swap layout to the current tab by name.",
  parameters: ApplySwapFloatingParams,
  outputSchema: ApplySwapFloatingOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_applyFloatingSwap, params, getSession());
      return okResult(`applied floating swap: ${out.applied}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_layout_swap_next ----------

const SwapNextOutput = Type.Object({ ok: Type.Boolean() });

const layoutSwapNextTool = defineTool({
  name: "zj_layout_swap_next",
  label: "Zellij: next swap layout",
  description: "Cycle to the next saved swap layout.",
  parameters: Type.Object({}),
  outputSchema: SwapNextOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_nextSwapLayout, {}, getSession());
      return okResult("cycled to next swap layout", out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_layout_swap_prev ----------

const SwapPrevOutput = Type.Object({ ok: Type.Boolean() });

const layoutSwapPrevTool = defineTool({
  name: "zj_layout_swap_prev",
  label: "Zellij: previous swap layout",
  description: "Cycle to the previous saved swap layout.",
  parameters: Type.Object({}),
  outputSchema: SwapPrevOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_prevSwapLayout, {}, getSession());
      return okResult("cycled to previous swap layout", out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- Register ----------

export function registerLayoutTools(pi: ExtensionAPI): void {
  pi.registerTool(layoutApplyTool);
  pi.registerTool(layoutDumpTool);
  pi.registerTool(layoutApplySwapTiledTool);
  pi.registerTool(layoutApplySwapFloatingTool);
  pi.registerTool(layoutSwapNextTool);
  pi.registerTool(layoutSwapPrevTool);
}
