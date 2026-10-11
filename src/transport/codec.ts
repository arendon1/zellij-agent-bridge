/**
 * src/transport/codec.ts — JSON / NDJSON parsing + zellij-shaped error
 * mapping.
 *
 * Zellij's CLI returns non-zero exit codes on failures but the stderr
 * text is free-form. This module normalizes those messages into typed
 * errors the model can act on (e.g. "no such session 'foo' — available:
 * [a, b, c]") instead of dumping raw stderr.
 *
 * The classifier is regex-based and tested against fixtures in
 * tests/codec.test.ts. Add a new pattern when a zellij error surfaces
 * that the model needs to handle differently.
 */

export type ZellijErrorKind =
  | "no-such-session"
  | "no-such-pane"
  | "no-such-tab"
  | "permission-denied"
  | "socket-not-found"
  | "version-mismatch"
  | "json-parse-failed"
  | "no-active-session"
  | "missing-argument"
  | "unknown";

export interface ZellijError {
  kind: ZellijErrorKind;
  /** Human-readable message. */
  message: string;
  /** Original stderr. */
  raw: string;
  /** zellij exit code. */
  exitCode: number;
  /** When the kind is one of the "no-such" variants, the name that wasn't found. */
  target?: string;
  /** When the kind is "no-such-session", the list of available sessions. */
  available?: string[];
}

interface ClassifierRule {
  kind: ZellijErrorKind;
  match: (stderr: string, exitCode: number) => boolean;
  /** Optional extractor for the target/available fields. */
  extract?: (stderr: string) => { target?: string; available?: string[] };
  /** Format the human message. */
  format: (stderr: string, target?: string, available?: string[]) => string;
}

const RULES: ClassifierRule[] = [
  {
    kind: "no-such-session",
    match: (s) => /^Session '([^']+)' not found\./.test(s),
    extract: (s) => {
      const m = s.match(/^Session '([^']+)' not found\.\s*(?:The following sessions are active:\s*)?([\s\S]*)$/);
      if (!m) return {};
      const available = (m[2] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
      const out: { target?: string; available?: string[] } = {};
      if (m[1]) out.target = m[1];
      if (available.length) out.available = available;
      return out;
    },
    format: (_s, target, available) =>
      available && available.length
        ? `no such session '${target}' — available: [${available.join(", ")}]`
        : `no such session '${target}'`,
  },
  {
    kind: "no-such-pane",
    match: (s) => /no such pane|unknown pane|pane not found|invalid pane/i.test(s),
    extract: (s) => {
      const m = s.match(/(?:no such pane|unknown pane|pane not found|invalid pane)['":]?\s*['":]?([A-Za-z0-9_-]+)?['":]?/i);
      const out: { target?: string } = {};
      if (m?.[1]) out.target = m[1].replace(/['"]/g, "");
      return out;
    },
    format: (s, target) =>
      target
        ? `no such pane '${target}'`
        : `no such pane (zellij said: ${s.split("\n")[0]})`,
  },
  {
    kind: "no-such-tab",
    match: (s) => /no such tab|unknown tab|tab not found|invalid tab/i.test(s),
    extract: (s) => {
      const m = s.match(/(?:no such tab|unknown tab|tab not found|invalid tab)['":]?\s*['":]?(\S+?)['":]?$/im);
      const out: { target?: string } = {};
      if (m?.[1]) out.target = m[1].replace(/['"]/g, "");
      return out;
    },
    format: (s, target) =>
      target ? `no such tab '${target}'` : `no such tab (zellij said: ${s.split("\n")[0]})`,
  },
  {
    kind: "no-active-session",
    match: (s) => /there is no active session/i.test(s),
    format: () => "no active zellij session — start one with `zellij` or use zj_session_new",
  },
  {
    kind: "permission-denied",
    match: (s) => /permission denied|operation not permitted/i.test(s),
    format: (s) => `permission denied: ${s.split("\n")[0]}`,
  },
  {
    kind: "socket-not-found",
    match: (s) => /no such file|cannot connect|socket|connection refused/i.test(s),
    format: (s) => `cannot reach zellij server: ${s.split("\n")[0]}`,
  },
  {
    kind: "missing-argument",
    match: (s) => /missing argument|required.*argument|usage:/i.test(s),
    format: (s) => `missing or invalid argument: ${s.split("\n")[0]}`,
  },
  {
    kind: "version-mismatch",
    match: (s) => /version|incompatible|protocol/i.test(s),
    format: (s) => `zellij version mismatch: ${s.split("\n")[0]}`,
  },
];

export function classify(stderr: string, exitCode: number, _session?: string): ZellijError {
  const trimmed = stderr.trim() || `(no stderr; exit code ${exitCode})`;
  for (const rule of RULES) {
    if (rule.match(trimmed, exitCode)) {
      const { target, available } = rule.extract?.(trimmed) ?? {};
      return {
        kind: rule.kind,
        message: rule.format(trimmed, target, available),
        raw: stderr,
        exitCode,
        ...(target !== undefined ? { target } : {}),
        ...(available !== undefined ? { available } : {}),
      };
    }
  }
  return {
    kind: "unknown",
    message: `zellij exited with code ${exitCode}: ${trimmed.split("\n")[0]}`,
    raw: stderr,
    exitCode,
  };
}

/**
 * Parse stdout as JSON, throwing a ZellijError on failure.
 * Use for `zellij --json` outputs.
 */
export function parseJsonOrThrow<T = unknown>(stdout: string, exitCode: number): T {
  try {
    return JSON.parse(stdout) as T;
  } catch (err) {
    throw {
      kind: "json-parse-failed",
      message: `zellij output was not valid JSON: ${(err as Error).message}`,
      raw: stdout.slice(0, 500),
      exitCode,
    } satisfies ZellijError;
  }
}

/**
 * Parse a multi-line NDJSON string into an array of parsed events.
 * Skips blank lines silently. Throws on the first malformed line.
 */
export function parseNdjson<T = unknown>(stdout: string): T[] {
  const events: T[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as T);
    } catch (err) {
      throw {
        kind: "json-parse-failed",
        message: `malformed NDJSON line '${trimmed.slice(0, 80)}': ${(err as Error).message}`,
        raw: trimmed,
        exitCode: 0,
      } satisfies ZellijError;
    }
  }
  return events;
}
