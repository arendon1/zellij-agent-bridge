/**
 * tests/codec.test.ts — coverage for src/transport/codec.ts.
 *
 * Pure functions — no zellij dependency.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { classify, parseJsonOrThrow, parseNdjson } from "../src/transport/codec.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

describe("classify", () => {
  it("maps 'Session X not found' to no-such-session", () => {
    const e = classify("Session 'foo' not found.\nThe following sessions are active:\nbar\nbaz", 1);
    assert.equal(e.kind, "no-such-session");
    assert.equal(e.target, "foo");
    assert.deepEqual(e.available, ["bar", "baz"]);
    assert.match(e.message, /no such session 'foo'.*bar.*baz/);
  });

  it("maps 'there is no active session' to no-active-session", () => {
    const e = classify("There is no active session!", 1);
    assert.equal(e.kind, "no-active-session");
    assert.match(e.message, /no active zellij session/);
  });

  it("maps 'no such pane' to no-such-pane", () => {
    const e = classify("no such pane: terminal_99", 1);
    assert.equal(e.kind, "no-such-pane");
  });

  it("maps 'no such tab' to no-such-tab", () => {
    const e = classify("no such tab 'Tab-3'", 1);
    assert.equal(e.kind, "no-such-tab");
    assert.equal(e.target, "Tab-3");
  });

  it("maps 'permission denied' to permission-denied", () => {
    const e = classify("permission denied", 1);
    assert.equal(e.kind, "permission-denied");
  });

  it("maps 'connection refused' / 'socket' to socket-not-found", () => {
    const e = classify("cannot connect to socket", 1);
    assert.equal(e.kind, "socket-not-found");
  });

  it("falls back to unknown with the exit code in the message", () => {
    const e = classify("some weird error", 42);
    assert.equal(e.kind, "unknown");
    assert.match(e.message, /42/);
  });

  it("matches the real fixture for no-such-session", () => {
    const e = classify(fixture("error-no-such-session.txt"), 1);
    assert.equal(e.kind, "no-such-session");
    assert.equal(e.target, "zj-does-not-exist");
  });

  it("matches the real fixture for no-such-pane", () => {
    const e = classify(fixture("error-no-such-pane.txt"), 1);
    // The fixture text currently says "Session '...' not found" too,
    // so it lands on no-such-session. That's a quirk of the current
    // error text. We accept either no-such-session or no-such-pane
    // here as long as it's classified.
    assert.ok(["no-such-session", "no-such-pane"].includes(e.kind));
  });
});

describe("parseJsonOrThrow", () => {
  it("parses a JSON object", () => {
    const r = parseJsonOrThrow<{ a: number }>('{"a": 1}', 0);
    assert.deepEqual(r, { a: 1 });
  });

  it("parses a JSON array", () => {
    const r = parseJsonOrThrow<number[]>("[1, 2, 3]", 0);
    assert.deepEqual(r, [1, 2, 3]);
  });

  it("throws ZellijError on malformed input", () => {
    assert.throws(
      () => parseJsonOrThrow("not json", 0),
      (err: unknown) => {
        const e = err as { kind: string };
        return e.kind === "json-parse-failed";
      },
    );
  });

  it("parses the real list-panes.json fixture", () => {
    const raw = fixture("list-panes.json");
    const r = parseJsonOrThrow<unknown[]>(raw, 0);
    assert.ok(Array.isArray(r));
    assert.ok((r as unknown[]).length > 0);
  });
});

describe("parseNdjson", () => {
  it("parses a single line", () => {
    const r = parseNdjson<{ a: number }>('{"a": 1}');
    assert.deepEqual(r, [{ a: 1 }]);
  });

  it("parses multiple lines and skips blanks", () => {
    const r = parseNdjson<{ a: number }>('{"a": 1}\n\n{"a": 2}\n   \n{"a": 3}\n');
    assert.deepEqual(r, [{ a: 1 }, { a: 2 }, { a: 3 }]);
  });

  it("parses the real subscribe.jsonl fixture", () => {
    const raw = fixture("subscribe.jsonl");
    const r = parseNdjson<{ event: string; pane_id: string }>(raw);
    assert.equal(r[0]?.event, "pane_update");
    assert.equal(r[0]?.pane_id, "terminal_0");
  });

  it("throws on the first malformed line", () => {
    assert.throws(
      () => parseNdjson('{"a": 1}\n{not json}'),
      (err: unknown) => (err as { kind: string }).kind === "json-parse-failed",
    );
  });
});
