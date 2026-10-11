/**
 * src/util/truncate.ts — cap model-facing tool output.
 *
 * Matches pi's defaults (50 KB / 2 000 lines) so we don't surprise the
 * runtime. When the input exceeds the cap, the overflow is written to
 * a temp file and the returned `text` ends with a "spilled to /tmp/…"
 * annotation pointing the model at the full output.
 *
 * Synchronous on purpose: the temp file write is fast and the call
 * sites (runZellij) are already inside a Promise — no need for async
 * fs dance.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TruncateOptions {
  maxBytes?: number;
  maxLines?: number;
  tempDir?: string;
  label?: string;
}

export interface SpilledInfo {
  bytes: number;
  lines: number;
  path: string;
}

export interface TruncateResult {
  text: string;
  truncated: boolean;
  spilled: SpilledInfo | null;
}

const DEFAULT_MAX_BYTES = 50_000;
const DEFAULT_MAX_LINES = 2_000;

export function truncate(
  input: string,
  opts: TruncateOptions = {},
): TruncateResult {
  const {
    maxBytes = DEFAULT_MAX_BYTES,
    maxLines = DEFAULT_MAX_LINES,
    tempDir = tmpdir(),
    label = "output",
  } = opts;

  const totalBytes = Buffer.byteLength(input, "utf-8");
  const lines = input.split("\n");
  const totalLines = lines.length;

  const exceedsBytes = totalBytes > maxBytes;
  const exceedsLines = totalLines > maxLines;
  if (!exceedsBytes && !exceedsLines) {
    return { text: input, truncated: false, spilled: null };
  }

  // Cap by whichever limit was hit first; spill the rest.
  const keptLines: string[] = [];
  let keptBytes = 0;
  let cutAt = lines.length;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineBytes = Buffer.byteLength(line, "utf-8") + 1; // +1 for the newline
    if (keptLines.length >= maxLines || keptBytes + lineBytes > maxBytes) {
      cutAt = i;
      break;
    }
    keptLines.push(line);
    keptBytes += lineBytes;
  }

  const droppedLines = lines.slice(cutAt);
  const droppedText = droppedLines.join("\n");
  const droppedBytes = Buffer.byteLength(droppedText, "utf-8");

  // Write overflow to a temp file.
  const dir = mkdtempSync(join(tempDir, "zj-bridge-"));
  const path = join(dir, `${label}.txt`);
  writeFileSync(path, droppedText, "utf-8");

  const keptText = keptLines.join("\n");
  const annotation =
    `\n\n[truncated ${droppedLines.length} lines / ${droppedBytes} bytes — ` +
    `full ${label} at ${path}]`;

  return {
    text: keptText + annotation,
    truncated: true,
    spilled: { bytes: droppedBytes, lines: droppedLines.length, path },
  };
}
