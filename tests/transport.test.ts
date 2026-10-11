/**
 * tests/transport.test.ts — coverage for src/transport/cli.ts.
 *
 * Uses a real zellij session when available:
 *   • uses the existing `zj-fixtures` session if it exists
 *   • otherwise creates a temporary `zj-test` session
 *   • cleans up the temp session in `after()`
 *
 * Run with: `node --test --experimental-strip-types tests/transport.test.ts`
 */

import { describe, it, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runZellij, runZellijStreaming } from "../src/transport/cli.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(__dirname, "fixtures");

function zellijAvailable(): boolean {
  if (process.env["ZJ_BRIDGE_SKIP_INTEGRATION"] === "1") return false;
  const r = spawnSync("zellij", ["--version"], { stdio: "pipe" });
  return r.status === 0;
}

function listSessionNames(): string[] {
  const r = spawnSync("zellij", ["list-sessions"], { stdio: "pipe" });
  const text = r.stdout.toString("utf-8").replace(/\x1b\[[0-9;]*m/g, "");
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.includes("EXITED"))
    .map((l) => l.split(/\s+/)[0]!)
    .filter(Boolean);
}

async function findOrCreateSession(): Promise<{ name: string; created: boolean }> {
  const existing = listSessionNames();
  if (existing.includes("zj-fixtures")) return { name: "zj-fixtures", created: false };
  if (existing.length > 0) return { name: existing[0]!, created: false };
  spawnSync(
    "zellij",
    ["attach", "-b", "-c", "zj-test", "--", "sh", "-c", "sleep 120"],
    { stdio: "ignore" },
  );
  // Wait up to 5s for the session to appear.
  for (let i = 0; i < 50; i++) {
    if (listSessionNames().includes("zj-test")) return { name: "zj-test", created: true };
    await new Promise((r) => setTimeout(r, 100));
  }
  return { name: "", created: false };
}

function fixture(name: string): string {
  return readFileSync(join(FIXTURES, name), "utf-8");
}

const SKIP_LIVE = !zellijAvailable() || process.env["ZJ_BRIDGE_FAKE"] === "1";

describe("runZellij (live)", { skip: SKIP_LIVE }, () => {
  let session = "";
  let created = false;

  before(async () => {
    const r = await findOrCreateSession();
    session = r.name;
    created = r.created;
  });

  after(() => {
    if (created && session) {
      spawnSync("zellij", ["kill-session", session], { stdio: "ignore" });
    }
  });

  it("runs `list-sessions` and returns stdout", async () => {
    const r = await runZellij(["list-sessions"]);
    assert.equal(r.exitCode, 0);
    assert.ok(r.stdout.length > 0, "expected some stdout");
  });

  it("classifies a no-such-session error", async () => {
    const r = await runZellij(["--session", "zj-does-not-exist", "action", "list-panes", "--json"], {
      expectJson: true,
    });
    assert.notEqual(r.exitCode, 0);
    assert.ok(r.classified, "expected a classified error");
    assert.equal(r.classified!.kind, "no-such-session");
    assert.match(r.classified!.message, /no such session 'zj-does-not-exist'/);
  });

  it("parses `list-panes --json` against the real zellij output", async () => {
    if (!session) throw new Error("no zellij session available");
    const r = await runZellij(
      ["--session", session, "action", "list-panes", "--json"],
      { expectJson: true },
    );
    assert.equal(r.exitCode, 0, `unexpected exit; stderr=${r.stderr}; stdout=${r.stdout.slice(0, 200)}`);
    assert.ok(Array.isArray(r.parsed));
    const panes = r.parsed as Array<{ id: number; title: string; is_plugin: boolean }>;
    assert.ok(panes.length > 0, "expected at least one pane");
    for (const p of panes) {
      assert.equal(typeof p.id, "number");
      assert.equal(typeof p.title, "string");
      assert.equal(typeof p.is_plugin, "boolean");
    }
  });
});

describe("runZellij (fixture mode)", { skip: !process.env["ZJ_BRIDGE_FAKE"] && !SKIP_LIVE }, () => {
  it("matches list-panes.json against the PaneInfo TypeBox schema", async () => {
    const { Value } = await import("typebox/value");
    const { PaneInfo } = await import("../src/transport/types.ts");
    const raw = fixture("list-panes.json");
    const parsed = JSON.parse(raw);
    for (const pane of parsed) {
      assert.ok(Value.Check(PaneInfo, pane), `pane ${pane.id} did not match PaneInfo schema`);
    }
  });

  it("matches list-tabs.json against the TabInfo schema", async () => {
    const { Value } = await import("typebox/value");
    const { TabInfo } = await import("../src/transport/types.ts");
    const raw = fixture("list-tabs.json");
    const parsed = JSON.parse(raw);
    for (const tab of parsed) {
      assert.ok(Value.Check(TabInfo, tab), `tab ${tab.tab_id} did not match TabInfo schema`);
    }
  });

  it("matches subscribe.jsonl against the SubscribeEvent schema", async () => {
    const { Value } = await import("typebox/value");
    const { SubscribeEvent } = await import("../src/transport/types.ts");
    const raw = fixture("subscribe.jsonl");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line);
      assert.ok(Value.Check(SubscribeEvent, ev), `event did not match SubscribeEvent schema: ${line}`);
    }
  });
});

describe("runZellijStreaming", { skip: SKIP_LIVE }, () => {
  it("yields initial viewport and exits cleanly", async () => {
    const { name } = await findOrCreateSession();
    if (!name) throw new Error("no zellij session available");
    const list = await runZellij(
      ["--session", name, "action", "list-panes", "--json"],
      { expectJson: true },
    );
    if (list.classified) throw new Error(`list-panes failed: ${list.classified.message}`);
    const panes = list.parsed as Array<{ id: number; is_plugin: boolean }>;
    const target = panes.find((p) => !p.is_plugin);
    if (!target) throw new Error("no non-plugin pane to subscribe to");

    const events: unknown[] = [];
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 1500);
    try {
      for await (const ev of runZellijStreaming(
        ["--session", name, "subscribe", "--format", "json", "--pane-id", String(target.id)],
        {},
        ac.signal,
      )) {
        events.push(ev);
      }
    } catch {
      // abort is fine
    }
    assert.ok(events.length > 0, "expected at least one initial event");
  });
});
