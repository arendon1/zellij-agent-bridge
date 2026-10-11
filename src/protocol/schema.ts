/**
 * src/protocol/schema.ts — TypeBox schemas for the *input* shapes of each
 * tool (parameters) and the *output* shapes (outputSchema).
 *
 * `src/transport/types.ts` defines the data shapes zellij produces.
 * This file defines the surface the agent sees — narrower, with
 * friendlier field names, optional defaults, enums for actions like
 * "resize" direction, etc.
 *
 * Convention:
 *   • Every tool's `parameters` is defined here as a `Type.Object({...})`.
 *   • Every tool's `outputSchema` is defined here as well.
 *   • Tools import their parameter schema by name and pass it directly to
 *     `defineTool({ parameters: FooParams, ... })`.
 */
export {}; // phase 0 — module body intentionally blank