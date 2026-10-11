# Examples

End-to-end walkthroughs of how an agent uses the bridge for real
multitask work. The patterns live in
[`docs/multitask-patterns.md`](../docs/multitask-patterns.md); these
files are the worked examples that hang off each pattern.

Planned (phase 6):

- **`single-worker.md`** — one-shot: spawn a shell, send a command,
  read the result, close the pane. The "hello world" of the bridge.
- **`parallel-team.md`** — pattern 1 from docs/multitask-patterns.md
  in full: 4 panes running shards of a test suite, aggregating results.
- **`pipeline.md`** — pattern 4: pane A's stdout → pane B's stdin via
  the bridge's `zj_pane_pipe` (planned for phase 6).
- **`supervise.md`** — pattern 2: long-running build with live progress
  streaming to the agent's TUI via `onUpdate`.
- **`multi-agent.md`** — pattern 5: 3 child pi subagents coordinating
  via a shared zellij pane.

Each example is a markdown walkthrough with the exact tool invocations
the agent issues, the expected intermediate state (via `zj_pane_list`
or `zj_tab_list`), and the final aggregated result.