# Zellij API surface — distilled reference

> **Source.** Based on `zellij-org/zellij@main` (0.45.1 / 0.46-dev) as of 2026-10-11.
> Files of record: `zellij-utils/src/cli.rs`, `zellij-utils/src/input/actions.rs`,
> `zellij-utils/src/ipc.rs`, `zellij-utils/src/setup.rs`,
> `zellij-utils/src/client_server_contract/client_server_contract.proto`.

## Framing corrections

A few things that are commonly assumed and wrong:

1. **There is no public WebSocket / RPC / HTTP API exposed to third parties.**
   The official programmatic-control page states:
   > "No socket, HTTP API, or library binding is required — all interaction
   > occurs through subprocess invocation."
   The IPC transport between zellij-client and zellij-server is a
   **Unix domain socket** (named pipe on Windows) carrying **protobuf**-
   encoded `ClientToServerMsg` / `ServerToClientMsg` frames. That
   transport is for the bundled client only — the bundled `zellij web`
   server is an HTTPS+WebSocket *gateway* to the same IPC, token-gated
   for the web client.
2. **There are no zellij-defined built-in pipes.** `zellij pipe` sends
   a payload to a plugin listening on that pipe name; pipe names are
   plugin-defined.
3. **`zellij list-pipes`, `zellij list-themes` do not exist** in this
   version. Structured session reads are:
   `list-panes --json`, `list-tabs --json`, `current-tab-info --json`,
   `dump-screen`, `dump-layout`, `subscribe --format json`.

## IPC socket

| Aspect | Value |
|---|---|
| Transport | Unix domain socket (named pipe on Windows) |
| Path pattern | `${ZELLIJ_SOCK_DIR}/<SESSION_NAME>` |
| Default `ZELLIJ_SOCK_DIR` | `${runtime_dir or /tmp}/zellij-${UID}/contract_version_1/` |
| Framing | length-delimited protobuf |
| Schema file | `client_server_contract.proto` |
| Socket path length limit | 108 B (Linux) / 104 B (macOS) |

## `ClientToServerMsg` (oneof)

`DetachSession`, `TerminalPixelDimensions`, `BackgroundColor`, `ForegroundColor`,
`ColorRegisters`, `TerminalResize`, `FirstClientConnected`, `AttachClient`,
`AttachWatcherClient`, `Action { action: Action, terminal_id?, client_id?,
is_cli_client }`, `Key { key, raw_bytes, is_kitty_keyboard_protocol }`,
`ClientExited`, `KillSession`, `ConnStatus`, `WebServerStarted`,
`FailedToStartWebServer`, `SubscribeToPaneRenders { pane_ids, scrollback?,
ansi }`, `RequestSessionList`, `HostTerminalThemeChanged`,
`KittyGraphicsSupport`, `KittyZlibSupport`, `SixelSupport`,
`SoftKeyboardVisibilityChanged`, `NestedSessionFrameFromHost`,
`ForwardedReplyFromHost`, `DesktopNotificationResponse`,
`SetMobileRenderPreferences`, `HostTerminalFocusChanged`.

## `ServerToClientMsg` (oneof)

`Render { content }`, `UnblockInputThread`, `Exit { exit_reason }`, `Connected`,
`Log`, `LogError`, `SwitchSession`, `UnblockCliPipeInput { pipe_name,
exit_code? }`, `CliPipeOutput { pipe_name, output }`, `QueryTerminalSize`,
`SetSoftKeyboard`, `StartWebServer`, `RenamedSession`, `ConfigFileUpdated`,
`PaneRenderUpdate { pane_id, viewport, scrollback?, is_initial }`,
`SubscribedPaneClosed { pane_id }`, `ForwardQueryToHost`,
`EmitNestedSessionFrame`, `MobileState { payload: MobileStatePayload }`.

## `Action` enum — canonical surface

This is the enumeration the keybind and CLI action pipelines share.
Anything `zellij action <X>` does is here.

### Lifecycle / global
`Quit`, `Detach`, `SwitchSession`, `FocusHostSession`, `FocusGuestSession`,
`ToggleHostFullscreen`, `BreakPane`, `BreakPaneLeft`, `BreakPaneRight`,
`SaveSession`, `RenameSession`, `SetDarkTheme`, `SetLightTheme`,
`ToggleTheme`, `NoOp`, `MouseEvent`, `Copy`, `Confirm`, `Deny`,
`SkipConfirm`, `DismissInfoPopups`, `OpenContextMenu`, `ToggleMouseMode`.

### Input
`Write { key_with_modifier?, bytes, is_kitty_keyboard_protocol }`,
`WriteChars { chars }`, `WriteToPaneId { bytes, pane_id }`,
`WriteCharsToPaneId { chars, pane_id }`, `Paste { chars, pane_id? }`,
`Key { … }` (IPC variant).

