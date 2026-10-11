# Architecture

One CLI subprocess per zellij action. Everything else hangs off
`src/transport/cli.ts#runZellij`. This is a deliberate choice — here's
why, and what changes if we want more.

## Goals

1. **100% API coverage.** Every CLI subcommand and every `zellij action`
   CliAction is reachable as a typed tool. No partial surfaces, no
   "v2-coming-soon" stubs.
2. **Structured data.** `list-panes --json`, `list-tabs --json`,
   `current-tab-info --json`, and `subscribe --format json` give us
   typed reads; everything else goes through our `outputSchema`.
3. **Streamable.** Pane renders stream through `onUpdate(partialResult);
   for the model and through an async iterable for the multitask layer.
4. **Multitask-ready.** The agent can spawn N panes, send work to each,
   read each pane's screen, wait for regex matches, and collect results.
5. **Future-proof.** The transport is hidden behind a single module
   boundary, so swapping to a direct UDS+protobuf client in v2 doesn't
   ripple through the rest of the code.

## Transport choice: CLI over UDS-protobuf

Considered:

| Option | Pros | Cons |
|---|---|---|
| **CLI subprocess (chosen)** | zero deps; every action reachable; built-in `--json`; `subscribe --format json` works out of the box | ~10-30 ms per call; can't share state across calls |
| Direct UDS-protobuf client | ~100× faster; single persistent connection; full bidirectional event stream | requires the `.proto` file + a protobuf runtime (3 MB+); agent has to speak `ClientToServerMsg` framing |
| `zellij web` HTTPS+WS gateway | already running when the user is on the web client; token-gated | internal-only; tokens are per-session and ephemeral; doesn't expose anything we don't already have via CLI |

CLI wins on three vectors: coverage, simplicity, dependency budget.
The ~10 ms cost is dwarfed by agent reasoning time, and the agent will
batch operations anyway (a layout-apply spawns N panes atomically).

When v2 swaps in a UDS-protobuf client:

```ts
// src/transport/cli.ts  →  src/transport/uds.ts
// same exports: runZellij, runZellijStreaming
// tool layer imports stay the same
```

The `Envelope<TIn, TOut>` types in `src/protocol/envelopes.ts` make the
seam clean — `toCli(args)` becomes `toUds(client, msg)` and the tools
don't notice.

## Module layout

```
src/
├── extension.ts          ← pi entry; registers tools, gates permissions
├── types.ts              ← shared cross-cutting types (PaneId, ZjToolContext, ...)
├── transport/            ← ONLY module that talks to zellij
│   ├── cli.ts            ← runZellij(args, opts) → ZellijRunResult
│   ├── codec.ts          ← JSON parse + error classification
│   └── types.ts          ← TypeBox schemas for zellij's --json output
├── protocol/             ← tool-surface schemas and intent → wire envelopes
│   ├── schema.ts         ← TypeBox schemas for every tool's params + output
│   └── envelopes.ts      ← pure: input → argv, output → typed result
├── tools/                ← one file per category
│   ├── session.ts        ← zj_session_*
│   ├── pane.ts           ← zj_pane_*
│   ├── tab.ts            ← zj_tab_*
│   ├── input.ts          ← zj_pane_write_*, send_keys, paste
│   ├── layout.ts         ← zj_layout_*
│   ├── query.ts          ← zj_*_list, dump_*, read_screen
│   └── subscribe.ts      ← zj_pane_subscribe (long-running)
├── multitask/            ← the killer feature
│   ├── worker.ts         ← WorkerHandle lifecycle
│   ├── farm.ts           ← zj_farm_spawn, zj_farm_collect, zj_farm_status
│   └── reducer.ts        ← zj_pane_wait_for, zj_pane_collect_lines, zj_farm_reduce
└── util/                 ← leaf helpers
    ├── spawn.ts          ← node:child_process wrapper with timeout/signal policy
    ├── stream.ts         ← NDJSON line parser for subscribe
    ├── truncate.ts       ← model-output cap (50 KB / 2 000 lines)
    └── log.ts            ← debug logger (ZJ_BRIDGE_DEBUG=1)
```

Each layer depends only on the layer below it. The transport is the
"hard shell" — everything outside of `src/transport/` is zellij-agnostic
and could be re-pointed at a different multiplexer (tmux, wezterm) by
swapping this one directory.

## Naming convention

Every tool name is prefixed `zj_` for two reasons:

1. **Model discrimination.** When the model sees 40+ tools, the
   `zj_*` namespace gives it a strong filter. Tools without the
   prefix (e.g. pi's built-in `bash`) sit in a different mental bucket.
2. **Tab completion / discoverability.** The pi TUI (if/when it adds
   command-palette filtering) can show `zj` as a category.

Within the prefix, second-level namespaces (`zj_session_*`, `zj_pane_*`,
`zj_tab_*`, `zj_layout_*`, `zj_farm_*`) match the verb groupings the
multiplexer naturally suggests.

## Annotations

Every tool declares annotations so the permission gate can read them:

```ts
annotations: {
  readOnlyHint: true,         // for query tools
  destructiveHint: false,       // for pane_new, tab_new, layout_apply
  idempotentHint: true,        // for *_kill, *_close
  openWorldHint: true,        // always — zellij talks to a real terminal
}
```

The permission gate handler (phase 6) reads `destructiveHint` and
either confirms or blocks, depending on `ctx.hasUI` and the per-call
`confirmDestructive` flag on `ZjToolContext`.

## Long-running tools

Three tools don't return immediately:

- `zj_pane_subscribe` — streams viewport updates via `onUpdate`
- `zj_farm_collect` — blocks until all handles exit or deadline
- `zj_pane_wait_for` — blocks until regex matches or timeout

All three:

- accept `signal: AbortSignal` from pi
- propagate to the underlying `zellij subscribe` / poll loop
- on cancel, kill any spawned children and resolve cleanly
- stream intermediate state via `onUpdate(partialResult)` so the user
  sees live progress

The streaming pattern is exactly `examples/extensions/subagent/index.ts`
in pi's own examples — `onUpdate` at meaningful checkpoints (one per
pane event, one per farm status tick).

## Configuration sources

Tools accept their primary inputs from `params`. Defaults come from:

| Source | Default | Tool |
|---|---|---|
| `params.session` | current session | all |
| `ZELLIJ_SESSION_NAME` env | session name when `params.session` is absent | all |
| `ZELLIJ_PANE_ID` env | calling pane id | `zj_session_attach_info` |
| `params.cwd` | `ctx.cwd` | spawn tools |
| `params.timeoutMs` | 30 000 (60 000 for subscribe) | long-running tools |
| `params.confirmDestructive` | `false` unless overridden | permission gate |

This keeps the agent from having to specify the obvious; a `zj_pane_spawn`
with no session argument just acts on the current one.

## What we're NOT doing (yet)

- A direct UDS-protobuf client (v2 — see thread module)
- A `zellij web` token-gated gateway (already done by `zellij web`)
- Plugin authoring tools (different scope)
- A `--yes` global auto-approve (handled per-call by the gate handler)
- Multi-process pool (one CLI process per call is fine; zellij's IPC
  is the bottleneck, not our wrapper)