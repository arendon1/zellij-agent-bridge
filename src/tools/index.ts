/**
 * src/tools/index.ts — barrel + registration helper.
 *
 * Always registers `zj_doctor` (the diagnostic). When the probe
 * succeeds, also registers every category's tools via its
 * `register*Tools` function.
 */

import { Type } from "typebox";
import {
  defineTool,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { probeZellij, isZellijAvailable, MIN_ZELLIJ_VERSION, type ProbeState } from "../transport/probe.ts";
import { log } from "../util/log.ts";

import { registerSessionTools } from "./session.ts";
import { registerQueryTools } from "./query.ts";
import { registerSubscribeTool } from "./subscribe.ts";
import { registerPaneTools } from "./pane.ts";
import { registerTabTools } from "./tab.ts";
import { registerInputTools } from "./input.ts";
import { registerLayoutTools } from "./layout.ts";
import { registerFarmTools } from "../multitask/farm.ts";
import { registerReducerTools } from "../multitask/reducer.ts";

const DoctorParams = Type.Object({
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
 * zj_doctor — diagnostic tool. Always registered, even when zellij
 * is missing. Use it to confirm setup, force a re-probe, and surface
 * the exact error to the agent when other tools fail.
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
        active: _ctx.hasUI ? 0 : 0,
      },
    };
    const text = state.available
      ? `zellij ${state.version} OK at ${state.path}. ${result.tools.active} tools active.`
      : `zellij NOT available: ${state.error ?? "unknown"}. Minimum required: ${MIN_ZELLIJ_VERSION}.`;
    return {
      content: [{ type: "text", text }],
      details: result,
    };
  },
});

export function registerAllTools(pi: ExtensionAPI): void {
  log.debug("registering zellij-agent-bridge tools");
  pi.registerTool(doctorTool);

  if (!isZellijAvailable()) {
    log.warn("zellij unavailable — only zj_doctor is registered");
    return;
  }

  // Each category registers its own tools. Order doesn't matter for
  // pi, but we register the read tools first so the model sees them
  // before the mutating ones.
  try {
    registerSessionTools(pi);
    registerQueryTools(pi);
    registerSubscribeTool(pi);
    registerPaneTools(pi);
    registerTabTools(pi);
    registerInputTools(pi);
    registerLayoutTools(pi);
    registerFarmTools(pi);
    registerReducerTools(pi);
  } catch (err) {
    log.error("failed to register category tools", err);
  }
}
