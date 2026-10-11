/**
 * src/tools/session.ts — session management tools.
 *
 * 6 tools: ls, kill, kill_all, attach, attach_info, rename.
 * `attach_info` reads ZELLIJ_* env vars instead of shelling out.
 *
 * Session target resolution: each tool that needs to act on a
 * specific session reads it from the ZELLIJ_SESSION_NAME env var
 * via `getSession(params.session)`. Tools that take a session name in
 * their params (kill, attach) use that override.
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  callEnvelope,
  env_listSessions,
  env_killSession,
  env_killAllSessions,
  env_attach,
  env_renameSession,
} from "../protocol/envelopes.ts";
import { COMMON_GUIDELINES, DESTRUCTIVE_GUIDELINES } from "../prompts.ts";
import { errorResult, okResult, getSession } from "./_helpers.ts";

// ---------- zj_session_ls ----------

const SessionLsOutput = Type.Array(Type.String());

const sessionLsTool = defineTool({
  name: "zj_session_ls",
  label: "Zellij: list sessions",
  description: "List all running zellij sessions by name. Read-only.",
  parameters: Type.Object({}),
  outputSchema: SessionLsOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    try {
      const names = await callEnvelope(env_listSessions, {}, getSession());
      return okResult(`${names.length} session(s): ${names.join(", ") || "(none)"}`, names);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_session_kill ----------

const SessionKillParams = Type.Object({
  name: Type.String({ description: "Name of the session to kill" }),
});

const SessionKillOutput = Type.Object({ killed: Type.String() });

const sessionKillTool = defineTool({
  name: "zj_session_kill",
  label: "Zellij: kill session",
  description: "Kill a zellij session by name. DESTRUCTIVE: ends all panes in the session.",
  parameters: SessionKillParams,
  outputSchema: SessionKillOutput,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, ...DESTRUCTIVE_GUIDELINES],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_killSession, params, getSession());
      return okResult(`killed session '${params.name}'`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_session_kill_all ----------

const SessionKillAllParams = Type.Object({
  yes: Type.Optional(Type.Boolean({ description: "Skip confirmation prompts (still subject to the permission gate)" })),
});

const SessionKillAllOutput = Type.Object({ killed: Type.Boolean() });

const sessionKillAllTool = defineTool({
  name: "zj_session_kill_all",
  label: "Zellij: kill all sessions",
  description: "Kill every running zellij session. DESTRUCTIVE: ends all of them.",
  parameters: SessionKillAllParams,
  outputSchema: SessionKillAllOutput,
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
  promptGuidelines: [...COMMON_GUIDELINES, ...DESTRUCTIVE_GUIDELINES],
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_killAllSessions, params, getSession());
      return okResult("killed all sessions", out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_session_attach ----------

const SessionAttachParams = Type.Object({
  name: Type.Optional(Type.String({ description: "Session name to attach to" })),
  create: Type.Optional(Type.Boolean({ description: "Create the session if it does not exist" })),
  background: Type.Optional(Type.Boolean({ description: "Create the session in the background (don't attach interactively)" })),
  command: Type.Optional(Type.String({ description: "Initial command to run in the first pane" })),
});

const SessionAttachOutput = Type.Object({ session: Type.String() });

const sessionAttachTool = defineTool({
  name: "zj_session_attach",
  label: "Zellij: attach session",
  description: "Attach to (or create) a zellij session. Changes which session the current client is connected to.",
  parameters: SessionAttachParams,
  outputSchema: SessionAttachOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_attach, params, getSession());
      return okResult(`attached: ${out.session}`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- zj_session_attach_info ----------

const SessionAttachInfoOutput = Type.Object({
  session: Type.String(),
  paneId: Type.Union([Type.String(), Type.Integer(), Type.Null()]),
  originPaneId: Type.Union([Type.String(), Type.Integer(), Type.Null()]),
  isInZellij: Type.Boolean(),
});

const sessionAttachInfoTool = defineTool({
  name: "zj_session_attach_info",
  label: "Zellij: agent attach info",
  description: "Report the current agent's zellij context: session name, own pane id, origin pane id. Reads ZELLIJ_* env vars; does not call zellij.",
  parameters: Type.Object({}),
  outputSchema: SessionAttachInfoOutput,
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, _params, _signal, _onUpdate, _ctx) {
    const session = process.env["ZELLIJ_SESSION_NAME"] ?? "";
    const paneIdRaw = process.env["ZELLIJ_PANE_ID"];
    const originRaw = process.env["ZELLIJ_ORIGIN_PANE_ID"];
    const paneId = paneIdRaw === undefined || paneIdRaw === "" ? null : isNaN(Number(paneIdRaw)) ? paneIdRaw : Number(paneIdRaw);
    const originPaneId = originRaw === undefined || originRaw === "" ? null : isNaN(Number(originRaw)) ? originRaw : Number(originRaw);
    const out = { session, paneId, originPaneId, isInZellij: Boolean(session) };
    return okResult(
      out.isInZellij
        ? `running in zellij session '${out.session}', pane ${out.paneId}`
        : "not running inside a zellij session",
      out,
    );
  },
});

// ---------- zj_session_rename ----------

const SessionRenameParams = Type.Object({
  name: Type.String({ description: "New session name" }),
});

const SessionRenameOutput = Type.Object({ name: Type.String() });

const sessionRenameTool = defineTool({
  name: "zj_session_rename",
  label: "Zellij: rename session",
  description: "Rename the current zellij session.",
  parameters: SessionRenameParams,
  outputSchema: SessionRenameOutput,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  promptGuidelines: COMMON_GUIDELINES,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    try {
      const out = await callEnvelope(env_renameSession, params, getSession());
      return okResult(`renamed session to '${out.name}'`, out);
    } catch (err) {
      return errorResult(err);
    }
  },
});

// ---------- Register ----------

export function registerSessionTools(pi: ExtensionAPI): void {
  pi.registerTool(sessionLsTool);
  pi.registerTool(sessionKillTool);
  pi.registerTool(sessionKillAllTool);
  pi.registerTool(sessionAttachTool);
  pi.registerTool(sessionAttachInfoTool);
  pi.registerTool(sessionRenameTool);
}