### Panes
`NewPane`, `NewBlockingPane`, `NewFloatingPane`, `NewTiledPane`,
`NewInPlacePane`, `NewStackedPane`, `EditFile`, `Run`, `RunInBackground`,
`CloseFocus`, `CloseTerminalPane { pane_id }`, `ClosePluginPane { pane_id }`,
`FocusTerminalPaneWithId`, `FocusPluginPaneWithId`,
`RenameTerminalPane { pane_id, name }`, `RenamePluginPane { pane_id, name }`,
`UndoRenamePane`, `ClearScreen`, `DumpScreen`, `DumpLayout`,
`EditScrollback`, `ScrollUp`, `ScrollDown`, `ScrollToTop`, `ScrollToBottom`,
`PageScrollUp`, `PageScrollDown`, `HalfPageScrollUp`, `HalfPageScrollDown`,
`ScrollUpAt { position }`, `ScrollDownAt { position }`,
`ScrollToPreviousPrompt`, `ScrollToNextPrompt`,
`SelectCommandAtScrollPosition`, `CopyLastCommandOutput`, `Resize`,
`ResizeByPaneId`, `SwitchFocus`, `MoveFocus`, `MoveFocusOrTab`, `MovePane`,
`MovePaneByPaneId`, `MovePaneBackwards`, `MovePaneBackwardsByPaneId`,
`SwitchToMode { input_mode }`, `SwitchModeForAllClients { input_mode }`,
`ToggleFocusFullscreen`, `ToggleFocusNoUiFullscreen`, `TogglePaneFrames`,
`SetPaneFrameStyle { style }`, `ToggleActiveSyncTab`,
`TogglePaneEmbedOrFloating`, `ToggleFloatingPanes`, `ShowFloatingPanes`,
`HideFloatingPanes`, `AreFloatingPanesVisible`, `TogglePanePinned`,
`StackPanes { pane_ids }`, `ChangeFloatingPaneCoordinates { pane_id,
coordinates }`, `TogglePaneBorderless`, `SetPaneBorderless`,
`SetPaneBorderStyle`, `SetPaneColor`, `TogglePaneInGroup`,
`ToggleGroupMarking`, `PaneNameInput { input }`, plus `*ByPaneId` /
`*ByTabId` CLI-only variants.

### Tabs
`NewTab { tiled_layout?, floating_layouts, swap_tiled_layouts,
swap_floating_layouts, tab_name?, should_change_focus_to_new_tab, cwd?,
? initial_panes?, ? first_pane_unblock_condition? }`, `CloseTab`,
`CloseTabById`, `GoToNextTab`, `GoToPreviousTab`, `GoToTab { index }`,
`GoToTabName { name, create }`, `GoToTabById`, `RenameTab { tab_index,
name }`, `RenameTabById`, `UndoRenameTab`, `MoveTab { direction }`,
`ToggleTab`, `TabNameInput { input }`, `OverrideLayout`,
`PreviousSwapLayout`, `NextSwapLayout`, `ApplyTiledSwapLayout { name }`,
`ApplyFloatingSwapLayout { name }`, `QueryTabNames`, plus `*ByTabId`
variants and `MoveTabToPosition`, `StartRenameTabByTabId`.

### Plugins
`LaunchPlugin`, `LaunchOrFocusPlugin`, `NewTiledPluginPane`,
`NewFloatingPluginPane`, `NewInPlacePluginPane`, `StartOrReloadPlugin`,
`CliPipe`, `KeybindPipe`, `MessagePlugin` (keybind only).

### Search
`SearchInput { input }`, `Search { direction }`, `SearchToggleOption { option }`.

### Structured reads (`Action` form)
`ListClients`, `ListPanes { show_tab, show_command, show_state, show_geometry,
show_all, output_json }`, `ListTabs { show_state, show_dimensions,
show_panes, show_layout, show_all, output_json }`,
`CurrentTabInfo { output_json }`.

## Top-level CLI structure

```
zellij [GLOBAL FLAGS] [SUBCOMMAND]
```

Global flags: `--max-panes <N>`, `--data-dir <PATH>`, `--server <SOCKET>`,
`--session/-s <NAME>`, `--layout/-l <PATH>`, `--layout-string <KDL>`,
`--new-session-with-layout <PATH>`, `--config/-c <PATH>`,
`--config-dir <PATH>`, `--debug`, `--help`, `--version`.

Subcommands: `options`, `setup`, `web`, `action` (alias `ac`), the
Sessions group (`ls` / `list-sessions`, `list-aliases`, `attach`,
`watch`, `kill-session`, `delete-session`, `kill-all-sessions`,
`delete-all-sessions`, `run`), `subscribe`, `prompt`.

## `zellij subscribe` — pane render stream

```
zellij subscribe [--session NAME] --pane-id <ID> [-f raw|json]
                 [--scrollback [N]] [--ansi]
```

NDJSON event shape:
```json
{"pane_id": <PaneId>, "viewport": [String, ...], "scrollback": [String, ...]?, "is_initial": bool}
```

Terminal event: `{ SubscribedPaneClosed: { pane_id } }` on pane close.

## `zellij prompt` — popup UI elements

`zellij prompt<element> [--title T --timeout DUR]` with `--default`,
`--json`, `--at-mouse | --at-cursor | --at-center`.

Elements: `confirm`, `choose`, `input`, `number`, `toggle`, `select`,
`menu`, `form`, `notify`.

Exit codes: 0 answered, 1 cancelled, 2 error, 124 timed out.

## Environment variables

`ZELLIJ_CONFIG_FILE`, `ZELLIJ_CONFIG_DIR`, `ZELLIJ_LAYOUT_DIR`,
`ZELLIJ_PANE_ID`, `ZELLIJ_ORIGIN_PANE_ID`, `ZELLIJ_SOCK_DIR`. The web
server uses `WEBSERVER_SOCKET_PATH = ZELLIJ_SOCK_DIR/web_server_bus`.