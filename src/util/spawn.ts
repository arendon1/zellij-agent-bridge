/**
 * src/util/spawn.ts — safe child_process.spawn wrapper.
 *
 * Wraps Node's child_process with the policies the rest of the codebase
 * assumes:
 *   • Always capture stdout and stderr (never inherit).
 *   • Set a default timeout (configurable per call).
 *   • Pipe AbortSignal → child.kill('SIGTERM') → escalate to SIGKILL after 5s.
 *   • Track duration for the model's "took N ms" diagnostic.
 *   • Treat non-zero exit code as an error unless opts.expectNonZeroOk.
 *   • Limit stdout buffer to MAX_BYTES (default 10 MB) — streaming tools
 *     truncate earlier, see util/stream.ts.
 *
 * The actual `zellij` invocation goes through this, not through
 * `node:child_process` directly, so that policy lives in one place.
 *
 * Planned exports (phase 1):
 *
 *   export interface SpawnResult {
 *     stdout: Buffer;
 *     stderr: Buffer;
 *     exitCode: number | null;
 *     signal: NodeJS.Signals | null;
 *     durationMs: number;
 *   }
 *
 *   export interface SpawnOptions {
 *     cwd?: string;
 *     env?: NodeJS.ProcessEnv;
 *     timeoutMs?: number;            // default 30 000
 *     input?: string | Buffer;
 *     expectNonZeroOk?: boolean;
 *     maxOutputBytes?: number;       // default 10 * 1024 * 1024
 *     signal?: AbortSignal;
 *   }
 *
 *   export function spawnSafe(
 *     cmd: string,
 *     args: string[],
 *     opts?: SpawnOptions,
 *   ): Promise<SpawnResult>;
 */
export {}; // phase 0 — module body intentionally blank