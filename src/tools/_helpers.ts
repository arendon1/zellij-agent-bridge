/**
 * src/tools/_helpers.ts — shared utilities for tool implementations.
 *
 * Centralizes error-shape conversion and the session-name resolution
 * so every tool returns the same `isError: true` result on failure
 * and uses the same precedence for which zellij session to target.
 *
 * Session precedence (highest first):
 *   1. params.session  (model passed an override)
 *   2. ZELLIJ_SESSION_NAME env var (the session the agent pane lives in)
 *   3. omitted from the envelope call (zellij auto-targets current session)
 */

import type { AgentToolResult } from "@earendil-works/pi-coding-agent";
import type { ZellijError } from "../transport/codec.ts";
import type { SessionName } from "../types.ts";

/** Type guard for ZellijError (or any {kind: string} error). */
export function isZellijError(err: unknown): err is ZellijError {
  return (
    typeof err === "object" &&
    err !== null &&
    "kind" in err &&
    typeof (err as { kind: unknown }).kind === "string"
  );
}

/** Convert a thrown error into an AgentToolResult the model can read. */
export function errorResult(
  err: unknown,
): AgentToolResult<{ error: { kind: string; message: string } }> {
  if (isZellijError(err)) {
    return {
      content: [{ type: "text", text: `error: ${err.message}` }],
      details: { error: { kind: err.kind, message: err.message } },
      isError: true,
    };
  }
  const msg = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text", text: `error: ${msg}` }],
    details: { error: { kind: "unknown", message: msg } },
    isError: true,
  };
}

/** Build a successful AgentToolResult with both text and structured content. */
export function okResult<T>(
  text: string,
  value: T,
): AgentToolResult<T> {
  const result: AgentToolResult<T> = {
    content: [{ type: "text", text }],
    details: value,
  };
  // structuredContent is set when outputSchema is declared. The model
  // gets the one-liner in `content`; programmatic callers get the
  // structured data here.
  (result as { structuredContent?: unknown }).structuredContent = value as unknown;
  return result;
}

/**
 * Resolve which zellij session a tool call should target. Returns
 * `undefined` to let zellij auto-target the current session.
 */
export function getSession(override?: string | null): SessionName | undefined {
  if (override) return override;
  const env = process.env["ZELLIJ_SESSION_NAME"];
  return env && env.length > 0 ? env : undefined;
}

/** Build a TypeBox optional session field for tool parameters. */
export const SessionParam = {
  session: {
    type: "string" as const,
    description: "Target zellij session name. Omit to act on the current session.",
  },
};
