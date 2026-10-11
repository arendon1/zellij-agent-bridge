/**
 * tests/codec.test.ts — coverage for src/transport/codec.ts.
 *
 * Pure functions — no zellij dependency. Phase 1 will fill these in.
 *
 * Planned tests:
 *
 *   • `parseJsonOrThrow` accepts valid PaneInfo[] from fixtures/.
 *   • `parseJsonOrThrow` rejects malformed JSON with a clear error.
 *   • `parseNdjson` accepts mixed-shape NDJSON (one event per line).
 *   • `parseNdjson` skips blank lines.
 *   • `parseNdjson` returns [] on empty input.
 *   • `classify` maps "no such session: foo" → "no-such-session".
 *   • `classify` maps "no such pane: terminal_99" → "no-such-pane".
 *   • `classify` maps "permission denied" → "permission-denied".
 *   • `classify` returns "unknown" for unrecognized stderr.
 *
 * Validation pattern:
 *
 *   import { Type } from "typebox";
 *   import { Value } from "@sinclair/typebox/value";
 *
 *   const result = parseJsonOrThrow(fixtureString, PaneInfoList);
 *   if (!Value.Check(PaneInfoList, result)) throw new Error("schema mismatch");
 */
export {}; // phase 0 — module body intentionally blank