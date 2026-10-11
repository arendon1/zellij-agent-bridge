/**
 * src/util/log.ts — debug logger.
 *
 * Off by default. Enable with `ZJ_BRIDGE_DEBUG=1` (info+debug+trace) or
 * `ZJ_BRIDGE_DEBUG=trace` (everything). Errors and warnings are always
 * shown — they're operational failures the user needs to see.
 *
 * Output goes to stderr so it never interferes with stdout JSON parsing
 * in cli.ts. Format: `ISO-timestamp [level] [zj-bridge] message`.
 *
 * No deps. Keeps the bundle minimal.
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3, trace: 4 } as const;
type Level = keyof typeof LEVELS;

const env = process.env["ZJ_BRIDGE_DEBUG"] ?? "";
const envLevel: Level =
  env === "trace" ? "trace" :
  env === "1" || env === "true" || env === "debug" ? "debug" :
  env === "info" ? "info" :
  "warn"; // errors and warnings are always shown

function activeThreshold(): number {
  return LEVELS[envLevel];
}

function emit(level: Level, args: unknown[]): void {
  if (LEVELS[level] > activeThreshold()) return;
  const ts = new Date().toISOString();
  const text = args
    .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
    .join(" ");
  process.stderr.write(`${ts} [${level}] [zj-bridge] ${text}\n`);
}

export const log = {
  error: (...args: unknown[]) => emit("error", args),
  warn:  (...args: unknown[]) => emit("warn",  args),
  info:  (...args: unknown[]) => emit("info",  args),
  debug: (...args: unknown[]) => emit("debug", args),
  trace: (...args: unknown[]) => emit("trace", args),
  /** Current effective level. Useful for tests and the zj_doctor tool. */
  level: (): Level => envLevel,
};
