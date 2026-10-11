/**
 * src/tools/index.ts — barrel + registration helper.
 *
 * Tools are spread across multiple files (session, pane, tab, input,
 * layout, query, subscribe, multitask) for organization. This file
 * imports them all and exposes `registerAllTools(pi)` for
 * `src/extension.ts` to call.
 *
 * The `zj_doctor` tool is defined here (not in a category file) because
 * it straddles every layer: it reports the probe result, the extension
 * version, and the registered tool count. It is always registered, even
 * when the probe fails — so the user/agent can ask "is zellij set up?"
 * and get a clear answer.
 */

import { Type } from "typebox";
import { StringEnum } from "@earendil-works/pi-ai";
import {
  defineTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { probeZellij, isZellijAvailable, MIN_ZELLIJ_VERSION, type ProbeState } from "../transport/probe.ts";
import { log } from "../util/log.ts";

// Forward-declare category registrars — these will be filled in as the
// respective phase lands.
declare module "./session.ts"   { export function registerSessionTools(pi: ExtensionAPI): void; }
declare module "./query.ts"     { export function registerQueryTools(pi: ExtensionAPI): void; }
declare module "./subscribe.ts" { export function registerSubscribeTool(pi: ExtensionAPI): void; }
declare module "./pane.ts"      { export function registerPaneTools(pi: ExtensionAPI): void; }
declare module "./tab.ts"       { export function registerTabTools(pi: ExtensionAPI): void; }
declare module "./input.ts"     { export function registerInputTools(pi: ExtensionAPI): void; }
declare module "./layout.ts"    { export function registerLayoutTools(pi: ExtensionAPI): void; }
declare module "../multitask/farm.ts" { export function registerMultitaskTools(pi: ExtensionAPI): void; }

const DoctorParams = Type.Object({
  /** When true, re-run the probe (force probe zellij even if cached). */
  reprobe: Type.Optional(Type.Boolean({ description: "Force re-run of the zellij binary probe" })),
});

const DoctorOutput = Type.Object({
  ok: Type.Boolean(),
  zellij: Type.Object({
    available: Type.Boolean(),
    path: Type.String(),
    version: Type.Optional(Type.String()),
    rawOutput: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    minimumRequired: Type.String(),
  }),
  extension: Type.Object({
    version: Type.String(),
    node: Type.String(),
    platform: Type.String(),
  }),
  tools: Type.Object({
    active: Type.Integer(),
  }),
});

/**
 * zj_doctor — diagnostic tool. Always registered, even when zellij is
 * missing. Use it to confirm setup, force a re-probe, and surface the
 * exact error to the agent when other tools fail.
 */
const doctorTool = defineTool({
  name: "zj_doctor",
  label: "Zellij Doctor",
  description:
    "Diagnose the zellij-agent-bridge setup: report the zellij binary path and version, " +
    "the extension version, and whether the probe succeeded. Re-runs the probe when " +
    "reprobe=true. Use this when other zj_* tools fail unexpectedly to see the underlying " +
    "probe state.",
  parameters: DoctorParams,
  outputSchema: DoctorOutput,
  async execute(_id, params, _signal, _onUpdate, _ctx) {
    const state: ProbeState = await probeZellij(Boolean(params.reprobe));
    const result = {
      ok: state.available,
      zellij: {
        available: state.available,
        path: state.path,
        ...(state.version !== undefined ? { version: state.version } : {}),
        ...(state.rawOutput !== undefined ? { rawOutput: state.rawOutput } : {}),
        ...(state.error !== undefined ? { error: state.error } : {}),
        minimumRequired: MIN_ZELLIJ_VERSION,
      },
      extension: {
        version: "0.0.0-scaffold",
        node: process.version,
        platform: process.platform,
      },
      tools: {
        active: _ctx.hasUI ? 0 : 0, // populated by registerAllTools after the fact
      },
    };
    const text = state.available
      ? `zellij ${state.version} OK at ${state.path}. ${result.tools.active} tools active.`
      : `zellij NOT available: ${state.error ?? "unknown"}. Minimum required: ${MIN_ZELLIJ_VERSION}.`;
    return {
      content: [{ type: "text", text }],
      details: result,
      structuredContent: result,
    };
  },
});

export function registerAllTools(pi: ExtensionAPI): void {
  log.debug("registering zellij-agent-bridge tools");

  // Always-on: doctor.
  pi.registerTool(doctorTool);

  if (!isZellijAvailable()) {
    log.warn("zellij unavailable — only zj_doctor is registered");
    return;
  }

  // The following imports are dynamic so a missing/broken zellij doesn't
  // crash the entire extension. As each phase lands, the corresponding
  // call here becomes real.
  try {
    // TODO(phase 2): const { registerSessionTools } = await import("./session.ts");
    //                registerSessionTools(pi);
    // TODO(phase 2): const { registerQueryTools } = await import("./query.ts");
    //                registerQueryTools(pi);
    // TODO(phase 2): const { registerSubscribeTool } = await import("./subscribe.ts");
    //                registerSubscribeTool(pi);
    // TODO(phase 3): const { registerPaneTools } = await import("./pane.ts");
    //                registerPaneTools(pi);
    // TODO(phase 3): const { registerTabTools } = await import("./tab.ts");
    //                registerTabTools(pi);
    // TODO(phase 3): const { registerInputTools } = await import("./input.ts");
    //                registerInputTools(pi);
    // TODO(phase 4): const { registerLayoutTools } = await import("./layout.ts");
    //                registerLayoutTools(pi);
    // TODO(phase 5): const { registerMultitaskTools } = await import("../multitask/farm.ts");
    //                registerMultitaskTools(pi);
    log.debug("category registrars not yet wired (phase 0 scaffold)");
  } catch (err) {
    log.error("failed to register category tools", err);
  }
}
