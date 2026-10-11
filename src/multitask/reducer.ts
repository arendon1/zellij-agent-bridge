/**
 * src/multitask/reducer.ts — pattern-matching tools.
 *
 * 4 tools: zj_pane_wait_for, zj_pane_collect_lines, zj_farm_reduce,
 * zj_pane_pipe.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runZellijStreaming } from "../transport/cli.ts";
import {
  callEnvelope,
  env_dumpScreen,
  env_writeChars,
} from "../protocol/envelopes.ts";
import { WorkerHandle } from "./worker.ts";
import type { SubscribeEventT } from "../transport/types.ts";
import { COMMON_GUIDELINES, READONLY_GUIDELINES, STREAMING_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "../tools/_helpers.ts";

const HandleParam = Type.Object({
  session: Type.Optional(Type.String()),
  paneId: Type.Union([Type.String(), Type.Integer()]),
  command: Type.String(),
  spawnedAt: Type.Number(),
});

// ---------- zj_pane_wait_for ----------

const PaneWaitForParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()]),
  regex: Type.String({ description: "Regex source to wait for in viewport lines" }),
  timeoutMs: Type.Optional(Type.Integer({ description: "Default 5 min" })),
  includeScrollback: Type.Optional(Type.Boolean()),
});

const PaneWaitForOutput = Type.Object({
  matched: Type.Boolean(),
  line: Type.Optional(Type.String()),
  lineNo: Type.Optional(Type.Integer()),
  context: Type.Optional(Type.Array(Type.String())),
  lastViewport: Type.Array(Type.String()),
});

const paneWaitForTool = defineTool({
  name: "zj_pane_wait_for",
  label: "Zellij: wait for regex",
  description: "Block until a regex matches a line in a pane's viewport (or scrollback).",
  parameters: PaneWaitForParams,
  outputSchema: PaneWaitForOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  executionMode: "sequential",
  promptGuidelines: [...READONLY_GUIDELINES, ...STREAMING_GUIDELINES, "Long-running. Honors cancellation."],
  async execute(_id, params, signal, _onUpdate, _ctx) {
    const session = getSession();
    const timeoutMs = params.timeoutMs ?? 5 * 60_000;
    const deadline = Date.now() + timeoutMs;
    const regex = new RegExp(params.regex);
    const includeScrollback = params.includeScrollback ?? false;

    const args: string[] = [];
    if (session) args.push("--session", session);
    args.push("subscribe", "--format", "json", "--pane-id", String(params.paneId));
    if (includeScrollback) args.push("--scrollback");

    let matched = false;
    let line: string | undefined;
    let lineNo: number | undefined;
    let context: string[] | undefined;
    let lastViewport: string[] = [];

    try {
      for await (const raw of runZellijStreaming(args, {}, signal)) {
        const ev = raw as SubscribeEventT;
        if (ev.event !== "pane_update") continue;
        if (ev.viewport) lastViewport = ev.viewport;
        if (matched) break;
        if (ev.viewport) {
          for (let i = 0; i < ev.viewport.length; i++) {
            if (regex.test(ev.viewport[i]!)) {
              matched = true;
              line = ev.viewport[i];
              lineNo = i;
              context = ev.viewport.slice(Math.max(0, i - 2), i + 3);
              break;
            }
          }
        }
        if (!matched && includeScrollback && ev.scrollback) {
          for (let i = 0; i < ev.scrollback.length; i++) {
            if (regex.test(ev.scrollback[i]!)) {
              matched = true;
              line = ev.scrollback[i]!;
              lineNo = i;
              context = ev.scrollback.slice(Math.max(0, i - 2), i + 3);
              break;
            }
          }
        }
        if (Date.now() > deadline) break;
      }
    } catch {
      // abort
    }
    const out: { matched: boolean; line?: string; lineNo?: number; context?: string[]; lastViewport: string[] } = {
      matched,
      lastViewport,
    };
    if (line !== undefined) out.line = line;
    if (lineNo !== undefined) out.lineNo = lineNo;
    if (context !== undefined) out.context = context;
    return okResult(
      matched ? `matched: ${line}` : `no match in ${timeoutMs} ms`,
      out,
    );
  },
});

// ---------- zj_pane_collect_lines ----------

const PaneCollectLinesParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()]),
  regex: Type.String(),
  source: StringEnum(["viewport", "scrollback"] as const),
  max: Type.Optional(Type.Integer()),
});

const PaneCollectLinesOutput = Type.Object({
  matches: Type.Array(Type.Object({
    line: Type.String(),
    lineNo: Type.Integer(),
  })),
});

const paneCollectLinesTool = defineTool({
  name: "zj_pane_collect_lines",
  label: "Zellij: collect lines",
  description: "Scan a pane's viewport or scrollback for lines matching a regex.",
  parameters: PaneCollectLinesParams,
  outputSchema: PaneCollectLinesOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const full = params.source === "scrollback";
      const raw = await callEnvelope(env_dumpScreen, { paneId: params.paneId, full }, getSession());
      const lines = raw.split("\n");
      const regex = new RegExp(params.regex);
      const matches: { line: string; lineNo: number }[] = [];
      const max = params.max ?? 1000;
      for (let i = 0; i < lines.length && matches.length < max; i++) {
        if (regex.test(lines[i]!)) {
          matches.push({ line: lines[i]!, lineNo: i });
        }
      }
      return okResult(`${matches.length} match(es)`, { matches });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_farm_reduce ----------

const FarmReduceParams = Type.Object({
  handles: Type.Array(HandleParam),
  regex: Type.String(),
  mode: StringEnum(["max", "sum", "all"] as const),
});

const FarmReduceOutput = Type.Object({
  max: Type.Optional(Type.Object({
    paneId: Type.Union([Type.String(), Type.Integer()]),
    screen: Type.String(),
    matches: Type.Array(Type.Object({ line: Type.String(), lineNo: Type.Integer() })),
  })),
  sum: Type.Optional(Type.Array(Type.Object({
    line: Type.String(),
    lineNo: Type.Integer(),
    paneId: Type.Union([Type.String(), Type.Integer()]),
  }))),
  all: Type.Optional(Type.Array(Type.Object({
    paneId: Type.Union([Type.String(), Type.Integer()]),
    count: Type.Integer(),
  }))),
});

const farmReduceTool = defineTool({
  name: "zj_farm_reduce",
  label: "Zellij: reduce farm",
  description: "Apply a regex across all worker screens and reduce: 'max' = the handle with the most matches; 'sum' = all matches concatenated; 'all' = per-handle match counts.",
  parameters: FarmReduceParams,
  outputSchema: FarmReduceOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: READONLY_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const handles = params.handles.map((h) => WorkerHandle.fromJSON({ session: h.session ?? "", paneId: h.paneId, command: h.command, spawnedAt: h.spawnedAt }));
      const regex = new RegExp(params.regex);
      const perHandle: { paneId: string | number; screen: string; matches: { line: string; lineNo: number }[] }[] = await Promise.all(
        handles.map(async (h) => {
          const screen = await h.read({});
          const lines = screen.split("\n");
          const matches: { line: string; lineNo: number }[] = [];
          for (let i = 0; i < lines.length; i++) {
            if (regex.test(lines[i]!)) matches.push({ line: lines[i]!, lineNo: i });
          }
          return { paneId: h.paneId, screen, matches };
        }),
      );
      const out: { max?: { paneId: string | number; screen: string; matches: { line: string; lineNo: number }[] }; sum?: { line: string; lineNo: number; paneId: string | number }[]; all?: { paneId: string | number; count: number }[] } = {};
      if (params.mode === "max") {
        const best = perHandle.reduce<typeof perHandle[number] | undefined>((best, cur) => (cur.matches.length > (best?.matches.length ?? -1) ? cur : best), undefined);
        if (best) out.max = best;
      } else if (params.mode === "sum") {
        out.sum = perHandle.flatMap((h) => h.matches.map((m) => ({ ...m, paneId: h.paneId })));
      } else {
        out.all = perHandle.map((h) => ({ paneId: h.paneId, count: h.matches.length }));
      }
      return okResult(`reduced (${params.mode})`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_pipe ----------

const PanePipeParams = Type.Object({
  fromPaneId: Type.Union([Type.String(), Type.Integer()], { description: "Source pane (read its screen)" }),
  toPaneId: Type.Union([Type.String(), Type.Integer()], { description: "Destination pane (write chars into)" }),
  maxBytes: Type.Optional(Type.Integer()),
});

const PanePipeOutput = Type.Object({
  fromPane: Type.Union([Type.String(), Type.Integer()]),
  toPane: Type.Union([Type.String(), Type.Integer()]),
  bytes: Type.Integer(),
});

const panePipeTool = defineTool({
  name: "zj_pane_pipe",
  label: "Zellij: pipe pane",
  description: "Read a source pane's screen and write it as chars into a destination pane. Useful for cross-pane data flow.",
  parameters: PanePipeParams,
  outputSchema: PanePipeOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _s, _u, _c) {
    try {
      const session = getSession();
      const sourceText = await callEnvelope(env_dumpScreen, { paneId: params.fromPaneId, full: false }, session);
      const truncated = params.maxBytes !== undefined && sourceText.length > params.maxBytes
        ? sourceText.slice(0, params.maxBytes)
        : sourceText;
      await callEnvelope(env_writeChars, { paneId: params.toPaneId, chars: truncated }, session);
      return okResult(`piped ${truncated.length} chars`, {
        fromPane: params.fromPaneId,
        toPane: params.toPaneId,
        bytes: truncated.length,
      });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- Register ----------

export function registerReducerTools(pi: ExtensionAPI): void {
  pi.registerTool(paneWaitForTool);
  pi.registerTool(paneCollectLinesTool);
  pi.registerTool(farmReduceTool);
  pi.registerTool(panePipeTool);
}
