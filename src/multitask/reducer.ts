/**
 * src/multitask/reducer.ts — pattern-matching on pane content.
 *
 * Phase 5 deliverables:
 *
 *   zj_pane_wait_for  → block until a regex matches a line in the pane's
 *                       viewport (or scrollback). Inputs:
 *                         { paneId, regex: string, timeoutMs?: number,
 *                           includeScrollback?: boolean }
 *                       Returns: { matched: true, line: string, lineNo: number,
 *                                  context: string[] } |
 *                               { matched: false, lastViewport: string[] }
 *                       Honors ctx.signal.
 *
 *   zj_pane_collect_lines
 *                     → scan the pane's scrollback (or live viewport) for
 *                       lines matching a regex. Inputs:
 *                         { paneId, regex: string, source: "viewport"|"scrollback",
 *                           max?: number }
 *                       Returns: { matches: { line, lineNo }[] }
 *
 *   zj_farm_reduce    → apply a reducer function (extract matches from each)
 *                       across a farm's screens. Inputs:
 *                         { handles, regex, mode: "max" | "sum" | "all" }
 *                       "max" → return the screen with the most matches
 *                       "sum" → return concatenated matches
 *                       "all" → return per-handle match counts
 *
 * These three are what makes the multitask primitives composable — an
 * agent can farm-spawn a build across N shards, then wait-for the
 * "BUILD FAILED" regex on the union of screens, then collect_lines
 * the actual error messages.
 */
export {}; // phase 0 — module body intentionally blank