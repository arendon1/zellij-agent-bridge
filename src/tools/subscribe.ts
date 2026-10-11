/**
 * src/tools/subscribe.ts — long-running pane render stream.
 *
 * One tool: zj_pane_subscribe.
 *
 * Three modes:
 *   • "until-prompt"   — stream until a shell prompt pattern is detected
 *   • "for-duration"   — stream for a fixed duration
 *   • "until-match"    — stream until a regex matches a viewport line
 *
 * Uses runZellijStreaming under the hood; calls onUpdate(partialResult)
 * for each event so the model's TUI shows the live transcript.
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { runZellijStreaming } from "../transport/cli.ts";
import type { SubscribeEventT } from "../transport/types.ts";
import { COMMON_GUIDELINES, STREAMING_GUIDELINES } from "../prompts.ts";
import { getSession } from "./_helpers.ts";

// ---------- Params + output ----------

const SubscribeParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Pane id to subscribe to" }),
  mode: StringEnum(["until-prompt", "for-duration", "until-match"] as const, { description: "Stop condition for the stream" }),
  regex: Type.Optional(Type.String({ description: "Regex source for 'until-match' mode" })),
  matchIncludeScrollback: Type.Optional(Type.Boolean({ description: "Also search scrollback lines" })),
  durationMs: Type.Optional(Type.Integer({ description: "For 'for-duration' mode; default 5000 ms" })),
  scrollback: Type.Optional(Type.Union([Type.Integer(), Type.Boolean()], { description: "Include scrollback in the stream" })),
  ansi: Type.Optional(Type.Boolean()),
  maxEvents: Type.Optional(Type.Integer({ description: "Safety cap; default 1000" })),
});

const SubscribeOutput = Type.Object({
  matched: Type.Optional(Type.Boolean()),
  matchedLine: Type.Optional(Type.String()),
  matchedLineNo: Type.Optional(Type.Integer()),
  context: Type.Optional(Type.Array(Type.String())),
  events: Type.Array(Type.Object({
    event: Type.String(),
    pane_id: Type.String(),
    is_initial: Type.Optional(Type.Boolean()),
    viewport: Type.Optional(Type.Array(Type.String())),
    scrollback: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
  })),
  truncated: Type.Boolean(),
  durationMs: Type.Number(),
  lastViewport: Type.Array(Type.String()),
});

// StringEnum helper since the other categories import it from @earendil-works/pi-ai
import { StringEnum } from "@earendil-works/pi-ai";

// ---------- Tool ----------

const subscribeTool = defineTool({
  name: "zj_pane_subscribe",
  label: "Zellij: subscribe to pane",
  description: "Stream viewport updates from a pane until a stop condition is met. Long-running; use zj_pane_read_screen for one-shot reads.",
  parameters: SubscribeParams,
  outputSchema: SubscribeOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  executionMode: "sequential",
  promptGuidelines: [...COMMON_GUIDELINES, ...STREAMING_GUIDELINES, "Use 'until-match' with a regex when waiting for a specific CLI tool to print something. Use 'until-prompt' to wait for the next shell prompt. Use 'for-duration' for a peek into what's happening."],
  async execute(_id, params, signal, onUpdate, _ctx) {
    const session = getSession();
    const args: string[] = [];
    if (session) args.push("--session", session);
    args.push("subscribe", "--format", "json", "--pane-id", String(params.paneId));
    if (params.scrollback !== undefined) {
      args.push("--scrollback");
      if (typeof params.scrollback === "number") args.push(String(params.scrollback));
    }
    if (params.ansi) args.push("--ansi");

    const events: SubscribeEventT[] = [];
    const maxEvents = params.maxEvents ?? 1000;
    const started = Date.now();
    const deadline = started + (params.mode === "for-duration" ? (params.durationMs ?? 5000) : 5 * 60_000);
    const regex = params.mode === "until-match" && params.regex ? new RegExp(params.regex) : null;
    const promptRegex = /[\$#\>]\s*$/;
    const includeScrollback = params.matchIncludeScrollback ?? false;

    let matched = false;
    let matchedLine: string | undefined;
    let matchedLineNo: number | undefined;
    let context: string[] | undefined;

    try {
      for await (const raw of runZellijStreaming(args, {}, signal)) {
        const ev = raw as SubscribeEventT;
        events.push(ev);
        if (events.length > maxEvents) {
          events.length = maxEvents;
          break;
        }

        if (ev.event === "pane_update") {
          if (regex) {
            for (let i = 0; i < (ev.viewport?.length ?? 0); i++) {
              const line = ev.viewport![i]!;
              if (regex.test(line)) {
                matched = true;
                matchedLine = line;
                matchedLineNo = i;
                context = (ev.viewport ?? []).slice(Math.max(0, i - 2), i + 3);
                break;
              }
            }
            if (!matched && includeScrollback && ev.scrollback) {
              for (let i = 0; i < ev.scrollback.length; i++) {
                if (regex.test(ev.scrollback[i]!)) {
                  matched = true;
                  matchedLine = ev.scrollback[i]!;
                  matchedLineNo = i;
                  context = ev.scrollback.slice(Math.max(0, i - 2), i + 3);
                  break;
                }
              }
            }
          } else if (params.mode === "until-prompt") {
            for (let i = 0; i < (ev.viewport?.length ?? 0); i++) {
              const line = ev.viewport![i]!;
              if (promptRegex.test(line)) {
                matched = true;
                matchedLine = line;
                matchedLineNo = i;
                context = (ev.viewport ?? []).slice(Math.max(0, i - 2), i + 3);
                break;
              }
            }
          }
        }

        if (onUpdate) {
          const out: { content: { type: "text"; text: string }[]; details: unknown } = {
            content: [{ type: "text", text: `[zj_pane_subscribe] event ${events.length}: viewport[0]="${ev.viewport?.[0]?.slice(0, 80) ?? ""}"` }],
            details: { eventsSoFar: events.length, matched, lastEvent: ev },
          };
          onUpdate(out);
        }

        if (matched) break;
        if (Date.now() > deadline) break;
      }
    } catch {
      // abort / socket death — return what we have
    }

    const last = events[events.length - 1];
    const result: {
      matched?: boolean;
      matchedLine?: string;
      matchedLineNo?: number;
      context?: string[];
      events: SubscribeEventT[];
      truncated: boolean;
      durationMs: number;
      lastViewport: string[];
    } = {
      events,
      truncated: events.length >= maxEvents,
      durationMs: Date.now() - started,
      lastViewport: last?.viewport ?? [],
    };
    if (matched) {
      result.matched = true;
      if (matchedLine !== undefined) result.matchedLine = matchedLine;
      if (matchedLineNo !== undefined) result.matchedLineNo = matchedLineNo;
      if (context !== undefined) result.context = context;
    }
    return {
      content: [{ type: "text", text: matched ? `matched: ${matchedLine}` : `${events.length} event(s); no match in ${result.durationMs} ms` }],
      details: result,
    };
  },
});

// ---------- Register ----------

export function registerSubscribeTool(pi: ExtensionAPI): void {
  pi.registerTool(subscribeTool);
}
