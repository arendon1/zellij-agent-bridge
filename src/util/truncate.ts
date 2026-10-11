/**
 * src/util/truncate.ts — model-output truncation.
 *
 * Pi's default model-facing output limit is 50 KB / 2 000 lines
 * (DEFAULT_MAX_BYTES / DEFAULT_MAX_LINES — see
 * examples/extensions/truncated-tool.ts). When a tool returns more, it
 * gets truncated with a pointer to a temp file containing the overflow.
 *
 * The agents that consume this bridge will often hit the cap on a
 * single `zj_pane_read_screen` call (a long build log, a test suite
 * dump). We want predictable behavior.
 *
 * Planned exports (phase 1):
 *
 *   export interface TruncateOptions {
 *     maxBytes?: number;       // default 50_000
 *     maxLines?: number;       // default 2_000
 *     tempDir?: string;        // default os.tmpdir()
 *     label?: string;          // for the "spilled to ..." annotation
 *   }
 *
 *   export interface TruncateResult {
 *     text: string;
 *     truncated: boolean;
 *     spilled: { bytes: number; lines: number; path: string } | null;
 *   }
 *
 *   export function truncate(
 *     text: string,
 *     opts?: TruncateOptions,
 *   ): TruncateResult;
 */
export {}; // phase 0 — module body intentionally blank