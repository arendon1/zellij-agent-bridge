# zellij-agent-bridge

A pi extension that gives agents **full programmatic control of the [zellij](https://zellij.dev/) terminal multiplexer** — every `zellij action` CliAction, every session command, every pane/tab mutation, plus streaming pane reads — exposed as a structured, typed tool surface that agents can use to **multitask**: spawn parallel worker panes, send them work, watch their output, and coordinate them through zellij state.

> **Why.** Zellij is the only mainstream terminal multiplexer with a complete, stable programmatic control surface (`zellij action` + `zellij subscribe --format json`). Pi is a coding agent that already has tools for files, bash, search, subagents — but no way to genuinely multitask across long-running processes. Bridge the two and an agent can finally run parallel investigations, watch them live, and consume their outputs as first-class structured data.

---

## Status

🚧 **Scaffolding complete — implementation pending.** See [`PLAN.md`](./PLAN.md) for the phased roadmap. Source files are present as TypeBox-shaped stubs with no runtime logic yet; docs and tests are written; nothing is wired up.

## Install

```bash
# Once published:
pi install npm:zellij-agent-bridge

# Local dev:
pi -e ./projects/zellij-agent-bridge
```

Then in a session inside zellij:

```
list_sessions                 # model sees: zj_session_ls
new_session --layout default  # model sees: zj_session_new
spawn_pane --cmd "npm test"   # model sees: zj_pane_spawn
write_chars "y"               # model sees: zj_pane_write_chars
dump_screen                   # model sees: zj_pane_read_screen
```

## Quickstart (planned)

```typescript
// (illustrative — not implemented yet)
pi.registerTool(zj_session_new,    { /* session, name, layout? */ });
pi.registerTool(zj_pane_spawn,     { /* session, command, cwd?, name? */ });
pi.registerTool(zj_pane_write_chars,{ /* session, paneId, chars */ });
pi.registerTool(zj_pane_read_screen,{/* session, paneId, full? */ });
pi.registerTool(zj_subscribe,      { /* session, paneId, scrollback?, ... */ });
```

See [`docs/api-mapping.md`](./docs/api-mapping.md) for the full coverage table.

## Architecture (one paragraph)

One CLI subprocess per action (`zellij action <X> [--session NAME] --json` when supported, otherwise plain text). Structured reads come from the `--json` flags; long-running streams come from `zellij subscribe --format json --pane-id ...`. A future v2 can swap the transport for a direct Unix-domain-socket protobuf client without changing the tool surface — the transport is hidden behind `src/transport/cli.ts`.

See [`docs/architecture.md`](./docs/architecture.md) for the full design.

## License

MIT — see [`LICENSE`](./LICENSE).