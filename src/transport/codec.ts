/**
 * src/transport/codec.ts — JSON / NDJSON parsing + zellij-shaped error
 * mapping.
 *
 * Zellij's CLI is pretty good about returning non-zero exit codes for
 * failures, but the message text is free-form. This module normalizes
 * those messages into typed errors the model can act on (e.g. "no such
 * session 'foo' — available: [a, b, c]") instead of dumping raw stderr.
 *
 * Planned exports (phase 1):
 *
 *   export type ZellijErrorKind =
 *     | "no-such-session"
 *     | "no-such-pane"
 *     | "no-such-tab"
 *     | "permission-denied"
 *     | "socket-not-found"
 *     | "version-mismatch"
 *     | "unknown";
 *
 *   export interface ZellijError {
 *     kind: ZellijErrorKind;
 *     message: string;     // human-readable
 *     raw: string;         // original stderr
 *     exitCode: number;
 *   }
 *
 *   export function classify(stderr: string, exitCode: number): ZellijError;
 *
 *   export function parseJsonOrThrow<T>(stdout: string, schema: TSchema): T;
 *
 *   export function parseNdjson<T>(stdout: string): T[];
 *
 * The NDJSON parser is shared with the streaming variant in cli.ts.
 */
export {}; // phase 0 — module body intentionally blank