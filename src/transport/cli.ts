/**
 * src/transport/cli.ts — the only file in the codebase that shells out to
 * `zellij`. Everything else talks to zellij through `runZellij(...)`.
 *
 * Why CLI and not direct Unix-domain-socket protobuf?
 *   • Zero dependencies — zellij ships its own CLI.
 *   • All ~130 actions are addressable as `zellij action <X>`.
 *   • Structured reads via `--json` flags.
 *   • Streaming via `zellij subscribe --format json --pane-id ...`.
 *   • A direct IPC client (protobuf over UDS) can replace this file in v2
 *     without touching anything else — that's the whole point of the
 *     transport/ boundary.
 *
 * Implementation outline (phase 1):
 *
 *   export interface ZellijRunOptions {
 *     session?: SessionName;       // --session NAME (omit = current session)
 *     cwd?: string;                // working directory for the child
 *     timeoutMs?: number;          // default 30s; subscription tools override
 *     signal?: AbortSignal;        // cancellation from pi's execute()
 *     env?: NodeJS.ProcessEnv;     // additional env vars
 *     stdin?: string | Buffer;     // feed stdin (rare; mostly for plugins)
 *     expectJson?: boolean;        // parse stdout as JSON when true
 *     expectNdjson?: boolean;      // treat stdout as newline-delimited JSON
 *   }
 *
 *   export interface ZellijRunResult<T = unknown> {
 *     stdout: string;
 *     stderr: string;
 *     exitCode: number;
 *     parsed?: T;                  // populated when expectJson || expectNdjson
 *     ndjsonEvents?: unknown[];    // populated when expectNdjson
 *     truncated?: boolean;         // set by truncate util
 *     spillPath?: string;          // temp file with overflow
 *     durationMs: number;
 *   }
 *
 *   export async function runZellij(
 *     args: string[],
 *     opts?: ZellijRunOptions
 *   ): Promise<ZellijRunResult> { ... }
 *
 *   export async function runZellijStreaming(
 *     args: string[],
 *     opts: ZellijRunOptions & { onEvent: (e: unknown) => void },
 *     signal?: AbortSignal,
 *   ): AsyncIterable<unknown> { ... }   // for `zellij subscribe`
 *
 * The streaming variant is what `tools/subscribe.ts` and the multitask
 * primitives hang off.
 */
export {}; // phase 0 — module body intentionally blank