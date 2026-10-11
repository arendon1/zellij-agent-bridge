# zellij-agent-bridge

A pi extension that gives agents **full programmatic control of the [zellij](https://zellij.dev/) terminal multiplexer** — every `zellij action` CliAction, every session command, every pane/tab mutation, plus streaming pane reads — exposed as a typed tool surface that agents can use to **multitask**: spawn parallel worker panes, send them work, watch their output, and coordinate them through zellij state.

> **Coverage claim.** This extension covers **100% of the public zellij CLI / `zellij action` surface** as of zellij 0.45+ — every CliAction variant, every session-group subcommand, plus the `subscribe` and `prompt` subsystems. The internal IPC (Unix-domain-socket + protobuf) is intentionally out of scope; see [docs/architecture.md](./docs/architecture.md#transport-choice-cli-over-uds-protobuf) for why and how a future v2 could add it without changing the tool surface.

---

## Status

🚧 **Scaffolding complete — implementation pending.** See [`PLAN.md`](./PLAN.md) for the phased roadmap. Source files are present as TypeBox-shaped stubs with no runtime logic yet; docs and tests are written; nothing is wired up.

## Prerequisites

This extension is **not** useful outside of zellij.

| Requirement | Why |
|---|---|
| **The agent must run inside a zellij session** (as a child pane) | `ZELLIJ_PANE_ID` and `ZELLIJ_SESSION_NAME` env vars are how `zj_session_attach_info` reports the calling agent's location. The agent still works without them — it just doesn't know which pane is "itself." |
| **zellij ≥ 0.45.0** in `PATH` | The `--json` shapes we depend on (`list-panes --json`, `list-tabs --json`, etc.) stabilized in 0.45. Older versions will produce parse errors. The probe (`zj_doctor`) checks version and refuses to register the tools if too old. |
| **Node ≥ 20** | The extension uses `node:child_process`, `AbortSignal`, and modern TypeBox features. |

The probe at extension load runs `zellij --version`. If it fails, only `zj_doctor` is registered — call it to see what's wrong. See [docs/architecture.md](./docs/architecture.md) for the degradation behavior.

## Install

```bash
# Once published:
pi install npm:zellij-agent-bridge

# Local dev (current scaffold lives at ~/projects/zellij-agent-bridge):
pi -e ./projects/zellij-agent-bridge

# Add to settings.json (project):
# .pi/settings.json → { "packages": ["./projects/zellij-agent-bridge"] }
```

## Quickstart (planned tool surface)

```text
zj_doctor                → report zellij version + extension status
zj_session_ls            → list running sessions
zj_session_new           → create a session with optional KDL layout
zj_session_attach_info   → "where am I?" — current session + pane id
zj_pane_spawn            → open a new pane running a command
zj_pane_write_chars      → type text into a pane
zj_pane_send_keys        → send key combos (Ctrl a, F1, ...)
zj_pane_read_screen      → dump a pane's contents
zj_pane_subscribe        → stream viewport updates (long-running)
zj_pane_list             → typed PaneInfo[] of all panes
zj_tab_list              → typed TabInfo[] of all tabs
zj_layout_apply          → apply a KDL layout string (atomic N-pane spawn)
zj_farm_spawn            → spawn N parallel worker panes
zj_farm_collect          → wait for N workers to exit
zj_pane_wait_for         → block until a regex matches a pane
```

Full mapping of every CliAction → tool: [`docs/api-mapping.md`](./docs/api-mapping.md).

## Tool return shapes (what the model sees)

Every tool returns an `AgentToolResult` with `content: (TextContent | ImageContent)[]` (model-facing) and optional `structuredContent` (programmatic). The `content` is a one-line summary; the structured data is for follow-up reasoning.

**`zj_pane_list`** — structured reads.
```ts
// content (model-facing):
"4 panes in tab 0"

// structuredContent (PinaInfo[]):
[
  { id: "terminal_1", type: "terminal", title: "bash",   command: "/bin/bash",
    cwd: "/repo", focused: true,  is_floating: false, is_plugin: false,
    geometry: { x: 0, y: 0, cols: 80, rows: 24 }, exited: false, tab_position: 0 },
  { id: "terminal_2", type: "terminal", title: "build",  command: "make",
    cwd: "/repo", focused: false, is_floating: false, is_plugin: false, ... },
  ...
]
```

**`zj_session_ls`** — list of running sessions.
```ts
// content:  "3 sessions: dev, prod, scratch"
// structuredContent: ["dev", "prod", "scratch"]
```

**`zj_pane_read_screen`** — raw terminal output.
```ts
// content:  "$ npm test\n\n> myproj@1.0.0 test\n> jest\n\nPASS src/foo.test.ts\n..."
// (truncated at 50 KB / 2 000 lines; full output spilled to a temp file path in the message)
```

**`zj_layout_apply`** — apply a KDL layout string.
```ts
// params: { kdl: 'layout { pane { name "build"; } pane split_direction="vertical" { name "test"; } }' }
// content:  "applied layout: 2 panes spawned"
// structuredContent: { panes: ["terminal_3", "terminal_4"] }
```

**`zj_farm_spawn`** — spawn N parallel workers (the multitask primitive).
```ts
// params: { count: 4, template: "cd /repo && npm test -- --shard={i}/4" }
// content:  "4 worker panes spawned in tab 'shard-run'"
// structuredContent: {
//   tabId: "2",
//   handles: [
//     { session: "", paneId: "terminal_3", command: "...", spawnedAt: 1762419200000 },
//     { session: "", paneId: "terminal_4", command: "...", spawnedAt: 1762419200050 },
//     ...
//   ]
// }
```

**`zj_doctor`** — diagnostic.
```ts
// params:  { reprobe?: boolean }
// content: "zellij 0.45.1 OK at /usr/local/bin/zellij. 50 tools active."
// structuredContent: {
//   ok: true,
//   zellij: { available: true, path: "/usr/local/bin/zellij", version: "0.45.1", minimumRequired: "0.45.0" },
//   extension: { version: "0.0.0-scaffold", node: "v20.x.x", platform: "linux" },
//   tools: { active: 50 }
// }
```

The full mapping with every CLI surface → tool → output shape:
[`docs/api-mapping.md`](./docs/api-mapping.md).

## Architecture (one paragraph)

One CLI subprocess per action (`zellij action <X> [--session NAME] --json` when supported, otherwise plain text). Structured reads come from the `--json` flags; long-running streams come from `zellij subscribe --format json --pane-id ...`. A future v2 can swap the transport for a direct Unix-domain-socket protobuf client without changing the tool surface — the transport is hidden behind `src/transport/cli.ts`.

See [`docs/architecture.md`](./docs/architecture.md) for the full design.

## License

MIT — see [`LICENSE`](./LICENSE).