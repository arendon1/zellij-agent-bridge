/**
 * src/protocol/envelopes.ts — typed envelopes for the "intent → wire
 * call" boundary.
 *
 * Each envelope is a pure function pair: takes typed input, returns
 * the zellij CLI argv + options; takes a runZellij result, returns a
 * typed value. Tools import envelopes by name and call them through
 * `callEnvelope(env, input)` (defined at the bottom).
 *
 * The Envelope type is the seam that lets a future v2 swap the CLI
 * for a direct UDS-protobuf client: tools keep using the same Envelope
 * signatures, only the underlying transport changes.
 *
 * Naming convention: every export is prefixed `env_` and corresponds
 * 1:1 with a tool (or a group of tools that share a CliAction).
 */

import { runZellij, type ZellijRunOptions, type ZellijRunResult } from "../transport/cli.ts";
import { classify, type ZellijError } from "../transport/codec.ts";
import type { PaneInfoT, TabInfoT } from "../transport/types.ts";
import type { SessionName, PaneId, TabId } from "../types.ts";

/**
 * One envelope per CliAction (or group of closely related actions).
 *
 * `toCli` is pure: input → argv + run-options. `fromCli` takes a
 * `ZellijRunResult` and returns a typed value (or throws the
 * classified `ZellijError` when the call failed).
 */
export interface Envelope<TIn, TOut> {
  toCli(input: TIn): { args: string[]; opts?: Omit<ZellijRunOptions, "session"> };
  fromCli(result: ZellijRunResult): TOut;
}

// ---------- Helpers ----------

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Build session-scoped run options; used by callEnvelope. */
function sessionOpt(session?: SessionName): Partial<ZellijRunOptions> {
  return session ? { session } : {};
}

// ---------- Session group ----------

