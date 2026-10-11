/**
 * src/transport/cli.ts — the only file in the codebase that shells out
 * to `zellij`. Everything else talks to zellij through `runZellij`.
 *
 * Two variants:
 *   • runZellij()       — single-shot, returns a ZellijRunResult
 *   • runZellijStreaming() — async iterable of NDJSON events, for
 *                            `zellij subscribe --format json`
 *
 * Both wrap `spawnSafe` (src/util/spawn.ts) so the timeout/signal/output
 * policy lives in one place.
 *
 * A future v2 can swap this whole file for a direct UDS-protobuf client
 * without touching anything else — that's the whole point of the
 * `src/transport/` boundary.
 */

import { spawnSafe } from "../util/spawn.ts";
import { classify, type ZellijError } from "./codec.ts";
import { parseNdjsonStream } from "../util/stream.ts";
import { truncate, type TruncateResult } from "../util/truncate.ts";
import { log } from "../util/log.ts";
import type { SessionName } from "../types.ts";

export interface ZellijRunOptions {
  /** Target session name. Omit to act on the current session. */
  session?: SessionName;
  /** Working directory for the child. */
  cwd?: string;
  /** Additional env vars. */
  env?: NodeJS.ProcessEnv;
  /** Per-call timeout. Default 30 000 ms. */
  timeoutMs?: number;
  /** Cancel the in-flight call. */
  signal?: AbortSignal;
  /** Parse stdout as JSON before returning. */
  expectJson?: boolean;
  /** Treat stdout as newline-delimited JSON; return events as an array. */
  expectNdjson?: boolean;
  /** Cap model-facing text at this many bytes. Default 50 000. */
  maxBytes?: number;
  /** Cap model-facing text at this many lines. Default 2 000. */
  maxLines?: number;
  /** Cap raw stdout collection. Default 10 MB. */
  maxOutputBytes?: number;
  /** Stdin to feed the child. */
  input?: string;
  /** When true, non-zero exit is surfaced in the result, not thrown. */
  expectNonZeroOk?: boolean;
}

export interface ZellijRunResult<T = unknown> {
  /** Raw stdout as utf-8. May be truncated if maxOutputBytes was hit. */
  stdout: string;
  /** Raw stderr as utf-8. */
  stderr: string;
  /** Child exit code. */
  exitCode: number | null;
  /** Signal that killed the child, if any. */
  signal: NodeJS.Signals | null;
  /** How long the call took. */
  durationMs: number;
  /** Parsed JSON when expectJson was set. */
  parsed?: T;
  /** NDJSON events when expectNdjson was set (terminal snapshot). */
  events?: unknown[];
  /** Truncation report for the model-facing text. */
  truncation?: TruncateResult;
  /** Classified error when exitCode != 0. */
  classified?: ZellijError;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_OUTPUT = 10 * 1024 * 1024;

/**
 * Run a `zellij <args...>` subprocess. The single entry point every
 * tool uses to talk to zellij. The shape of the returned `parsed` /
 * `events` depends on `expectJson` / `expectNdjson`.
 */
export async function runZellij<T = unknown>(
  args: string[],
  opts: ZellijRunOptions = {},
): Promise<ZellijRunResult<T>> {
  const {
    session,
    cwd,
    env,
    timeoutMs = DEFAULT_TIMEOUT,
    signal,
    expectJson,
    expectNdjson,
    maxBytes,
    maxLines,
    maxOutputBytes = DEFAULT_MAX_OUTPUT,
    input,
    expectNonZeroOk,
  } = opts;

  const fullArgs = session ? ["--session", session, ...args] : args;
  log.debug(`zellij ${fullArgs.join(" ")}`);

  const spawnOpts: Parameters<typeof spawnSafe>[2] = {
    timeoutMs,
    maxOutputBytes,
  };
  if (cwd !== undefined) spawnOpts.cwd = cwd;
  if (env !== undefined) spawnOpts.env = env;
  if (signal !== undefined) spawnOpts.signal = signal;
  if (input !== undefined) spawnOpts.input = input;
  if (expectNonZeroOk !== undefined) spawnOpts.expectNonZeroOk = expectNonZeroOk;

  const res = await spawnSafe("zellij", fullArgs, spawnOpts);

  const stdout = res.stdout.toString("utf-8");
  const stderr = res.stderr.toString("utf-8");

  const result: ZellijRunResult<T> = {
    stdout,
    stderr,
    exitCode: res.exitCode,
    signal: res.signal,
    durationMs: res.durationMs,
  };

  if (res.exitCode !== 0 && !expectNonZeroOk) {
    result.classified = classify(stderr, res.exitCode ?? 0, session);
  }

  if (expectJson && stdout) {
    try {
      result.parsed = JSON.parse(stdout) as T;
    } catch (err) {
      if (!result.classified) {
        result.classified = {
          kind: "json-parse-failed",
          message: `zellij output was not valid JSON: ${(err as Error).message}`,
          raw: stdout.slice(0, 500),
          exitCode: res.exitCode ?? 0,
        };
      }
    }
  }

  if (expectNdjson && stdout) {
    const events: unknown[] = [];
    for (const line of stdout.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        log.debug(`skipping malformed NDJSON line: ${trimmed.slice(0, 80)}`);
      }
    }
    result.events = events;
  }

