# PLAN — zellij-agent-bridge

Phased implementation plan. Each phase is independently shippable. Mark a phase complete when its acceptance criteria pass.

---

## Phase 0 — Research & scaffold ✅ COMPLETE

- [x] Inventory every `zellij action` CliAction and every session/sub command
- [x] Inventory every built-in pipe, `--json` flag, and `subscribe --format json` shape
- [x] Read pi's `ToolDefinition` / `AgentToolResult` / TypeBox contract from `dist/core/extensions/types.d.ts`
- [x] Confirm single-file-vs-npm loading, jiti loader, no-build requirement
- [x] Author `docs/zellij-surface.md` (distilled zellij reference)
- [x] Author `docs/api-mapping.md` (CLI → tool mapping)
- [x] Author `docs/architecture.md` (transport choice + multitask rationale)
- [x] Author `docs/multitask-patterns.md` (use-case walkthroughs)
- [x] Stub every source file with a TypeBox-shaped header
- [x] Stub tests + fixtures
- [x] Initialize git

## Phase 1 — Transport & codec

**Goal:** the bridge can reliably run any zellij subprocess, parse its stdout (text or JSON or NDJSON), and surface a typed result.

**Deliverables:**
- `src/util/spawn.ts` — `runZellij(args, opts): Promise<{stdout, stderr, exitCode, json?}>` with timeout + signal
- `src/util/stream.ts` — NDJSON line parser for `zellij subscribe` output
- `src/util/truncate.ts` — model-output truncation (50 KB / 2 000 lines default; spill to temp file path)
- `src/transport/codec.ts` — JSON.parse with zellij-shaped error mapping (`ExitReason` → readable error)
- `src/transport/types.ts` — TypeBox schemas for `PaneInfo`, `TabInfo`, `ClientInfo`, `TabInfo` from the `list-panes --json` / `list-tabs --json` / `current-tab-info --json` output
- `tests/transport.test.ts`, `tests/codec.test.ts`, `tests/fixtures/list-panes.json` (real captured stdout), `list-tabs.json`, `dump-screen.txt`

**Acceptance:**
- [ ] `runZellij(['list-sessions'])` returns parsed `string[]` of session names
- [ ] `runZellij(['action','list-panes','--json'])` returns typed `PaneInfo[]`
- [ ] NDJSON stream yields each event in order, terminates on `SubscribedPaneClosed`
- [ ] Truncation reports `[truncated X lines / Y bytes — full output at /tmp/…]`
- [ ] All tests pass against real zellij ≥0.45 (skip gracefully if `zellij --version` fails)

## Phase 2 — Session, query, and pane-read tools

**Goal:** agent can introspect and read. ~10 tools.

**Deliverables:**
- `src/tools/session.ts` — `zj_session_ls`, `zj_session_new` (with KDL layout), `zj_session_kill`, `zj_session_attach_info` (returns current pane/tab context for the calling agent)
- `src/tools/query.ts` — `zj_pane_list` (wraps `list-panes --json`), `zj_tab_list`, `zj_tab_current`, `zj_layout_dump`, `zj_clients_list`
- `src/tools/subscribe.ts` — `zj_pane_subscribe` (long-running tool, streams via `onUpdate`, returns final viewport + scrollback snapshot)
- All tools wired in `src/extension.ts`

**Acceptance:**
- [ ] In a live zellij session, agent can `zj_pane_list` and read structured `PaneInfo[]`
- [ ] Agent can subscribe to a pane and see viewport updates stream in
- [ ] Errors include actionable messages (e.g. "no such session 'foo' — available: [a, b]")

## Phase 3 — Pane & tab mutation tools

**Goal:** agent can create panes/tabs and send input. ~20 tools.

