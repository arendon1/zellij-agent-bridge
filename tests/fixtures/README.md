# Test fixtures

Real captured stdout from `zellij` 0.45+ for codec tests. Phase 1 will
populate these by running:

```bash
zellij action list-panes --json > tests/fixtures/list-panes.json
zellij action list-tabs  --json > tests/fixtures/list-tabs.json
zellij action current-tab-info --json > tests/fixtures/current-tab-info.json
zellij action dump-screen --pane-id terminal_0 > tests/fixtures/dump-screen.txt
zellij action dump-layout > tests/fixtures/dump-layout.kdl
zellij subscribe --format json --pane-id terminal_0 \
  > tests/fixtures/subscribe.jsonl       # capture for ~5s, then Ctrl-C
```

Each file should be the smallest example that exercises the codec. The
fixtures double as documentation of what zellij actually emits, so the
agent (and reviewer) can sanity-check the TypeBox schemas against them.

Until populated, the codec tests are gated on `ZJ_BRIDGE_FAKE=1` and
return their own synthesized data.