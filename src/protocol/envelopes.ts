/**
 * src/protocol/envelopes.ts — typed envelopes for the "intent → wire call"
 * boundary. Keeps tool code from constructing raw argv arrays.
 *
 * Each envelope is a pure function: takes typed input, returns the
 * zellij CLI argv + options. The transport layer doesn't care about types;
 * it just runs `zellij <argv...>`.
 *
 * Planned shape (phase 1+):
 *
 *   export interface Envelope<TInput, TOutput> {
 *     toCli(input: TInput): { args: string[]; opts?: ZellijRunOptions };
 *     fromCli(result: ZellijRunResult): TOutput;
 *   }
 *
 *   export const zjListPanes: Envelope<{ session?: string; tab?: boolean; ... }, PaneInfoT[]>;
 *   export const zjListTabs:  Envelope<{ ... }, TabInfoT[]>;
 *   export const zjDumpScreen: Envelope<{ paneId: PaneId; full?: boolean }, string>;
 *   export const zjDumpLayout: Envelope<{}, string>;
 *   export const zjWriteChars: Envelope<{ paneId: PaneId; chars: string }, void>;
 *   export const zjSendKeys:   Envelope<{ paneId: PaneId; keys: string[] }, void>;
 *   ...etc.
 *
 * This indirection pays off when we swap to the protobuf transport in v2:
 * the tool layer doesn't change.
 */
export {}; // phase 0 — module body intentionally blank