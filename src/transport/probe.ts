/**
 * src/transport/probe.ts — discover whether `zellij` is installed, where,
 * and at what version. Run once at extension load.
 *
 * Result is cached in a module-level `ProbeState` so tools can check
 * `isZellijAvailable()` cheaply on every call.
 *
 * The probe uses `which zellij` first to resolve the binary, then runs
 * `<zellij> --version` to confirm it actually executes. We don't assume
 * the binary is on PATH (a user might have it via a different name
 * resolved through an alias manager) but we do default to `zellij` from
 * PATH.
 */

import { spawnSafe } from "../util/spawn.ts";
import { log } from "../util/log.ts";

export interface ProbeState {
  available: boolean;
  /** Resolved path, e.g. "/usr/local/bin/zellij" or "zellij" if not resolved. */
  path: string;
  /** Parsed version, e.g. "0.45.1". Undefined when not available. */
  version?: string;
  /** Raw stdout of `zellij --version`. */
  rawOutput?: string;
  /** First error encountered, if any. */
  error?: string;
  /** When the probe ran. */
  probedAt: number;
}

let cached: ProbeState | undefined;

const MIN_VERSION = "0.45.0";

/** Compare semver-ish "x.y.z" strings. Returns negative / 0 / positive. */
function compareVersions(a: string, b: string): number {
  const ap = a.split(".").map((s) => Number.parseInt(s, 10));
  const bp = b.split(".").map((s) => Number.parseInt(s, 10));
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const av = ap[i] ?? 0;
    const bv = bp[i] ?? 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function parseVersion(stdout: string): string | undefined {
  // `zellij --version` prints "zellij 0.45.1" (with optional extra suffix).
  const m = stdout.match(/(\d+\.\d+\.\d+)/);
  return m?.[1];
}

async function whichZellij(): Promise<string> {
  // Try `command -v zellij` first (POSIX-portable, always available).
  // `which` isn't installed on some systems (e.g. Termux minimal).
  for (const cmd of ["command", "which"]) {
    const args = cmd === "command" ? ["-v", "zellij"] : ["zellij"];
    try {
      const res = await spawnSafe(cmd, args, { timeoutMs: 2_000 });
      if (res.exitCode === 0) {
        const out = res.stdout.toString("utf-8").trim();
        if (out) return out.split("\n")[0]!.trim();
      }
    } catch {
      // which not installed — try next
    }
  }
  return "zellij";
}

export async function probeZellij(force = false): Promise<ProbeState> {
  if (cached && !force) return cached;

  const started = Date.now();
  const path = await whichZellij();
  const result = await spawnSafe(path, ["--version"], {
    timeoutMs: 3_000,
    maxOutputBytes: 16 * 1024,
  });

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString("utf-8").trim();
    cached = {
      available: false,
      path,
      error: stderr || `exit code ${result.exitCode} (signal: ${result.signal})`,
      probedAt: started,
    };
    log.warn(`zellij probe failed: ${cached.error}`);
    return cached;
  }

  const raw = result.stdout.toString("utf-8").trim();
  const version = parseVersion(raw);

  if (!version) {
    cached = {
      available: false,
      path,
      rawOutput: raw,
      error: `could not parse version from '${raw}'`,
      probedAt: started,
    };
    log.warn(`zellij probe: ${cached.error}`);
    return cached;
  }

  if (compareVersions(version, MIN_VERSION) < 0) {
    cached = {
      available: false,
      path,
      version,
      rawOutput: raw,
      error: `zellij ${version} is older than minimum supported ${MIN_VERSION}`,
      probedAt: started,
    };
    log.warn(`zellij probe: ${cached.error}`);
    return cached;
  }

  cached = { available: true, path, version, rawOutput: raw, probedAt: started };
  log.debug(`zellij probe ok: ${path} v${version} (${Date.now() - started} ms)`);
  return cached;
}

/** Cheap accessor used by tool code. Returns the last probe state, or
 *  probes synchronously (returning `available: false` on ENOENT) if no
 *  probe has run yet. */
export function isZellijAvailable(): boolean {
  return cached?.available ?? false;
}

/** Force-clear the probe cache. Useful in tests. */
export function resetProbe(): void {
  cached = undefined;
}

/** Minimum zellij version this extension supports. */
export const MIN_ZELLIJ_VERSION = MIN_VERSION;
