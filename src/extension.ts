/**
 * zellij-agent-bridge — extension entry point.
 *
 * Pi loads this file via jiti when:
 *   • it's listed in `package.json#pi.extensions`, OR
 *   • it sits in `~/.pi/agent/extensions/` or `.pi/extensions/`, OR
 *   • the user runs `pi -e ./projects/zellij-agent-bridge`.
 *
 * The default-exported factory receives the live `ExtensionAPI`. Register
 * tools here, attach `tool_call` permission gates, and clean up in
 * `session_shutdown`. Do NOT start processes / sockets in the factory body
 * itself — pi's loader awaits this and expects it to return promptly.
 *
 * See `docs/architecture.md` and `docs/api-mapping.md` for the planned tool
 * surface.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI): void {
  // TODO(phase 2): register session tools  → see src/tools/session.ts
  // TODO(phase 2): register query tools    → see src/tools/query.ts
  // TODO(phase 2): register subscribe tool  → see src/tools/subscribe.ts
  // TODO(phase 3): register pane tools     → see src/tools/pane.ts
  // TODO(phase 3): register tab tools      → see src/tools/tab.ts
  // TODO(phase 3): register input tools    → see src/tools/input.ts
  // TODO(phase 4): register layout tools   → see src/tools/layout.ts
  // TODO(phase 5): register multitask tools → see src/multitask/{worker,farm,reducer}.ts

  // TODO(phase 6): permission gate — pi.on("tool_call", ...) blocks destructive
  //   tools (zj_session_kill, zj_pane_close, zj_tab_close, zj_*_kill_all) unless
  //   ctx.ui.confirm returns true. Read tool annotations to decide.

  // TODO(phase 6): session lifecycle — pi.on("session_shutdown", ...) closes any
  //   long-running subscribe streams spawned during this session.
}