export const env_listSessions: Envelope<Record<string, never>, string[]> = {
  toCli() {
    return { args: ["list-sessions"], opts: { expectJson: false } };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return stripAnsi(result.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .map((l) => l.split(/\s+/)[0]!)
      .filter(Boolean);
  },
};

export const env_killSession: Envelope<{ name: string }, { killed: string }> = {
  toCli({ name }) {
    return { args: ["kill-session", name] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { killed: result.stdout.trim() || "(killed)" };
  },
};

export const env_killAllSessions: Envelope<{ yes?: boolean }, { killed: boolean }> = {
  toCli({ yes }) {
    return { args: ["kill-all-sessions", ...(yes ? ["--yes"] : [])] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { killed: true };
  },
};

export const env_attach: Envelope<
  { name?: string; create?: boolean; background?: boolean; command?: string },
  { session: string }
> = {
  toCli({ name, create, background, command }) {
    const args: string[] = ["attach"];
    if (create) args.push("--create");
    if (background) args.push("--create-background");
    if (name) args.push(name);
    if (command) args.push("--", command);
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { session: result.stdout.trim() || "(attached)" };
  },
};

export const env_renameSession: Envelope<{ name: string }, { name: string }> = {
  toCli({ name }) {
    return { args: ["action", "rename-session", name] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { name: result.stdout.trim() };
  },
};

// ---------- `zellij action` reads ----------

export const env_listPanes: Envelope<
  { tab?: boolean; command?: boolean; state?: boolean; geometry?: boolean; all?: boolean },
  PaneInfoT[]
> = {
  toCli({ tab, command, state, geometry, all }) {
    const args = ["action", "list-panes", "--json"];
    if (tab) args.push("--tab");
    if (command) args.push("--command");
    if (state) args.push("--state");
    if (geometry) args.push("--geometry");
    if (all) args.push("--all");
    return { args, opts: { expectJson: true } };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return result.parsed as PaneInfoT[];
  },
};

export const env_listTabs: Envelope<
  { state?: boolean; dimensions?: boolean; panes?: boolean; layout?: boolean; all?: boolean },
  TabInfoT[]
> = {
  toCli({ state, dimensions, panes, layout, all }) {
    const args = ["action", "list-tabs", "--json"];
    if (state) args.push("--state");
    if (dimensions) args.push("--dimensions");
    if (panes) args.push("--panes");
    if (layout) args.push("--layout");
    if (all) args.push("--all");
    return { args, opts: { expectJson: true } };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return result.parsed as TabInfoT[];
  },
};

export const env_currentTabInfo: Envelope<Record<string, never>, TabInfoT> = {
  toCli() {
    return { args: ["action", "current-tab-info", "--json"], opts: { expectJson: true } };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return result.parsed as TabInfoT;
  },
};

export const env_listClients: Envelope<
  Record<string, never>,
  { clientId: number; paneId: string; runningCommand: string }[]
> = {
  toCli() {
    return { args: ["action", "list-clients"] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    const lines = stripAnsi(result.stdout || "")
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (lines.length <= 1) return [];
    return lines.slice(1).map((line) => {
      const [cid = "", pid = "", cmd = ""] = line.split(/\s+/);
      return {
        clientId: Number.parseInt(cid, 10) || 0,
        paneId: pid,
        runningCommand: cmd,
      };
    });
  },
};

export const env_queryTabNames: Envelope<Record<string, never>, string[]> = {
  toCli() {
    return { args: ["action", "query-tab-names"] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return stripAnsi(result.stdout)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  },
};

export const env_dumpScreen: Envelope<
  { paneId: PaneId; full?: boolean; ansi?: boolean; path?: string },
  string
> = {
  toCli({ paneId, full, ansi, path }) {
    const args = ["action", "dump-screen", "--pane-id", String(paneId)];
    if (full) args.push("--full");
    if (ansi) args.push("--ansi");
    if (path) args.push("--path", path);
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return result.stdout;
  },
};

export const env_dumpLayout: Envelope<Record<string, never>, string> = {
  toCli() {
    return { args: ["action", "dump-layout"] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return result.stdout;
  },
};

// ---------- Pane mutation ----------

export const env_newPane: Envelope<
  {
    direction?: "right" | "down";
    floating?: boolean;
    inPlace?: boolean;
    blocking?: boolean;
    closeOnExit?: boolean;
    startSuspended?: boolean;
    name?: string;
    cwd?: string;
    command?: string;
  },
  { command: string; spawnedAt: number }
> = {
  toCli({ direction, floating, inPlace, blocking, closeOnExit, startSuspended, name, cwd, command }) {
    const args = ["run"];
    if (direction === "down" || direction === "right") args.push("-d");
    if (floating) args.push("-f");
    if (inPlace) args.push("-i");
    if (name) args.push("--name", name);
    if (cwd) args.push("--cwd", cwd);
    if (closeOnExit) args.push("--close-on-exit");
    if (startSuspended) args.push("--start-suspended");
    if (blocking) args.push("--blocking");
    args.push("--", command ?? "sh");
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return {
      command: result.stdout.trim(),
      spawnedAt: Date.now(),
    };
  },
};

export const env_closePane: Envelope<{ paneId: PaneId }, { closed: PaneId }> = {
  toCli({ paneId }) {
    return { args: ["action", "close-pane", "--pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { closed: "" as PaneId };
  },
};

export const env_focusPane: Envelope<{ paneId: PaneId }, { focused: PaneId }> = {
  toCli({ paneId }) {
    return { args: ["action", "focus-pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { focused: "" as PaneId };
  },
};

export const env_renamePane: Envelope<{ paneId: PaneId; name: string }, { paneId: PaneId; name: string }> = {
  toCli({ paneId, name }) {
    return { args: ["action", "rename-pane", "--pane-id", String(paneId), name] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { paneId: "" as PaneId, name: result.stdout.trim() };
  },
};

export const env_resizePane: Envelope<
  { direction: "left" | "right" | "up" | "down" },
  { direction: string }
> = {
  toCli({ direction }) {
    return { args: ["action", "resize", direction] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { direction: result.stdout.trim() || "" };
  },
};

export const env_moveFocus: Envelope<
  { direction: "left" | "right" | "up" | "down" },
  { direction: string }
> = {
  toCli({ direction }) {
    return { args: ["action", "move-focus", direction] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { direction: result.stdout.trim() || "" };
  },
};

export const env_movePane: Envelope<
  { direction: "left" | "right" | "up" | "down" },
  { direction: string }
> = {
  toCli({ direction }) {
    return { args: ["action", "move-pane", direction] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { direction: result.stdout.trim() || "" };
  },
};

// ---------- Input ----------

export const env_writeChars: Envelope<{ paneId: PaneId; chars: string }, { paneId: PaneId; written: number }> = {
  toCli({ paneId, chars }) {
    return { args: ["action", "write-chars", chars, "--pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { paneId: "" as PaneId, written: 0 };
  },
};

export const env_paste: Envelope<{ paneId: PaneId; text: string }, { paneId: PaneId; pasted: number }> = {
  toCli({ paneId, text }) {
    return { args: ["action", "paste", text, "--pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { paneId: "" as PaneId, pasted: 0 };
  },
};

export const env_sendKeys: Envelope<{ paneId: PaneId; keys: string[] }, { paneId: PaneId; keys: string[] }> = {
  toCli({ paneId, keys }) {
    const flat = keys.flatMap((k) => k.split(",").map((s) => s.trim()));
    return { args: ["action", "send-keys", ...flat, "--pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { paneId: "" as PaneId, keys: [] };
  },
};

// ---------- Tab mutation ----------

export const env_newTab: Envelope<{ name?: string; cwd?: string }, { tabId: TabId; name?: string }> = {
  toCli({ name, cwd }) {
    const args = ["action", "new-tab"];
    if (name) args.push("--name", name);
    if (cwd) args.push("--cwd", cwd);
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    const out: { tabId: TabId; name?: string } = { tabId: "" as TabId };
    const trimmed = result.stdout.trim();
    if (trimmed) out.name = trimmed;
    return out;
  },
};

export const env_closeTab: Envelope<{ tabId?: TabId }, { closed: TabId }> = {
  toCli({ tabId }) {
    const args = ["action", tabId !== undefined ? "close-tab-by-id" : "close-tab"];
    if (tabId !== undefined) args.push(String(tabId));
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { closed: "" as TabId };
  },
};

export const env_gotoTab: Envelope<
  { index?: number; tabId?: TabId; name?: string; create?: boolean },
  { tabId: TabId; created?: boolean }
> = {
  toCli({ index, tabId, name, create }) {
    if (name !== undefined) {
      const args: string[] = ["action", "go-to-tab-name", name];
      if (create) args.push("--create");
      return { args };
    }
    if (tabId !== undefined) return { args: ["action", "go-to-tab-by-id", String(tabId)] };
    if (index !== undefined) return { args: ["action", "go-to-tab", String(index)] };
    return { args: ["action", "go-to-next-tab"] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { tabId: "" as TabId };
  },
};

export const env_renameTab: Envelope<{ tabId?: TabId; name: string }, { tabId: TabId; name: string }> = {
  toCli({ tabId, name }) {
    const args = ["action", tabId !== undefined ? "rename-tab-by-id" : "rename-tab"];
    if (tabId !== undefined) args.push(String(tabId));
    args.push(name);
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { tabId: "" as TabId, name: result.stdout.trim() || "" };
  },
};

// ---------- Layout ----------

export const env_applyLayout: Envelope<
  { kdl?: string; path?: string; retainTerminalPanes?: boolean; retainPluginPanes?: boolean; activeTabOnly?: boolean },
  { applied: boolean }
> = {
  toCli({ kdl, path, retainTerminalPanes, retainPluginPanes, activeTabOnly }) {
    const args = ["action", "override-layout"];
    if (kdl) args.push("--layout-string", kdl);
    else if (path) args.push("--layout", path);
    if (retainTerminalPanes) args.push("--retain-existing-terminal-panes");
    if (retainPluginPanes) args.push("--retain-existing-plugin-panes");
    if (activeTabOnly) args.push("--apply-only-to-active-tab");
    return { args };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { applied: true };
  },
};

// ---------- Subscribe ----------

export const env_subscribe: Envelope<
  { paneId: PaneId; scrollback?: number | boolean; ansi?: boolean },
  { paneId: PaneId; isInitial: boolean; viewport: string[]; scrollback: string[] | null }
> = {
  toCli({ paneId, scrollback, ansi }) {
    const args = ["subscribe", "--format", "json", "--pane-id", String(paneId)];
    if (scrollback !== undefined) {
      args.push("--scrollback");
      if (typeof scrollback === "number") args.push(String(scrollback));
    }
    if (ansi) args.push("--ansi");
    return { args };
  },
  fromCli(result) {
    const events = result.events ?? [];
    const last = events[events.length - 1] as
      | { viewport?: string[]; scrollback?: string[] | null; is_initial?: boolean }
      | undefined;
    return {
      paneId: "" as PaneId,
      isInitial: Boolean(last?.is_initial),
      viewport: last?.viewport ?? [],
      scrollback: last?.scrollback ?? null,
    };
  },
};

// ---------- Input extras ----------

export const env_writeBytes: Envelope<{ paneId: PaneId; bytes: string[] }, { paneId: PaneId; bytes: number }> = {
  toCli({ paneId, bytes }) {
    return { args: ["action", "write", ...bytes, "--pane-id", String(paneId)] };
  },
  fromCli(result) {
    if (result.classified) throw result.classified;
    return { paneId: "" as PaneId, bytes: 0 };
  },
};

// ---------- Pane extras ----------

export const env_focusNext: Envelope<Record<string, never>, { focused: PaneId }> = {
  toCli() { return { args: ["action", "focus-next-pane"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { focused: "" as PaneId }; },
};
export const env_focusPrev: Envelope<Record<string, never>, { focused: PaneId }> = {
  toCli() { return { args: ["action", "focus-previous-pane"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { focused: "" as PaneId }; },
};
export const env_focusLast: Envelope<Record<string, never>, { focused: PaneId }> = {
  toCli() { return { args: ["action", "focus-last-pane"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { focused: "" as PaneId }; },
};
export const env_moveFocusOrTab: Envelope<{ direction: "left" | "right" | "up" | "down" }, { direction: string }> = {
  toCli({ direction }) { return { args: ["action", "move-focus-or-tab", direction] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { direction: r.stdout.trim() || "" }; },
};
export const env_movePaneBackwards: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "move-pane-backwards"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_toggleFullscreen: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "toggle-fullscreen"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_toggleNoUiFullscreen: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "toggle-no-ui-fullscreen"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_toggleEmbedded: Envelope<{ paneId?: PaneId }, { paneId: PaneId }> = {
  toCli({ paneId }) {
    const args = ["action", paneId !== undefined ? "toggle-pane-embed-or-floating-by-pane-id" : "toggle-pane-embed-or-floating"];
    if (paneId !== undefined) args.push(String(paneId));
    return { args };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: "" as PaneId }; },
};
export const env_toggleFloating: Envelope<Record<string, never>, { visible: boolean }> = {
  toCli() { return { args: ["action", "toggle-floating-panes"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { visible: true }; },
};
export const env_showFloating: Envelope<Record<string, never>, { visible: boolean }> = {
  toCli() { return { args: ["action", "show-floating-panes"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { visible: true }; },
};
export const env_hideFloating: Envelope<Record<string, never>, { visible: boolean }> = {
  toCli() { return { args: ["action", "hide-floating-panes"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { visible: false }; },
};
export const env_floatingVisible: Envelope<Record<string, never>, { visible: boolean }> = {
  toCli() { return { args: ["action", "are-floating-panes-visible"] }; },
  fromCli(r) {
    if (r.classified) throw r.classified;
    return { visible: r.stdout.trim().toLowerCase() === "true" };
  },
};
export const env_togglePinned: Envelope<{ paneId?: PaneId }, { paneId: PaneId }> = {
  toCli({ paneId }) {
    const args = ["action", paneId !== undefined ? "toggle-pane-pinned-by-pane-id" : "toggle-pane-pinned"];
    if (paneId !== undefined) args.push(String(paneId));
    return { args };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: "" as PaneId }; },
};
export const env_toggleFrames: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "toggle-pane-frames"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_setBorderless: Envelope<{ paneId: PaneId; borderless: boolean }, { paneId: PaneId; borderless: boolean }> = {
  toCli({ paneId, borderless }) {
    return { args: ["action", "set-pane-borderless", borderless ? "true" : "false", "--pane-id", String(paneId)] };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: "" as PaneId, borderless: true }; },
};
export const env_setBorderStyle: Envelope<{ paneId: PaneId; style: string }, { paneId: PaneId }> = {
  toCli({ paneId, style }) {
    return { args: ["action", "set-pane-border-style", style, "--pane-id", String(paneId)] };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: "" as PaneId }; },
};
export const env_setPaneColor: Envelope<{ paneId: PaneId; fg?: string; bg?: string }, { paneId: PaneId }> = {
  toCli({ paneId, fg, bg }) {
    const args = ["action", "set-pane-color", "--pane-id", String(paneId)];
    if (fg) args.push("--fg", fg);
    if (bg) args.push("--bg", bg);
    return { args };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: "" as PaneId }; },
};
export const env_clearPane: Envelope<{ paneId?: PaneId }, { paneId: PaneId }> = {
  toCli({ paneId }) {
    return { args: ["action", "clear", ...(paneId !== undefined ? ["--pane-id", String(paneId)] : [])] };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: (r.stdout.trim() || "") as PaneId }; },
};
export const env_breakPane: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "break-pane"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_scrollAt: Envelope<{ position: number; direction: "up" | "down" }, { ok: true }> = {
  toCli({ position, direction }) {
    return { args: ["action", direction === "up" ? "scroll-up-at" : "scroll-down-at", String(position)] };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_scrollToPrompt: Envelope<{ direction: "previous" | "next" }, { ok: true }> = {
  toCli({ direction }) {
    return { args: ["action", direction === "previous" ? "scroll-to-previous-prompt" : "scroll-to-next-prompt"] };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_selectCommandAt: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "select-command-at-scroll-position"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_copyLastOutput: Envelope<Record<string, never>, { output: string }> = {
  toCli() { return { args: ["action", "copy-last-command-output"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { output: r.stdout }; },
};
export const env_editScrollback: Envelope<{ paneId?: PaneId; ansi?: boolean }, { paneId: PaneId }> = {
  toCli({ paneId, ansi }) {
    const args = ["action", "edit-scrollback"];
    if (ansi) args.push("--ansi");
    if (paneId !== undefined) args.push("--pane-id", String(paneId));
    return { args };
  },
  fromCli(r) { if (r.classified) throw r.classified; return { paneId: (r.stdout.trim() || "") as PaneId }; },
};

// ---------- Tab extras ----------

export const env_gotoNextTab: Envelope<Record<string, never>, { tabId: TabId }> = {
  toCli() { return { args: ["action", "go-to-next-tab"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { tabId: "" as TabId }; },
};
export const env_gotoPrevTab: Envelope<Record<string, never>, { tabId: TabId }> = {
  toCli() { return { args: ["action", "go-to-previous-tab"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { tabId: "" as TabId }; },
};
export const env_moveTab: Envelope<{ direction: "left" | "right" }, { ok: true }> = {
  toCli({ direction }) { return { args: ["action", "move-tab", direction] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_moveTabTo: Envelope<{ position: number }, { ok: true }> = {
  toCli({ position }) { return { args: ["action", "move-tab-to-position", String(position)] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_undoRenameTab: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "undo-rename-tab"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_toggleTab: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "toggle-tab"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};

// ---------- Layout extras ----------

export const env_applyTiledSwap: Envelope<{ name: string }, { applied: string }> = {
  toCli({ name }) { return { args: ["action", "apply-tiled-swap-layout", name] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { applied: r.stdout.trim() || "(tiled swap)" }; },
};
export const env_applyFloatingSwap: Envelope<{ name: string }, { applied: string }> = {
  toCli({ name }) { return { args: ["action", "apply-floating-swap-layout", name] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { applied: r.stdout.trim() || "(floating swap)" }; },
};
export const env_nextSwapLayout: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "next-swap-layout"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};
export const env_prevSwapLayout: Envelope<Record<string, never>, { ok: true }> = {
  toCli() { return { args: ["action", "previous-swap-layout"] }; },
  fromCli(r) { if (r.classified) throw r.classified; return { ok: true }; },
};

// ---------- Diagnostic ----------

export const env_version: Envelope<Record<string, never>, { version: string; raw: string }> = {
  toCli() {
    return { args: ["--version"] };
  },
  fromCli(result) {
    const raw = result.stdout.trim();
    const m = raw.match(/(\d+\.\d+\.\d+)/);
    return { version: m?.[1] ?? raw, raw };
  },
};

// ---------- Helper to execute an envelope end-to-end ----------

export async function callEnvelope<TIn, TOut>(
  env: Envelope<TIn, TOut>,
  input: TIn,
  session?: SessionName,
): Promise<TOut> {
  const { args, opts } = env.toCli(input);
  const result = await runZellij(args, { ...(opts ?? {}), ...sessionOpt(session) });
  return env.fromCli(result);
}

export { classify, type ZellijError };
