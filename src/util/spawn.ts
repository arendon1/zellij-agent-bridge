/**
 * src/util/spawn.ts — safe child_process wrapper used by the transport.
 *
 * Wraps Node's child_process.spawn with the policies the rest of the
 * codebase assumes:
 *
 *   • Always capture stdout and stderr (never inherit) so tools can parse.
 *   • Default timeout 30 000 ms; configurable per call.
 *   • AbortSignal → child.kill('SIGTERM') → escalate to SIGKILL after 5 s.
 *   • Track duration for "took N ms" diagnostics.
 *   • Non-zero exit code is returned, not thrown — callers decide.
 *   • Limit stdout buffer to MAX_BYTES (default 10 MB) — streaming tools
 *     use a lower cap and rely on util/stream.ts for backpressure.
 *
 * This is intentionally a thin wrapper — no buffering strategy beyond
 * "collect all of stdout and stderr into memory up to MAX_BYTES", which
 * is fine for `zellij action <X> --json` calls (typically <100 KB) and
 * `zellij subscribe` (which the streaming variant handles separately).
 */

import { spawn } from "node:child_process";
import { log } from "./log.ts";

export interface SpawnResult {
  stdout: Buffer;
  stderr: Buffer;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export interface SpawnOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;            // default 30 000
  input?: string | Buffer;        // written to stdin
  expectNonZeroOk?: boolean;     // when true, exit != 0 is reported not thrown
  maxOutputBytes?: number;       // default 10 * 1024 * 1024
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_OUTPUT = 10 * 1024 * 1024;
const SIGKILL_DELAY_MS = 5_000;

export function spawnSafe(
  cmd: string,
  args: string[],
  opts: SpawnOptions = {},
): Promise<SpawnResult> {
  const {
    cwd,
    env,
    timeoutMs = DEFAULT_TIMEOUT,
    input,
    maxOutputBytes = DEFAULT_MAX_OUTPUT,
    signal,
  } = opts;

  return new Promise<SpawnResult>((resolve, reject) => {
    const started = Date.now();
    let child;
    try {
      child = spawn(cmd, args, {
        cwd,
        env: { ...process.env, ...env },
        stdio: ["pipe", "pipe", "pipe"],
        // do NOT set `detached: true` — we want to be able to SIGTERM the group
      });
    } catch (err) {
      reject(err);
      return;
    }

    const outChunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let outBytes = 0;
    let errBytes = 0;
    let truncated = false;

    child.stdout!.on("data", (chunk: Buffer) => {
      if (truncated) return;
      outBytes += chunk.length;
      if (outBytes > maxOutputBytes) {
        truncated = true;
        // keep collecting but flag it for the caller
        return;
      }
      outChunks.push(chunk);
    });
    child.stderr!.on("data", (chunk: Buffer) => {
      if (truncated) return;
      errBytes += chunk.length;
      if (errBytes > maxOutputBytes) {
        truncated = true;
        return;
      }
      errChunks.push(chunk);
    });

    if (input !== undefined && child.stdin) {
      child.stdin.end(input);
    } else if (child.stdin) {
      child.stdin.end();
    }

    let settled = false;
    const settle = (result: SpawnResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    child.on("error", (err) => fail(err));

    child.on("close", (exitCode, sig) => {
      if (truncated) {
        log.warn(`${cmd} output exceeded ${maxOutputBytes} bytes`);
      }
      settle({
        stdout: Buffer.concat(outChunks),
        stderr: Buffer.concat(errChunks),
        exitCode,
        signal: sig as NodeJS.Signals | null,
        durationMs: Date.now() - started,
      });
    });

    // Timeout — SIGTERM first, SIGKILL after grace period.
    const timer = setTimeout(() => {
      log.debug(`${cmd} timed out after ${timeoutMs} ms; sending SIGTERM`);
      try { child.kill("SIGTERM"); } catch { /* already dead */ }
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* already dead */ }
      }, SIGKILL_DELAY_MS);
    }, timeoutMs);

    // AbortSignal — same escalation as timeout.
    const onAbort = () => {
      log.debug(`${cmd} aborted via signal; sending SIGTERM`);
      try { child.kill("SIGTERM"); } catch { /* already dead */ }
      setTimeout(() => {
        try { child.kill("SIGKILL"); } catch { /* already dead */ }
      }, SIGKILL_DELAY_MS);
    };
    if (signal) {
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    }

    child.on("close", () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener("abort", onAbort);
    });
  });
}
