/**
 * zellij-agent-bridge — extension entry point.
 *
 * Pi loads this file via jiti when:
 *   • it's listed in `package.json#pi.extensions`, OR
 *   • it sits in `~/.pi/agent/extensions/` or `.pi/extensions/`, OR
 *   • the user runs `pi -e ./projects/zellij-agent-bridge`.
 *
 * The default-exported factory receives the live `ExtensionAPI`. At load
 * time we:
 *
 *   1. Probe for the `zellij` binary (path + version) — see
 *      src/transport/probe.ts. We log a warning if it's missing or
 *      older than MIN_ZELLIJ_VERSION.
 *   2. Register all tools via registerAllTools(pi) — see
 *      src/tools/index.ts. When the probe fails, only `zj_doctor` is
 *      registered, so the user/agent can still query the state.
 *   3. Install a `tool_call` permission gate (phase 6) that blocks
 *      destructive operations unless the user has confirmed them.
 *
 * See `docs/architecture.md` and `docs/api-mapping.md` for the planned
 * tool surface.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { probeZellij } from "./transport/probe.ts";
import { registerAllTools } from "./tools/index.ts";
import { log } from "./util/log.ts";
import { SYSTEM_PROMPT_PREAMBLE, TOOL_SNIPPET } from "./prompts.ts";

export default async function (pi: ExtensionAPI): Promise<void> {
  // 1. Probe for zellij. Failure is non-fatal — the doctor tool will
  //    still register so the user/agent can diagnose.
  const probe = await probeZellij();
  if (probe.available) {
    log.debug(`zellij ${probe.version} at ${probe.path}`);
  } else {
    log.warn(`zellij not available (${probe.error}); only zj_doctor will be active`);
  }

  // 2. Register all the tools. doctor is always-on; the rest are gated
  //    on the probe result.
  registerAllTools(pi);

  // 3. Inject model-facing context via before_agent_start. The preamble
  //    is appended to the system prompt so the model learns the
  //    zj_* namespace conventions, multitask patterns, and destructive
  //    semantics. See src/prompts.ts.
  pi.on("before_agent_start", async (event) => {
    const base = event.systemPrompt ?? "";
    return {
      systemPrompt: base
        ? `${base}\n\n${SYSTEM_PROMPT_PREAMBLE}\n\nAvailable tools category: ${TOOL_SNIPPET}`
        : `${SYSTEM_PROMPT_PREAMBLE}\n\nAvailable tools category: ${TOOL_SNIPPET}`,
    };
  });

  // 3. TODO(phase 6): permission gate.
  //    pi.on("tool_call", async (event, ctx) => {
  //      if (!event.toolName.startsWith("zj_")) return;
  //      const tool = pi.getAllTools().find(t => t.name === event.toolName);
  //      if (tool?.annotations?.destructiveHint && !ctx.hasUI) {
  //        return { block: true, reason: "destructive zj_* tool requires interactive UI" };
  //      }
  //      if (tool?.annotations?.destructiveHint) {
  //        const ok = await ctx.ui.confirm(`Allow ${event.toolName}?`, `This can be destructive.`);
  //        if (!ok) return { block: true, reason: "user declined" };
  //      }
  //    });

  // 4. TODO(phase 6): session_shutdown cleanup.
  //    pi.on("session_shutdown", () => {
  //      // close any long-running subscribe streams spawned in this session
  //    });
}
