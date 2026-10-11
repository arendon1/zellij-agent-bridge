# Multitask patterns

The point of this extension: agents can run multiple investigations in
parallel, watch them live, and consume the results as first-class
structured data. Below are the four patterns that motivated the design.

Each pattern shows the conceptual flow the agent follows. Real tool
names will be available in `docs/api-mapping.md`.

---

## Pattern 1 — Parallel investigation (the headline use case)

The agent is debugging a flaky test. It splits the test space into N
shards, spawns a pane for each shard, runs the tests in parallel, waits
for completion, and aggregates the failures.

```
zj_session_attach_info              → { session, paneId }   (current)
zj_tab_new --name "shard-run"       → { tabId }

# Spawn 4 worker panes atomically via a generated KDL layout
zj_layout_apply --kdl @generated.kdl  → { panes: 4 }

# Or via the farm primitive (auto-generates the layout):
zj_farm_spawn                       → { handles: [h0, h1, h2, h3] }
  count: 4
  template: "cd /repo && npm test -- --shard={i}/4"
  cwd: /repo
  tab: shard-run

zj_farm_collect                     ← blocks until all exit or deadline
  handles: [h0, h1, h2, h3]
  mode: all
  deadlineMs: 300_000
  → { results: [{paneId, exitStatus, screen}], timedOut: false }

zj_farm_reduce                      → sorted failures
  handles, regex: "FAIL "
  mode: sum
  → { matches: [{line, lineNo}, ...] from each pane }
```

**Why this beats sequential:** four `npm test` invocations running in
parallel on 4 panes take roughly the time of the slowest, not the sum.
A flaky 5-minute suite runs in ~5 minutes with 4 panes, not 20.

---

## Pattern 2 — Stream-then-react (long-running process supervision)

The agent is running a build that takes 30-90 s. It wants to start the
build, stream progress, and react to specific signals.

```
zj_pane_spawn                       → { paneId }
  cmd: "make build"
  cwd: /repo
  name: build

zj_pane_subscribe                   ← streams viewport events
  paneId
  mode: until-match
  regex: "(BUILD FAILED|Build succeeded)"
  → { matched: true, line, context }

# If matched:
zj_pane_read_screen                 → full scrollback for analysis
  paneId, full: true

zj_pane_send_chars                  → handle the prompt if hung
  paneId, chars: "y\n"
```

The streaming tool keeps the agent's UI alive (`onUpdate` updates the
TUI's transcript pane) while the build runs, so the user sees real
progress instead of a frozen spinner.

---

## Pattern 3 — Coordinate via a shared pane (state exchange)

Two worker panes need to share intermediate state. Rather than passing
output around through the agent's context, they write to a shared pane
that both read.

```
# Spawn coordinator + 2 workers
zj_layout_apply --kdl @3-pane.kdl   → coordinator (top), worker-0 (left), worker-1 (right)

# Worker 0 reads a file and writes a checksum to the coordinator's pane
zj_pane_write_chars
  paneId: worker-0
  chars: "sha256sum target/release/myapp | tee /dev/zellij-coordinator\n"

# Worker 1 waits for the checksum to appear in the coordinator's pane
zj_pane_wait_for
  paneId: coordinator
  regex: "[a-f0-9]{64}"
  timeoutMs: 60_000
  → { matched: true, line, lineNo }

# Worker 1 then uses the result
zj_pane_read_screen
  paneId: coordinator
  → contains the checksum; worker 1 parses it
```

This works because zellij's panes are real PTYs — anything you can do
in a terminal you can do across panes. The bridge just gives the agent
typed handles for that.

---

## Pattern 4 — Pipeline (stdout → stdin across panes)

A common shell pattern: pipe stdout of one process into another. The
agent does the same across panes.

```
zj_pane_spawn
  cmd: "find /repo/src -name '*.rs' | xargs wc -l"
  name: counter

zj_pane_spawn
  cmd: "sort -nr"
  name: sorter

zj_pane_subscribe
  paneId: counter
  mode: until-prompt           # wait for counter to finish

zj_pane_send_keys
  paneId: sorter
  keys: ["Enter"]              # trigger sorter's readline

# Replay counter's screen into sorter's stdin via the bridge's
# future `zj_pane_pipe` tool (planned: pipes one pane's scrollback
# into another's PTY as input)
```

For now the agent reads the screen and writes it back; phase 6 will
add the dedicated `zj_pane_pipe` tool that does it natively.

---

## Pattern 5 — Multi-agent team (the orchestration layer)

This is the pattern pi's own subagent extension already supports in
spirit — spawn child agents that work in parallel. The bridge adds
that the children can coordinate via zellij state, and the parent can
introspect every child's progress in real time.

```
# Parent agent spawns 3 child pi processes, each in its own pane
zj_layout_apply --kdl @3-pane.kdl
  pane[0] cwd: /repo/services/auth   name: auth-worker
  pane[1] cwd: /repo/services/api    name: api-worker
  pane[2] cwd: /repo/services/web    name: web-worker

for pane in [auth-worker, api-worker, web-worker]:
  zj_pane_write_chars
    paneId: pane
    chars: "pi -e ./workers/refactor-tool.ts\n"

# Subscribe to all three; surface every line in the parent's TUI
for pane in [1, 2, 3]:
  zj_pane_subscribe pane, until-match regex: "DONE|ERROR"

# When all three report DONE:
zj_farm_collect                      → child reports + exit codes
zj_farm_reduce                      → diff lines
```

The parent sees all three transcript panes streaming live in its TUI
via `onUpdate`. The user can focus any pane in zellij to interact
directly with a child.

---

## Permissions and safety

The multitask patterns can do destructive things (kill sessions,
close panes, force-exit workers). Every mutating tool in this extension
is gated by a `tool_call` handler that:

1. **Read-only tools** (`zj_*_list`, `zj_*_dump`, `zj_pane_read_screen`)
   never trigger the gate.

2. **Mutating tools** (`zj_pane_spawn`, `zj_tab_new`, `zj_layout_apply`)
   trigger the gate only when the agent has been told `--no-confirm`
   is off. By default they auto-proceed.

3. **Destructive tools** (`zj_session_kill`, `zj_pane_close`,
   `zj_tab_close`, `zj_session_kill_all`) always trigger a
   `ctx.ui.confirm` prompt unless the agent's `confirmDestructive`
   context flag is set.

Non-interactive modes (`ctx.hasUI === false`) get the strict version
by default — the gate blocks the call and tells the model to ask
explicitly.

---

## Limits and gotchas

- **One zellij session per bridge instance.** If the agent wants to
  talk to multiple sessions, it picks the target via the `session`
  parameter on every call. There is no global "active session" state.
- **Pane IDs are unstable across restarts.** If zellij restarts, all
  pane IDs change. The agent should `zj_pane_list` after any
  unexpected disconnect.
- **Socket path length cap.** Linux 108 B, macOS 104 B. Session
  names that push the socket path over the cap get rejected by
  zellij. The bridge surfaces this as a clear error.
- **No built-in pipes.** If you remember `zellij pipe --name <X>` from
  older docs, that's gone. The replacement is `zj_pipe_send` plus a
  plugin.