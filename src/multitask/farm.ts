/**
 * src/multitask/farm.ts — the headline multitask primitives.
 *
 * Phase 5 deliverables:
 *
 *   zj_farm_spawn     → spawn N panes in parallel running the same (templated)
 *                       command. Inputs:
 *                         {
 *                           count: number,                  // N
 *                           template: string,                // e.g. "git clone {repo} work-{i}"
 *                           cwd?: string,                   // shared cwd
 *                           session?: string,               // target session
 *                           layout?: "auto-row" | "auto-col" | "auto-grid" | "kdl:<string>",
 *                           tab?: string,                   // create / reuse tab
 *                           names?: string[],               // per-pane names
 *                         }
 *                       Returns: { handles: WorkerHandle[], tabId?: TabId }
 *                       Implementation:
 *                         • For count ≤ 4 use `zj_layout_apply` with a KDL
 *                           string zellij generates (atomic, fast).
 *                         • For larger N, use sequential `zj_pane_spawn`
 *                           calls (zellij serializes them anyway).
 *
 *   zj_farm_collect   → wait for all (or any) handles to exit.
 *                       Inputs: { handles: WorkerHandle[], mode: "all" | "any",
 *                                 deadlineMs?: number }
 *                       Returns: { results: { paneId, exitStatus, screen }[],
 *                                 timedOut: boolean }
 *
 *   zj_farm_status    → read every handle's current screen.
 *                       Inputs: { handles: WorkerHandle[] }
 *                       Returns: { paneId, screen }[]
 *                       Useful: agent periodically checks progress without
 *                       waiting for completion.
 *
 * Pattern (the example in docs/multitask-patterns.md#parallel-investigation):
 *
 *   const { handles } = await zj_farm_spawn({
 *     count: 4,
 *     template: "cd /repo && npm test -- --grep {i}",
 *   });
 *   const { results } = await zj_farm_collect({
 *     handles, mode: "all", deadlineMs: 5*60*1000,
 *   });
 *   // results[i].screen contains the test output for grep-pattern i
 */
export {}; // phase 0 — module body intentionally blank