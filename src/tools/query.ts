/**
 * src/tools/query.ts — structured-read tools.
 *
 * 7 tools: pane_list, tab_list, tab_current, clients_list,
 * tab_query_names, pane_read_screen, layout_dump.
 *
 * pane_read_screen is the only tool that may produce large output;
 * it uses truncate to cap at 50KB / 2000 lines and spills overflow
 * to a temp file.
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_listPanes,
  env_listTabs,
  env_currentTabInfo,
  env_listClients,
  env_queryTabNames,
  env_dumpScreen,
  env_dumpLayout,
} from "../protocol/envelopes.ts";
import { READONLY_GUIDELINES } from "../prompts.ts";
import { truncate } from "../util/truncate.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";
import type { PaneInfoT, TabInfoT } from "../transport/types.ts";

// ---------- zj_pane_list ----------

const PaneListParams = Type.Object({
  tab: Type.Optional(Type.Boolean()),
  command: Type.Optional(Type.Boolean()),
  state: Type.Optional(Type.Boolean()),
  geometry: Type.Optional(Type.Boolean()),
  all: Type.Optional(Type.Boolean()),
});

const PaneListOutput = Type.Array(Type.Unknown());

const paneListTool = defineTool({
  name: "zj_pane_list",
  label: "Zellij: list panes",
  description: "List all panes in the current tab (or all tabs) as typed PaneInfo objects. Read-only.",
  parameters: PaneListParams,
  outputSchema: PaneListOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...READONLY_GUIDELINES, "Pane ids are unstable across zellij restarts — re-run if you lose track."],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_listPanes, params, getSession());
      const list = out as PaneInfoT[];
      const focused = list.find((p) => p.is_focused);
      const summary = focused
        ? `${list.length} pane(s); focused: pane ${focused.id}`
        : `${list.length} pane(s); no focused pane`;
      return okResult(summary, list);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_tab_list ----------

const TabListParams = Type.Object({
  state: Type.Optional(Type.Boolean()),
  dimensions: Type.Optional(Type.Boolean()),
  panes: Type.Optional(Type.Boolean()),
  layout: Type.Optional(Type.Boolean()),
  all: Type.Optional(Type.Boolean()),
});

const TabListOutput = Type.Array(Type.Unknown());

const tabListTool = defineTool({
  name: "zj_tab_list",
  label: "Zellij: list tabs",
  description: "List all tabs in the current session as typed TabInfo objects. Read-only.",
  parameters: TabListParams,
  outputSchema: TabListOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_listTabs, params, getSession());
      return okResult(`${(out as TabInfoT[]).length} tab(s)`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_tab_current ----------

const TabCurrentOutput = Type.Object({});

const tabCurrentTool = defineTool({
  name: "zj_tab_current",
  label: "Zellij: current tab",
  description: "Get info about the currently focused tab. Read-only.",
  parameters: Type.Object({}),
  outputSchema: TabCurrentOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_currentTabInfo, {}, getSession());
      return okResult(`tab ${(out as TabInfoT).name}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_clients_list ----------

const ClientsListOutput = Type.Array(
  Type.Object({
    clientId: Type.Integer(),
    paneId: Type.String(),
    runningCommand: Type.String(),
  }),
);

const clientsListTool = defineTool({
  name: "zj_clients_list",
  label: "Zellij: list clients",
  description: "List the zellij clients currently connected to the session. Read-only.",
  parameters: Type.Object({}),
  outputSchema: ClientsListOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_listClients, {}, getSession());
      return okResult(`${out.length} client(s) connected`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_tab_query_names ----------

const TabQueryNamesOutput = Type.Array(Type.String());

const tabQueryNamesTool = defineTool({
  name: "zj_tab_query_names",
  label: "Zellij: tab names",
  description: "Get just the tab names in the session, as a string array. Read-only.",
  parameters: Type.Object({}),
  outputSchema: TabQueryNamesOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_queryTabNames, {}, getSession());
      return okResult(`tabs: ${out.join(", ") || "(none)"}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_read_screen ----------

const PaneReadScreenParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Pane id (number from list-panes, or 'terminal_N' from subscribe)" }),
  full: Type.Optional(Type.Boolean({ description: "Include full scrollback" })),
  ansi: Type.Optional(Type.Boolean({ description: "Preserve ANSI escape codes" })),
  maxBytes: Type.Optional(Type.Integer({ description: "Override the 50KB model-output cap" })),
});

const PaneReadScreenOutput = Type.Object({
  text: Type.String(),
  truncated: Type.Boolean(),
  spillPath: Type.Optional(Type.String()),
  originalBytes: Type.Integer(),
});

const paneReadScreenTool = defineTool({
  name: "zj_pane_read_screen",
  label: "Zellij: read pane screen",
  description: "Dump a pane's current screen contents (or full scrollback). Read-only. Long output is truncated to ~50KB and spilled to a temp file; the message includes the path to the full text.",
  parameters: PaneReadScreenParams,
  outputSchema: PaneReadScreenOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [
    ...READONLY_GUIDELINES,
    "Long output is truncated. For streaming, use zj_pane_subscribe instead.",
    "For very long scrollback, prefer zj_pane_collect_lines with a regex.",
  ],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const raw = await callEnvelope(env_dumpScreen, params, getSession());
      const tr = truncate(raw, { ...(params.maxBytes !== undefined ? { maxBytes: params.maxBytes } : {}) });
      const out: { text: string; truncated: boolean; spillPath?: string; originalBytes: number } = {
        text: tr.text,
        truncated: tr.truncated,
        originalBytes: Buffer.byteLength(raw, "utf-8"),
      };
      if (tr.spilled) out.spillPath = tr.spilled.path;
      return okResult(
        tr.truncated
          ? `read pane ${params.paneId} (truncated; full at ${tr.spilled?.path})`
          : `read pane ${params.paneId}`,
        out,
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
  label: "Zellij: dump layout",
  description: "Dump the current layout of the active tab as a KDL string. Read-only.",
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

// ---------- Register ----------

export function registerQueryTools(pi: ExtensionAPI): void {
  pi.registerTool(paneListTool);
  pi.registerTool(tabListTool);
  pi.registerTool(tabCurrentTool);
  pi.registerTool(clientsListTool);
  pi.registerTool(tabQueryNamesTool);
  pi.registerTool(paneReadScreenTool);
  pi.registerTool(layoutDumpTool);
}
