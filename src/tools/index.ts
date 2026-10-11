/**
 * src/tools/index.ts — barrel + registration helper.
 *
 * Tools are spread across multiple files (session, pane, tab, input,
 * layout, query, subscribe, multitask) for organization. This file
 * imports them all and exposes `registerAllTools(pi)` for
 * `src/extension.ts` to call.
 *
 * Planned:
 *
 *   import { registerSessionTools } from "./session.js";
 *   import { registerPaneTools }    from "./pane.js";
 *   ...
 *
 *   export function registerAllTools(pi: ExtensionAPI): void {
 *     registerSessionTools(pi);
 *     registerQueryTools(pi);
 *     registerSubscribeTool(pi);
 *     registerPaneTools(pi);
 *     registerTabTools(pi);
 *     registerInputTools(pi);
 *     registerLayoutTools(pi);
 *     registerMultitaskTools(pi);
 *   }
 */
export {}; // phase 0 — module body intentionally blank