**Deliverables:**
- `src/tools/pane.ts` — `zj_pane_spawn`, `zj_pane_close`, `zj_pane_focus`, `zj_pane_focus_id`, `zj_pane_rename`, `zj_pane_resize`, `zj_pane_move`, `zj_pane_focus_next`, `zj_pane_focus_prev`, `zj_pane_focus_last`, `zj_pane_toggle_fullscreen`, `zj_pane_toggle_floating`, `zj_pane_toggle_embedded`, `zj_pane_set_borderless`, `zj_pane_set_color`, `zj_pane_stack`, `zj_pane_wait_exit`
- `src/tools/tab.ts` — `zj_tab_new`, `zj_tab_close`, `zj_tab_close_id`, `zj_tab_goto`, `zj_tab_goto_id`, `zj_tab_goto_name`, `zj_tab_rename`, `zj_tab_rename_id`, `zj_tab_next`, `zj_tab_prev`, `zj_tab_move`, `zj_tab_apply_swap_layout`, `zj_tab_override_layout`
- `src/tools/input.ts` — `zj_pane_write_chars`, `zj_pane_paste`, `zj_pane_send_keys` (parsed names)

**Acceptance:**
- [ ] `zj_pane_spawn` opens a pane running the requested command, returns `paneId` from `list-panes --json`
- [ ] `zj_pane_write_chars` types the text into the right pane (verify by `dump-screen`)
- [ ] `zj_pane_send_keys` accepts zellij key syntax (`Ctrl a`, `Alt Tab`, `F1`, etc.)
- [ ] Destructive tools (`zj_session_kill`, `zj_pane_close`, `zj_tab_close`) gated via `tool_call` handler

## Phase 4 — Layout tools

**Goal:** agent can apply KDL layouts to spawn N panes at once. ~5 tools.

**Deliverables:**
- `src/tools/layout.ts` — `zj_layout_apply` (KDL string), `zj_layout_apply_file`, `zj_layout_dump`, `zj_layout_set_swap`, `zj_layout_apply_swap_tiled`, `zj_layout_apply_swap_floating`

**Acceptance:**
- [ ] `zj_layout_apply` with a 2x2 grid KDL produces 4 panes, queryable via `zj_pane_list`
- [ ] Agent can dump the current layout and re-apply it

## Phase 5 — Multitask primitives

**Goal:** higher-level "spawn N workers / collect outputs" tools. **This is the killer feature.**

**Deliverables:**
- `src/multitask/worker.ts` — `WorkerHandle` class: spawn → name → write → wait-exit → read, with timeouts
- `src/multitask/farm.ts` — `zj_farm_spawn` (parallel N panes with shared cwd + command template), `zj_farm_collect` (wait-all with deadline), `zj_farm_status` (read each pane screen)
- `src/multitask/reducer.ts` — `zj_pane_collect_lines` (regex match on screen, return matches), `zj_pane_wait_for` (block until regex appears in pane or timeout)
- Wired as tools in `src/extension.ts`

**Acceptance:**
- [ ] Spawning a 4-pane farm of `npm test` runs in parallel (verify via pane list timestamps)
- [ ] `zj_pane_wait_for` returns when the regex first matches (within timeout)
- [ ] Agent can use the farm pattern to run 4 parallel code investigations and aggregate findings

## Phase 6 — Polish & publish

- [ ] `permission-gate.ts` style `tool_call` handler blocking destructive ops without `--yes` (or confirm via `ctx.ui.confirm`)
- [ ] Permission annotations on every tool (`destructiveHint`, `idempotentHint`, `openWorldHint`)
- [ ] README quickstart refined to actual tool signatures
- [ ] Example walkthrough: "agent runs 3 parallel codemods and merges results" (markdown in `examples/`)
- [ ] `npm publish` (or local install path) — `pi install npm:zellij-agent-bridge`

---

## Out of scope (for now)

- Direct Unix-domain-socket protobuf client (v2 — keeps tool surface stable while speeding up 10×)
- `zellij web` token-gated HTTPS+WS gateway (internal-only; would re-implement what `zellij web` already does)
- Plugin authoring tools (different project)
- A `--yes` global auto-approve flag (handled per-call via permission gate handler)