  // Truncate the model-facing text. Done last so we capture parsed
  // and events from the full output.
  const tr = truncate(stdout, { ...(maxBytes !== undefined ? { maxBytes } : {}), ...(maxLines !== undefined ? { maxLines } : {}) });
  result.truncation = tr;
  if (tr.truncated) {
    result.stdout = tr.text;
  }

  return result;
}

/**
 * Streaming variant for `zellij subscribe --format json --pane-id ...`.
 * Yields NDJSON events as they arrive. Honors `signal` for cancel.
 *
 * Stops when:
 *   • the child exits (yields nothing further)
 *   • signal aborts (child is SIGTERMed; iterator ends)
 *   • the caller breaks out of the `for await` loop (child is SIGTERMed)
 */
export async function* runZellijStreaming(
  args: string[],
  opts: ZellijRunOptions = {},
  signal?: AbortSignal,
): AsyncGenerator<unknown, void, void> {
  const {
    session,
    cwd,
    env,
    timeoutMs = 5 * 60_000, // 5 min default for subscribe
    maxOutputBytes = DEFAULT_MAX_OUTPUT,
    input,
  } = opts;

  const fullArgs = session ? ["--session", session, ...args] : args;
  log.debug(`zellij (streaming) ${fullArgs.join(" ")}`);

  // Build a child whose stdout we can read line-by-line. We use the
  // raw spawn here, not spawnSafe, because we need ongoing access to
  // stdout for streaming.
  const { spawn } = await import("node:child_process");
  const child = spawn("zellij", fullArgs, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (input && child.stdin) {
    child.stdin.end(input);
  } else if (child.stdin) {
    child.stdin.end();
  }

  let aborted = false;
  const onAbort = () => {
    aborted = true;
    try { child.kill("SIGTERM"); } catch { /* already dead */ }
  };
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  }

  // Timeout
  const timer = setTimeout(() => {
    log.debug(`zellij stream timed out after ${timeoutMs} ms; SIGTERM`);
    try { child.kill("SIGTERM"); } catch { /* already dead */ }
  }, timeoutMs);

  // Combine stdout chunks into a single async iterable of Buffers.
  const chunkSource: AsyncIterable<Buffer> = (async function* () {
    for await (const chunk of child.stdout as AsyncIterable<Buffer>) {
      if (aborted) return;
      yield chunk;
    }
  })();

  try {
    for await (const ev of parseNdjsonStream(chunkSource)) {
      if (aborted) return;
      // Recognize the close event and terminate the stream.
      if (ev && typeof ev === "object" && "SubscribedPaneClosed" in ev) {
        log.debug(`subscribe: pane closed`);
        return;
      }
      yield ev;
    }
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onAbort);
    try { child.kill("SIGTERM"); } catch { /* already dead */ }
    setTimeout(() => {
      try { child.kill("SIGKILL"); } catch { /* already dead */ }
    }, 5_000);
  }
}
