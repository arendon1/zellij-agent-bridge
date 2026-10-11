/**
 * src/tools/input.ts — input tools.
 *
 * 4 tools: write_chars, paste, send_keys, send_bytes.
 * These all send input into a pane's PTY. Reversible (you can press
 * backspace / send Ctrl-C), so `destructiveHint: false` across the
 * board.
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_writeChars,
  env_paste,
  env_sendKeys,
  env_writeBytes,
} from "../protocol/envelopes.ts";
import { COMMON_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";

// ---------- zj_pane_write_chars ----------

const PaneWriteCharsParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Target pane id" }),
  chars: Type.String({ description: "Literal text to type into the pane" }),
});

const PaneWriteCharsOutput = Type.Object({
  paneId: Type.String(),
  written: Type.Integer(),
});

const paneWriteCharsTool = defineTool({
  name: "zj_pane_write_chars",
  label: "Zellij: write chars to pane",
  description: "Type literal text into a pane's PTY. Use for commands, replies, or shell input.",
  parameters: PaneWriteCharsParams,
  outputSchema: PaneWriteCharsOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, "Does not press Enter; combine with zj_pane_send_keys keys:['Enter'] if you need a newline."],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      await callEnvelope(env_writeChars, params, getSession());
      return okResult(`wrote ${params.chars.length} chars to pane ${params.paneId}`, { paneId: String(params.paneId), written: params.chars.length });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_paste ----------

const PanePasteParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Target pane id" }),
  text: Type.String({ description: "Text to paste (bracketed-paste mode)" }),
});

const PanePasteOutput = Type.Object({
  paneId: Type.String(),
  pasted: Type.Integer(),
});

const panePasteTool = defineTool({
  name: "zj_pane_paste",
  label: "Zellij: paste into pane",
  description: "Paste text into a pane using bracketed-paste mode. Use for multiline content that should be treated as a single paste event by the receiving program.",
  parameters: PanePasteParams,
  outputSchema: PanePasteOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      await callEnvelope(env_paste, params, getSession());
      return okResult(`pasted ${params.text.length} chars into pane ${params.paneId}`, { paneId: String(params.paneId), pasted: params.text.length });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_send_keys ----------

const PaneSendKeysParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Target pane id" }),
  keys: Type.Array(Type.String(), { description: "Key combos in zellij syntax: 'Ctrl a', 'Alt Tab', 'F1', 'Enter', 'Esc', 'Tab', 'PageUp', 'BackTab', 'Up'/'Down'/'Left'/'Right', etc." }),
});

const PaneSendKeysOutput = Type.Object({
  paneId: Type.String(),
  keys: Type.Array(Type.String()),
});

const paneSendKeysTool = defineTool({
  name: "zj_pane_send_keys",
  label: "Zellij: send keys to pane",
  description: "Send key combinations to a pane. Use for navigation, control sequences, and TUI interaction.",
  parameters: PaneSendKeysParams,
  outputSchema: PaneSendKeysOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, "Key syntax: 'Ctrl a', 'Alt Tab', 'F1', 'Enter', 'Esc', 'PageUp', etc. Use 'Ctrl c' to interrupt a hung process."],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      await callEnvelope(env_sendKeys, params, getSession());
      return okResult(`sent ${params.keys.length} key(s) to pane ${params.paneId}`, { paneId: String(params.paneId), keys: params.keys });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_pane_send_bytes ----------

const PaneSendBytesParams = Type.Object({
  paneId: Type.Union([Type.String(), Type.Integer()], { description: "Target pane id" }),
  bytes: Type.Array(Type.String(), { description: "Raw byte sequences (decimal or hex escape sequences) to write to the pane" }),
});

const PaneSendBytesOutput = Type.Object({
  paneId: Type.String(),
  bytes: Type.Integer(),
});

const paneSendBytesTool = defineTool({
  name: "zj_pane_send_bytes",
  label: "Zellij: send raw bytes to pane",
  description: "Send raw bytes to a pane's PTY. Use for low-level escape sequences or binary input.",
  parameters: PaneSendBytesParams,
  outputSchema: PaneSendBytesOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, "Low-level. Prefer zj_pane_write_chars for text or zj_pane_send_keys for key sequences."],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      await callEnvelope(env_writeBytes, params, getSession());
      return okResult(`wrote ${params.bytes.length} byte(s) to pane ${params.paneId}`, { paneId: String(params.paneId), bytes: params.bytes.length });
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- Register ----------

export function registerInputTools(pi: ExtensionAPI): void {
  pi.registerTool(paneWriteCharsTool);
  pi.registerTool(panePasteTool);
  pi.registerTool(paneSendKeysTool);
  pi.registerTool(paneSendBytesTool);
}
