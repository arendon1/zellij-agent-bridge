/**
 * src/util/stream.ts — NDJSON line parser.
 *
 * Used by `runZellijStreaming` to turn the byte stream from a
 * `zellij subscribe --format json` subprocess into a stream of parsed
 * events. Also exported for tests and for any future tool that wants
 * to subscribe directly.
 *
 * The parser handles partial lines: if a chunk ends mid-line, the
 * remainder is buffered until the next chunk arrives.
 */

export async function* parseNdjsonStream(
  source: AsyncIterable<Buffer>,
): AsyncGenerator<unknown, void, void> {
  let buffer = "";
  for await (const chunk of source) {
    buffer += chunk.toString("utf-8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        yield JSON.parse(line);
      } catch (err) {
        // Skip malformed lines; they shouldn't break the stream.
        // Surface via stderr for debugging.
        process.stderr.write(
          `[zj-bridge] ndjson: skipping malformed line: ${line.slice(0, 80)}\n`,
        );
      }
    }
  }
  // Flush any trailing buffer that didn't end with a newline.
  const tail = buffer.trim();
  if (tail) {
    try {
      yield JSON.parse(tail);
    } catch {
      process.stderr.write(
        `[zj-bridge] ndjson: discarding trailing bytes: ${tail.slice(0, 80)}\n`,
      );
    }
  }
}
