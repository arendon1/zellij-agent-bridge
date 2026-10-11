/**
 * tests/envelopes.test.ts — coverage for src/protocol/envelopes.ts.
 *
 * Tests the `toCli` (pure argv construction) and `fromCli` (pure
 * result shaping) halves in isolation, then a few end-to-end calls
 * against a live zellij.
 */

import { describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";

import {
  env_listSessions,
  env_listPanes,
  env_listTabs,
  env_killSession,
  env_newPane,
  env_attach,
  env_writeChars,
  env_subscribe,
  env_version,
  env_applyLayout,
  env_renameTab,
  env_gotoTab,
  env_newTab,
  env_closeTab,
  env_focusPane,
  env_resizePane,
  env_movePane,
  env_sendKeys,
  env_paste,
  env_queryTabNames,
  env_listClients,
  env_dumpScreen,
  env_dumpLayout,
  env_renamePane,
  env_currentTabInfo,
  env_moveFocus,
  env_killAllSessions,
  callEnvelope,
  type Envelope,
} from "../src/protocol/envelopes.ts";

function zellijAvailable(): boolean {
  if (process.env["ZJ_BRIDGE_SKIP_INTEGRATION"] === "1") return false;
  const r = spawnSync("zellij", ["--version"], { stdio: "pipe" });
  return r.status === 0;
}

const live = zellijAvailable() && !process.env["ZJ_BRIDGE_FAKE"];

describe("toCli — pure argv construction", () => {
  it("env_listSessions → ['list-sessions']", () => {
    assert.deepEqual(env_listSessions.toCli({}).args, ["list-sessions"]);
  });

  it("env_listPanes includes the JSON flag and any extras", () => {
    const { args, opts } = env_listPanes.toCli({ tab: true, geometry: true });
    assert.deepEqual(args, ["action", "list-panes", "--json", "--tab", "--geometry"]);
    assert.equal(opts?.expectJson, true);
  });

  it("env_killSession takes the session name", () => {
    assert.deepEqual(env_killSession.toCli({ name: "foo" }).args, ["kill-session", "foo"]);
  });

  it("env_killAllSessions adds --yes when requested", () => {
    const a = env_killAllSessions.toCli({});
    assert.deepEqual(a.args, ["kill-all-sessions"]);
    const b = env_killAllSessions.toCli({ yes: true });
    assert.deepEqual(b.args, ["kill-all-sessions", "--yes"]);
  });

  it("env_attach builds attach flags correctly", () => {
    const a = env_attach.toCli({ create: true, background: true, name: "s1" });
    assert.deepEqual(a.args, ["attach", "--create", "--create-background", "s1"]);
  });

  it("env_newPane turns options into `zellij run` flags", () => {
    const a = env_newPane.toCli({
      direction: "down",
      name: "build",
      cwd: "/repo",
      command: "make",
    });
    assert.deepEqual(a.args, [
      "run",
      "-d",
      "--name", "build",
      "--cwd", "/repo",
      "--", "make",
    ]);
  });

  it("env_writeChars produces write-chars with the right pane", () => {
    const a = env_writeChars.toCli({ paneId: 3, chars: "hello" });
    assert.deepEqual(a.args, ["action", "write-chars", "hello", "--pane-id", "3"]);
  });

  it("env_subscribe turns options into subscribe flags", () => {
    const a = env_subscribe.toCli({ paneId: 0, scrollback: 100, ansi: true });
    assert.deepEqual(a.args, [
      "subscribe", "--format", "json", "--pane-id", "0",
      "--scrollback", "100", "--ansi",
    ]);
  });

  it("env_applyLayout chooses --layout-string vs --layout", () => {
    const a = env_applyLayout.toCli({ kdl: "pane {}", retainTerminalPanes: true });
    assert.deepEqual(a.args, [
      "action", "override-layout",
      "--layout-string", "pane {}",
      "--retain-existing-terminal-panes",
    ]);
  });

  it("env_renameTab falls back to rename-tab without an id", () => {
    const a = env_renameTab.toCli({ name: "build" });
    assert.deepEqual(a.args, ["action", "rename-tab", "build"]);
    const b = env_renameTab.toCli({ tabId: 7, name: "build" });
    assert.deepEqual(b.args, ["action", "rename-tab-by-id", "7", "build"]);
  });

  it("env_gotoTab routes by id / index / name", () => {
    assert.deepEqual(env_gotoTab.toCli({ index: 2 }).args, ["action", "go-to-tab", "2"]);
    assert.deepEqual(env_gotoTab.toCli({ tabId: 7 }).args, ["action", "go-to-tab-by-id", "7"]);
    assert.deepEqual(env_gotoTab.toCli({ name: "build" }).args, ["action", "go-to-tab-name", "build"]);
    assert.deepEqual(env_gotoTab.toCli({ name: "build", create: true }).args, [
      "action", "go-to-tab-name", "build", "--create",
    ]);
  });

  it("env_newTab includes --name and --cwd when given", () => {
    const a = env_newTab.toCli({ name: "shards", cwd: "/repo" });
    assert.deepEqual(a.args, ["action", "new-tab", "--name", "shards", "--cwd", "/repo"]);
  });

  it("env_closeTab routes to by-id when given", () => {
    assert.deepEqual(env_closeTab.toCli({}).args, ["action", "close-tab"]);
    assert.deepEqual(env_closeTab.toCli({ tabId: 4 }).args, ["action", "close-tab-by-id", "4"]);
  });

  it("env_focusPane / env_resizePane / env_movePane / env_moveFocus use --pane-id and direction", () => {
    assert.deepEqual(env_focusPane.toCli({ paneId: 3 }).args, ["action", "focus-pane-id", "3"]);
    assert.deepEqual(env_resizePane.toCli({ direction: "left" }).args, ["action", "resize", "left"]);
    assert.deepEqual(env_movePane.toCli({ direction: "right" }).args, ["action", "move-pane", "right"]);
    assert.deepEqual(env_moveFocus.toCli({ direction: "up" }).args, ["action", "move-focus", "up"]);
  });

  it("env_sendKeys flattens comma-separated keys", () => {
    assert.deepEqual(
      env_sendKeys.toCli({ paneId: 0, keys: ["Ctrl a", "Ctrl c"] }).args,
      ["action", "send-keys", "Ctrl a", "Ctrl c", "--pane-id", "0"],
    );
  });

  it("env_paste uses paste subcommand", () => {
    assert.deepEqual(env_paste.toCli({ paneId: 0, text: "x" }).args, [
      "action", "paste", "x", "--pane-id", "0",
    ]);
  });

  it("env_renamePane uses rename-pane with --pane-id", () => {
    assert.deepEqual(env_renamePane.toCli({ paneId: 0, name: "x" }).args, [
      "action", "rename-pane", "--pane-id", "0", "x",
    ]);
  });

  it("env_listTabs / env_currentTabInfo / env_queryTabNames / env_listClients / env_dumpScreen / env_dumpLayout are pure", () => {
    assert.deepEqual(env_listTabs.toCli({}).args, ["action", "list-tabs", "--json"]);
    assert.deepEqual(env_currentTabInfo.toCli({}).args, ["action", "current-tab-info", "--json"]);
    assert.deepEqual(env_queryTabNames.toCli({}).args, ["action", "query-tab-names"]);
    assert.deepEqual(env_listClients.toCli({}).args, ["action", "list-clients"]);
    assert.deepEqual(env_dumpScreen.toCli({ paneId: 0 }).args, ["action", "dump-screen", "--pane-id", "0"]);
    assert.deepEqual(env_dumpLayout.toCli({}).args, ["action", "dump-layout"]);
  });

  it("env_version is just --version", () => {
    assert.deepEqual(env_version.toCli({}).args, ["--version"]);
  });
});

describe("fromCli — pure result shaping", () => {
  function res(stdout: string, exitCode = 0, classified?: { kind: string; message: string }): Parameters<Envelope<unknown, unknown>["fromCli"]>[0] {
    return {
      stdout,
      stderr: "",
      exitCode,
      signal: null,
      durationMs: 0,
      classified: classified as never,
    };
  }

  it("env_version extracts a semver string", () => {
    const v = env_version.fromCli(res("zellij 0.45.1\n"));
    assert.equal(v.version, "0.45.1");
  });

  it("env_listSessions strips ANSI and keeps first word per line", () => {
    const v = env_listSessions.fromCli(res("\x1b[32;1mfoo\x1b[m active\n\x1b[32;1mbar\x1b[m active\n"));
    assert.deepEqual(v, ["foo", "bar"]);
  });

  it("env_listClients parses the tab-separated table", () => {
    const v = env_listClients.fromCli(res("CLIENT_ID ZELLIJ_PANE_ID RUNNING_COMMAND\n1 terminal_0 bash\n"));
    assert.deepEqual(v, [{ clientId: 1, paneId: "terminal_0", runningCommand: "bash" }]);
  });

  it("env_queryTabNames splits lines and trims", () => {
    const v = env_queryTabNames.fromCli(res("Tab #1\nTab #2\n"));
    assert.deepEqual(v, ["Tab #1", "Tab #2"]);
  });

  it("env_killSession throws on classified", () => {
    assert.throws(
      () => env_killSession.fromCli(res("", 1, { kind: "no-such-session", message: "no such session" } as never)),
    );
  });
});

describe("callEnvelope (live)", { skip: !live }, () => {
  it("env_version returns the real version", async () => {
    const v = await callEnvelope(env_version, {});
    assert.match(v.version, /^\d+\.\d+\.\d+/);
  });

  it("env_listSessions returns an array", async () => {
    const v = await callEnvelope(env_listSessions, {});
    assert.ok(Array.isArray(v));
  });
});
