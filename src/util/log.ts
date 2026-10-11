/**
 * src/util/log.ts — debug logger.
 *
 * Off by default. Enable with `ZJ_BRIDGE_DEBUG=1` or `ZJ_BRIDGE_DEBUG=trace`.
 *
 * Output goes to stderr so it doesn't interfere with stdout JSON parsing
 * in cli.ts. Includes ISO timestamp + log level + a `[zj-bridge]` prefix
 * for easy grep.
 *
 * Levels:
 *   error   — always shown (operational failures)
 *   warn    — always shown (recoverable problems)
 *   info    — shown at ZJ_BRIDGE_DEBUG=1 (one-line per tool invocation)
 *   debug   — shown at ZJ_BRIDGE_DEBUG=1 (CLI argv, duration, etc.)
 *   trace   — shown at ZJ_BRIDGE_DEBUG=trace (every spawn, every chunk)
 *
 * No deps. Keeps the bundle minimal.
 */
export {}; // phase 0 — module body intentionally blank