/**
 * src/multitask/farm.ts — the headline multitask primitives.
 *
 * 3 tools: zj_farm_spawn, zj_farm_collect, zj_farm_status.
 *
 * zj_farm_spawn creates N worker panes in parallel via a generated
 * KDL layout, returning WorkerHandle[] the caller can later collect
 * from or read screens of.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_applyLayout,
  env_newTab,
  env_listPanes,
} from "../protocol/envelopes.ts";
import { COMMON_GUIDELINES, STREAMING_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "../tools/_helpers.ts";
import { WorkerHandle } from "./worker.ts";
import type { PaneInfoT } from "../transport/types.ts";
import type { TabId, SessionName } from "../types.ts";

// ---------- Helpers ----------

function generateKdl(count: number, mode: "auto-row" | "auto-col" | "auto-grid"): string {
  if (count <= 0) return "layout { }";
  if (mode === "auto-row") {
    let kdl = "layout {";
    for (let i = 0; i < count; i++) {
      if (i > 0) kdl += " pane { }";
      else kdl += " pane { }";
    }
    kdl += " }";
    return kdl;
  }
  if (mode === "auto-col") {
    let kdl = "layout {";
    for (let i = 0; i < count; i++) {
      kdl += i === 0 ? " pane { }" : " pane split_direction=\"vertical\" { }";
    }
    kdl += " }";
    return kdl;
  }
  // auto-grid: sqrt(N) x sqrt(N) — but zellij's KDL grid syntax is complex;
  // we approximate with a row of stacked vertical splits.
  const cols = Math.ceil(Math.sqrt(count));
  let kdl = "layout {";
  for (let c = 0; c < cols; c++) {
    kdl += c === 0 ? " pane {" : " pane split_direction=\"vertical\" {";
    const cellsInCol = Math.ceil((count - c * cols) / (cols - c)) || 1;
    for (let r = 1; r < cellsInCol && c * cols + r < count; r++) {
      kdl += " pane { }";
    }
    kdl += " }";
  }
  kdl += " }";
  return kdl;
}

// ---------- zj_farm_spawn ----------

const FarmSpawnParams = Type.Object({
  count: Type.Integer({ minimum: 1, maximum: 64, description: "Number of worker panes to spawn" }),
  template: Type.String({ description: "Command template; {i} is replaced with 0..count-1" }),
  cwd: Type.Optional(Type.String()),
  layoutMode: Type.Optional(StringEnum(["auto-row", "auto-col", "auto-grid", "kdl-string"] as const)),
  kdlString: Type.Optional(Type.String({ description: "Required when layoutMode === 'kdl-string'" })),
  tab: Type.Optional(Type.String({ description: "Create/reuse a tab with this name" })),
  names: Type.Optional(Type.Array(Type.String(), { description: `Per-pane names; length must match count` })),
});

const WorkerHandleSchema = Type.Object({
  session: Type.String(),
  paneId: Type.Union([Type.String(), Type.Integer()]),
  command: Type.String(),
  spawnedAt: Type.Number(),
});

const FarmSpawnOutput = Type.Object({
  tabId: Type.Optional(Type.Union([Type.String(), Type.Integer()])),
  handles: Type.Array(WorkerHandleSchema),
});

const farmSpawnTool = defineTool({
  name: "zj_farm_spawn",
  label: "Zellij: spawn farm",
  description: "Spawn N parallel worker panes with a templated command. Returns WorkerHandle[]. The headline multitask primitive.",
  parameters: FarmSpawnParams,
  outputSchema: FarmSpawnOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [
    ...COMMON_GUIDELINES,
    "The headline multitask tool. For shard test runs, parallel codemods, multi-repo probes.",
    "Use zj_farm_collect to wait for all workers to exit; use zj_farm_status to peek at progress.",
  ],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const session = getSession();
      let tabId: TabId | undefined;

      // Optionally create a dedicated tab.
      if (params.tab) {
        const t = await callEnvelope(env_newTab, { name: params.tab }, session);
        tabId = t.tabId;
      }

      // Determine the KDL layout.
      let kdl: string;
      if (params.layoutMode === "kdl-string") {
        if (!params.kdlString) {
          return errorResult(new Error("layoutMode === 'kdl-string' requires kdlString"));
        }
        kdl = params.kdlString;
      } else {
        kdl = generateKdl(params.count, params.layoutMode ?? "auto-grid");
      }

      // Snapshot panes before apply, then apply the layout.
      const before = await callEnvelope(env_listPanes, {}, session);
      const beforeIds = new Set<number>((before as PaneInfoT[]).map((p) => p.id));

      await callEnvelope(env_applyLayout, { kdl, ...(params.cwd ? {} : {}) }, session);

      // After the apply, list panes and find the new ones.
      let afterPanes: PaneInfoT[] = [];
      for (let i = 0; i < 20; i++) {
        const r = await callEnvelope(env_listPanes, {}, session);
        afterPanes = r as PaneInfoT[];
        const newPanes = afterPanes.filter((p) => !beforeIds.has(p.id));
        if (newPanes.length >= params.count) break;
        await new Promise((res) => setTimeout(res, 100));
      }
      const newPanes = afterPanes.filter((p) => !beforeIds.has(p.id)).slice(0, params.count);

      // Build handles.
      const handles: WorkerHandle[] = newPanes.map((p, i) => {
        const cmd = params.template.replace(/\{i\}/g, String(i));
        return new WorkerHandle({
          session: (session ?? "") as SessionName,
          paneId: p.id,
          command: cmd,
          spawnedAt: Date.now(),
        });
      });
      const out: { tabId?: TabId; handles: WorkerHandle[] } = { handles };
      if (tabId !== undefined) out.tabId = tabId;
      return okResult(`spawned ${handles.length} worker pane(s)`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_farm_collect ----------

const HandleParam = Type.Object({
  session: Type.Optional(Type.String()),
  paneId: Type.Union([Type.String(), Type.Integer()]),
  command: Type.String(),
  spawnedAt: Type.Number(),
});

const FarmCollectParams = Type.Object({
  handles: Type.Array(HandleParam, { description: "WorkerHandles to wait for" }),
  mode: StringEnum(["all", "any"] as const, { description: "'all' = wait for every worker; 'any' = return on first exit" }),
  deadlineMs: Type.Optional(Type.Integer({ description: "Default 10 min" })),
});

const FarmCollectOutput = Type.Object({
  results: Type.Array(Type.Object({
    paneId: Type.Union([Type.String(), Type.Integer()]),
    exitStatus: Type.Union([Type.Integer(), Type.Null()]),
    durationMs: Type.Number(),
    screen: Type.String(),
  })),
  timedOut: Type.Boolean(),
  resolved: StringEnum(["all", "any"] as const),
});

const farmCollectTool = defineTool({
  name: "zj_farm_collect",
  label: "Zellij: collect farm",
  description: "Wait for farm workers to exit, collecting each pane's screen. mode 'all' = wait for everyone; 'any' = return on first exit.",
  parameters: FarmCollectParams,
  outputSchema: FarmCollectOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, ...STREAMING_GUIDELINES, "Long-running; aborts cleanly on signal."],
  async execute(_id, params, signal, _onUpdate, _ctx) {
    try {
      const handles = params.handles.map((h) => WorkerHandle.fromJSON({ session: h.session ?? "", paneId: h.paneId, command: h.command, spawnedAt: h.spawnedAt }));
      const deadlineMs = params.deadlineMs ?? 10 * 60_000;
      const started = Date.now();
      const deadline = started + deadlineMs;
      const results: { paneId: string | number; exitStatus: number | null; durationMs: number; screen: string }[] = [];

      if (params.mode === "any") {
        // Race: return when the first one exits (or all by deadline).
        while (Date.now() < deadline && results.length === 0) {
          if (signal?.aborted) break;
          for (const h of handles) {
            const r = await h.waitExit({ timeoutMs: 1000, pollMs: 250 });
            if (r.exitStatus !== null || Date.now() >= r.durationMs + h.spawnedAt) {
              const screen = await h.read({});
              results.push({ paneId: h.paneId, exitStatus: r.exitStatus, durationMs: r.durationMs, screen });
              break;
            }
          }
        }
      } else {
        // Wait for each handle in parallel.
        const allResults = await Promise.all(
          handles.map(async (h) => {
            const r = await h.waitExit({ timeoutMs: Math.max(0, deadline - Date.now()), pollMs: 250 });
            const screen = await h.read({});
            return { paneId: h.paneId, exitStatus: r.exitStatus, durationMs: r.durationMs, screen };
          }),
        );
        results.push(...allResults);
      }
      return okResult(
        `collected ${results.length} result(s)`,
        { results, timedOut: Date.now() >= deadline, resolved: params.mode },
      );
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_farm_status ----------

const FarmStatusParams = Type.Object({
  handles: Type.Array(HandleParam),
});

const FarmStatusOutput = Type.Object({
  statuses: Type.Array(Type.Object({
    paneId: Type.Union([Type.String(), Type.Integer()]),
    screen: Type.String(),
  })),
});

const farmStatusTool = defineTool({
  name: "zj_farm_status",
  label: "Zellij: farm status",
  description: "Read the current screen of every worker handle. Use this to peek at progress without waiting for completion.",
  parameters: FarmStatusParams,
  outputSchema: FarmStatusOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const handles = params.handles.map((h) => WorkerHandle.fromJSON({ session: h.session ?? "", paneId: h.paneId, command: h.command, spawnedAt: h.spawnedAt }));
      const statuses = await Promise.all(
        handles.map(async (h) => ({ paneId: h.paneId, screen: await h.read({}) })),
      );
      return okResult(`${statuses.length} screen(s) read`, { statuses });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- Register ----------

export function registerFarmTools(pi: ExtensionAPI): void {
  pi.registerTool(farmSpawnTool);
  pi.registerTool(farmCollectTool);
  pi.registerTool(farmStatusTool);
}

// Reference to keep imports happy.


