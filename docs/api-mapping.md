# API mapping — every zellij CLI surface → bridge tool

> Coverage goal: **100% of the public zellij CLI / `zellij action`
> surface** in zellij 0.45+. The Action enum is the canonical source of
> truth — every variant gets either a dedicated tool or an explicit
> "deliberately not wrapped" note below.

Legend:
- 📖 read tool (`readOnlyHint: true`)
- ✏️  mutating tool (`destructiveHint: false`)
- 💥 destructive tool (`destructiveHint: true`)
- 🔁 streaming tool (uses `onUpdate`)
- ⏳ blocking tool (uses `ctx.signal` for cancel)

**Returns** column shows the `outputSchema`/`structuredContent` shape
the model sees. Read tools always return typed data; mutating tools
return a brief status object.

---

## Top-level subcommands

| zellij CLI | Tool | Returns | Notes |
|---|---|---|---|
| `zellij --version` | (internal — `zj_doctor`) | `ZellijProbe` | sanity check at extension load |
| `zellij --help` | (internal) | — | — |
| `zellij options [KEY=VALUE...]` | `zj_options_set` ✏️ | `{ applied: string[] }` | CLI overrides for `~/.config/options` |
| `zellij setup --check` | `zj_setup_check` 📖 | `{ valid: boolean, issues: string[] }` | validates config without applying |
| `zellij setup --dump-config` | `zj_setup_dump_config` 📖 | `{ config: string }` (YAML) | effective config |
| `zellij setup --dump-layout <NAME>` | `zj_setup_dump_layout` 📖 | `{ name: string, kdl: string }` | one of `default`, `strider`, `compact`, `disable-status`, `classic`, or custom `.kdl` |
| `zellij setup --dump-swap-layout <NAME>` | `zj_setup_dump_swap_layout` 📖 | `{ name: string, kdl: string }` | — |
| `zellij setup --dump-keybinds <NAME>` | `zj_setup_dump_keybinds` 📖 | `{ name: string, kdl: string }` | — |
| `zellij setup --dump-plugins [<DIR>]` | `zj_setup_dump_plugins` 📖 | `{ plugins: PluginManifest[] }` | — |
| `zellij setup --generate-completion <SHELL>` | `zj_setup_generate_completion` 📖 | `{ shell: string, script: string }` | — |
| `zellij setup --generate-auto-start <SHELL>` | `zj_setup_generate_autostart` 📖 | `{ shell: string, script: string }` | — |
| `zellij web --start` / `--status` / `--stop` | (out of scope) | — | `zellij web` is its own subsystem, internal-only WebSocket gateway for the bundled web client |

## Session management

| zellij CLI | Tool | Returns | Notes |
|---|---|---|---|
| `zellij ls` / `list-sessions` | `zj_session_ls` 📖 | `string[]` (session names) | — |
| `zellij list-sessions --short` | (same; auto) | — | compact form for fast model consumption |
| `zellij list-aliases` | `zj_session_aliases` 📖 | `{ aliases: AliasEntry[] }` | plugin aliases |
| `zellij attach [NAME] [-c\|--create] [-b]` | `zj_session_attach` ✏️ | `{ session: string }` | — |
| `zellij attach --initial-command ...` | `zj_session_attach_cmd` ✏️ | `{ session, paneId }` | runs command on attach |
| `zellij attach --index N` | (flag on attach) | — | — |
| `zellij watch [NAME]` | `zj_session_watch` ✏️ | `{ session }` | read-only attach helper |
| `zellij kill-session [NAME]` | `zj_session_kill` 💥 | `{ killed: string }` | alias `k` |
| `zellij delete-session [NAME] [-f]` | `zj_session_delete` 💥 | `{ deleted: string }` | — |
| `zellij kill-all-sessions [--yes]` | `zj_session_kill_all` 💥 | `{ killed: string[] }` | alias `ka` |
| `zellij delete-all-sessions [--yes] [-f]` | `zj_session_delete_all` 💥 | `{ deleted: string[] }` | — |
| `zellij run -- CMD...` | `zj_pane_spawn` ✏️ | `{ paneId, command, spawnedAt }` | opens a new pane running the command |
| — (introspection) | `zj_session_attach_info` 📖 | `{ session, paneId, isInZellij }` | calling agent's session + pane id from `ZELLIJ_PANE_ID` env |

## `zellij action` — pane mutation

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `new-pane` / `new-blocking-pane` / `new-tiled-pane` / `new-floating-pane` / `new-in-place-pane` / `new-stacked-pane` | `zj_pane_spawn` ✏️ | `{ paneId, command, spawnedAt }` | mode flag selects variant |
| `run` / `run-in-background` | (rolled into `zj_pane_spawn`) | — | `run-in-background` is a flag, not a separate tool |
| `edit <PATH>` | `zj_pane_edit` ✏️ | `{ paneId }` | opens file in user's editor |
| `close-pane` | `zj_pane_close` 💥 | `{ closed: paneId }` | — |
| `clear` | `zj_pane_clear` ✏️ | `{ cleared: paneId }` | — |
| `rename-pane [name]` | `zj_pane_rename` ✏️ | `{ paneId, name }` | — |
| `undo-rename-pane` | `zj_pane_undo_rename` ✏️ | `{ paneId }` | — |
| `resize [direction]` | `zj_pane_resize` ✏️ | `{ resized: paneId }` | direction enum: `left\|right\|up\|down` |
| `move-focus [direction]` | `zj_pane_move_focus` ✏️ | `{ focused: paneId }` | — |
| `move-focus-or-tab [direction]` | `zj_pane_move_focus_or_tab` ✏️ | `{ focused: paneId\|tabId }` | — |
| `move-pane [direction]` | `zj_pane_move` ✏️ | `{ moved: paneId }` | — |
| `move-pane-backwards` | `zj_pane_move_backwards` ✏️ | `{ moved: paneId }` | — |
| `focus-next-pane` / `focus-previous-pane` / `focus-last-pane` | `zj_pane_focus_next` / `_prev` / `_last` ✏️ | `{ focused: paneId }` | — |
| `focus-pane-id <ID>` | `zj_pane_focus` ✏️ | `{ focused: paneId }` | — |
| `toggle-pane-embed-or-floating` | `zj_pane_toggle_embedded` ✏️ | `{ paneId, isEmbedded: boolean }` | — |
| `toggle-floating-panes` | `zj_pane_toggle_floating` ✏️ | `{ visible: boolean }` | — |
| `show-floating-panes` / `hide-floating-panes` | `zj_pane_floating_show` / `_hide` ✏️ | `{ visible: boolean }` | — |
| `are-floating-panes-visible` | `zj_pane_floating_visible` 📖 | `{ visible: boolean, tabId?: TabId }` | — |
| `toggle-pane-pinned` | `zj_pane_toggle_pinned` ✏️ | `{ paneId, isPinned: boolean }` | — |
| `toggle-pane-borderless` / `set-pane-borderless` / `set-pane-border-style` | `zj_pane_set_borderless` / `_border_style` ✏️ | `{ paneId, borderless?, style? }` | — |
| `set-pane-color` | `zj_pane_set_color` ✏️ | `{ paneId }` | fg / bg |
| `change-floating-pane-coordinates` | `zj_pane_set_floating_coords` ✏️ | `{ paneId }` | — |
| `stack-panes <ids...>` | `zj_pane_stack` ✏️ | `{ stacked: PaneId[] }` | — |
| `toggle-fullscreen` / `toggle-no-ui-fullscreen` | `zj_pane_toggle_fullscreen` ✏️ | `{ paneId, isFullscreen: boolean }` | — |
| `toggle-pane-frames` | `zj_pane_toggle_frames` ✏️ | `{ framesVisible: boolean }` | — |
| `set-pane-frame-style` | `zj_pane_set_frame_style` ✏️ | `{ applied: boolean }` | — |
| `toggle-active-sync-tab` | `zj_pane_toggle_sync_tab` ✏️ | `{ synced: boolean }` | — |
| `break-pane` / `break-pane-left` / `break-pane-right` | `zj_pane_break` ✏️ | `{ newTabId, newPaneId }` | — |
| `scroll-up-at` / `scroll-down-at` | `zj_pane_scroll_at` ✏️ | `{ position: number }` | by viewport position |
| `scroll-to-previous-prompt` / `scroll-to-next-prompt` | `zj_pane_scroll_to_prompt` ✏️ | `{ found: boolean, line: number }` | — |
| `select-command-at-scroll-position` | `zj_pane_select_command_at` ✏️ | `{ line: string }` | — |
| `copy-last-command-output` | `zj_pane_copy_last_output` ✏️ | `{ output: string }` | — |

By-id variants (`CloseFocusByPaneId`, `ScrollUpByPaneId`, etc.) are
folded into their base tool via an optional `paneId` parameter — they
don't need separate tools.

## `zellij action` — tab mutation

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `new-tab [--name N]` | `zj_tab_new` ✏️ | `{ tabId, name? }` | — |
| `close-tab` | `zj_tab_close` 💥 | `{ closed: tabId }` | — |
| `close-tab-by-id <ID>` | `zj_tab_close_id` 💥 | `{ closed: tabId }` | — |
| `go-to-tab <idx>` | `zj_tab_goto` ✏️ | `{ tabId }` | — |
| `go-to-tab-by-id <ID>` | `zj_tab_goto_id` ✏️ | `{ tabId }` | — |
| `go-to-tab-name <NAME> [-c]` | `zj_tab_goto_name` ✏️ | `{ tabId, created: boolean }` | -c creates if missing |
| `go-to-next-tab` / `go-to-previous-tab` | `zj_tab_next` / `zj_tab_prev` ✏️ | `{ tabId }` | — |
| `rename-tab [name]` / `rename-tab-by-id` | `zj_tab_rename` / `zj_tab_rename_id` ✏️ | `{ tabId, name }` | — |
| `undo-rename-tab` | `zj_tab_undo_rename` ✏️ | `{ tabId }` | — |
| `move-tab <dir>` | `zj_tab_move` ✏️ | `{ tabId }` | — |
| `move-tab-to-position` | `zj_tab_move_to` ✏️ | `{ tabId, position: number }` | — |
| `next-swap-layout` / `previous-swap-layout` | `zj_layout_swap_next` / `_prev` ✏️ | `{ applied: string }` | — |
| `apply-tiled-swap-layout <NAME>` | `zj_layout_apply_swap_tiled` ✏️ | `{ applied: string }` | — |
| `apply-floating-swap-layout <NAME>` | `zj_layout_apply_swap_floating` ✏️ | `{ applied: string }` | — |
| `override-layout [--layout PATH\|--layout-string KDL] [--retain-existing-terminal-panes] [--retain-existing-plugin-panes] [--apply-only-to-active-tab]` | `zj_layout_apply` ✏️ | `{ panes: PaneId[], tabs?: TabId[] }` | the atomic N-pane spawner |
| `toggle-tab` | `zj_tab_toggle` ✏️ | `{ tabId, visible: boolean }` | — |

## `zellij action` — plugin actions

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `launch-plugin --url <URL>` | `zj_plugin_launch` ✏️ | `{ pluginId, paneId }` | full flag set |
| `launch-or-focus-plugin` | `zj_plugin_launch_or_focus` ✏️ | `{ pluginId, paneId, focused: boolean }` | — |
| `start-or-reload-plugin --url <URL>` | `zj_plugin_reload` ✏️ | `{ pluginId }` | — |
| `new-tiled-plugin-pane` / `new-floating-plugin-pane` / `new-in-place-plugin-pane` | (rolled into `zj_plugin_launch`) | — | mode flag selects variant |
| `pipe` (KeybindPipe / CliPipe) | `zj_pipe_send` ✏️ | `{ delivered: boolean }` | no built-in pipe names; payload goes to a plugin |
| `message-plugin` (keybind only) | (out of scope) | — | keybind-only action, no CLI surface |

## `zellij action` — input

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `write <bytes...> --pane-id` | `zj_pane_send_bytes` ✏️ | `{ paneId, bytes: number }` | raw bytes |
| `write-chars "<text>" --pane-id` | `zj_pane_write_chars` ✏️ | `{ paneId, written: number }` | literal chars |
| `paste "<text>" --pane-id` | `zj_pane_paste` ✏️ | `{ paneId, pasted: number }` | bracketed-paste mode |
| `send-keys <KEYS...> --pane-id` | `zj_pane_send_keys` ✏️ | `{ paneId, keys: string[] }` | key syntax: `"Ctrl a"`, `"Alt Tab"`, `"F1"`, etc. |

## `zellij action` — scroll / dump / edit

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `scroll-up` / `scroll-down` / `scroll-to-top` / `scroll-to-bottom` | `zj_pane_scroll_up` / `_down` / `_to_top` / `_to_bottom` ✏️ | `{ paneId, position: number }` | — |
| `page-scroll-up` / `page-scroll-down` | `zj_pane_page_scroll_up` / `_down` ✏️ | `{ paneId }` | — |
| `half-page-scroll-up` / `half-page-scroll-down` | `zj_pane_half_page_scroll_up` / `_down` ✏️ | `{ paneId }` | — |
| `dump-screen [--path FILE \| --full \| --pane-id \| --ansi]` | `zj_pane_read_screen` 📖 | `string` | text or ANSI |
| `dump-layout` | `zj_layout_dump` 📖 | `string` (KDL) | — |
| `edit-scrollback [--pane-id] [--ansi]` | `zj_pane_edit_scrollback` ✏️ | `{ paneId }` | opens in $EDITOR |

## `zellij action` — session-level mutation

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `detach` | `zj_session_detach` 💥 | `{ detached: boolean }` | detaches current client |
| `save-session` | `zj_session_save` ✏️ | `{ saved: string }` | persists layout |
| `rename-session <NAME>` | `zj_session_rename` ✏️ | `{ name }` | — |
| `switch-session <NAME> [--tab-position --pane-id --layout --layout-string --layout-dir --cwd]` | `zj_session_switch` ✏️ | `{ session }` | — |
| `set-dark-theme` / `set-light-theme` / `toggle-theme` | `zj_theme_set_dark` / `_set_light` / `_toggle` ✏️ | `{ theme: "dark"\|"light" }` | — |
| `switch-to-mode { input_mode }` | `zj_mode_switch` ✏️ | `{ mode: string }` | `normal`, `locked`, `pane`, `tab`, `resize`, `move`, `prompt`, `tmux` |
| `switch-mode-for-all-clients { input_mode }` | `zj_mode_switch_all` ✏️ | `{ mode: string }` | — |
| `toggle-mouse-mode` | `zj_mouse_toggle` ✏️ | `{ enabled: boolean }` | — |
| `dismiss-info-popups` | `zj_ui_dismiss_popups` ✏️ | `{ dismissed: number }` | — |
| `open-context-menu` | `zj_ui_open_context_menu` ✏️ | `{ opened: boolean }` | — |

## `zellij action` — search (incremental, not regex)

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `search-input { input }` | `zj_search_input` ✏️ | `{ accepted: string }` | feeds zellij's incremental search |
| `search { direction }` | `zj_search` ✏️ | `{ found: boolean, line?: number }` | `down` / `up` |
| `search-toggle-option { option }` | `zj_search_toggle_option` ✏️ | `{ option, enabled: boolean }` | toggle case/whole-word/regex |

These are distinct from `zj_pane_subscribe`'s regex match mode — they
drive zellij's built-in incremental search UI.

## `zellij action` — structured reads

| zellij action | Tool | Returns | Notes |
|---|---|---|---|
| `list-panes --json` | `zj_pane_list` 📖 | `PaneInfo[]` | outputSchema: PaneInfo[] |
| `list-tabs --json` | `zj_tab_list` 📖 | `TabInfo[]` | outputSchema: TabInfo[] |
| `current-tab-info --json` | `zj_tab_current` 📖 | `TabInfo` | outputSchema: TabInfo |
| `list-clients` | `zj_clients_list` 📖 | `ClientInfo[]` | plain-text, parsed |
| `query-tab-names` | `zj_tab_query_names` 📖 | `string[]` | plain-text |
| `dump-screen` / `dump-layout` | (rolled into read tools) | — | — |

## `zellij subscribe` — pane render stream

| zellij CLI | Tool | Returns | Notes |
|---|---|---|---|
| `zellij subscribe --format json --pane-id ...` | `zj_pane_subscribe` 🔁 | `{ viewport, scrollback?, matched?, lastEvent }` | streaming; modes: `until-prompt` / `for-duration` / `until-match` |
| `zellij subscribe --scrollback [N]` | (flag on subscribe) | — | — |
| `zellij subscribe --ansi` | (flag on subscribe) | — | — |

## `zellij prompt` — popup UI

| zellij CLI | Tool | Returns | Notes |
|---|---|---|---|
| `zellij promptconfirm ...` | `zj_prompt_confirm` ✏️ | `{ answered: boolean, choice?: boolean, exitCode: 0\|1\|124 }` | 0=answered / 1=cancelled / 124=timeout |
| `zellij promptchoose ...` | `zj_prompt_choose` ✏️ | `{ choice?: string, exitCode }` | — |
| `zellij promptinput ...` | `zj_prompt_input` ✏️ | `{ value?: string, exitCode }` | — |
| `zellij promptnumber ...` | `zj_prompt_number` ✏️ | `{ value?: number, exitCode }` | — |
| `zellij prompttoggle ...` | `zj_prompt_toggle` ✏️ | `{ value?: boolean, exitCode }` | — |
| `zellij promptselect ...` | `zj_prompt_select` ✏️ | `{ value?: string, exitCode }` | — |
| `zellij promptmenu ...` | `zj_prompt_menu` ✏️ | `{ value?: string, exitCode }` | — |
| `zellij promptform ...` | `zj_prompt_form` ✏️ | `{ values: Record<string,string>, exitCode }` | — |
| `zellij promptnotify ...` | `zj_prompt_notify` ✏️ | `{ delivered: boolean }` | — |

## Multitask layer (built on the above)

| Tool | Composed of | Returns | Notes |
|---|---|---|---|
| `zj_farm_spawn` ✏️ | `zj_layout_apply` or N × `zj_pane_spawn` | `{ tabId?, handles: WorkerHandle[] }` | — |
| `zj_farm_collect` ⏳ | N × `zj_pane_wait_exit` (parallel) | `{ results: { paneId, exitStatus, screen }[], timedOut: boolean }` | with deadline |
| `zj_farm_status` 📖 | N × `zj_pane_read_screen` (parallel) | `{ paneId, screen }[]` | — |
| `zj_pane_wait_for` ⏳ | `zj_pane_subscribe` + regex match | `{ matched: boolean, line?, lineNo?, context?: string[], lastViewport: string[] }` | — |
| `zj_pane_collect_lines` 📖 | `zj_pane_read_screen --full` + regex | `{ matches: { line, lineNo }[] }` | — |
| `zj_farm_reduce` 📖 | `zj_pane_read_screen` per handle + reducer | varies by mode: `max` returns `{ screen, matches }`; `sum` returns `{ matches[] }`; `all` returns `{ paneId, count }[]` | — |
| `zj_pane_pipe` (phase 6) ✏️ | `zj_pane_read_screen` + `zj_pane_write_chars` | `{ fromPane, toPane, bytes }` | replays one pane's scrollback into another's PTY |

## Deliberately not wrapped

These `Action` variants from the source-of-truth enum are intentionally
not exposed as tools:

| Action | Reason |
|---|---|
| `Quit` | exits the user's session — never automate |
| `MouseEvent` | requires a real terminal, not meaningful for an agent |
| `Copy` | depends on user selection, model can't drive |
| `Confirm` / `Deny` / `SkipConfirm` | only meaningful inside a `promptconfirm` flow |
| `NoOp` | nothing to do |
| `PaneNameInput` / `TabNameInput` | intermediate keystrokes for the rename mode; use the rename tool instead |
| `MessagePlugin` | keybind-only, no CLI surface |
| `FocusHostSession` / `FocusGuestSession` | for nested zellij sessions, niche |
| `ToggleHostFullscreen` | same |

## Total coverage

| Category | CliAction variants | Tools | Notes |
|---|---|---|---|
| Top-level (options, setup) | 10 | 9 | `web` out of scope |
| Session group | 11 | 11 | 1:1 |
| Pane mutation | 38 + by-id variants | ~28 | by-id folded in as `paneId` param |
| Tab mutation | 16 + by-id variants | ~14 | by-id folded in |
| Plugin actions | 6 | 3 | variants folded in |
| Input | 6 | 4 | — |
| Scroll/dump/edit | 12 | 11 | — |
| Session-level | 13 | 13 | includes new search and mode-switch |
| Search | 3 | 3 | distinct from subscribe-regex |
| Structured reads | 6 | 6 | rolled into `query.ts` |
| Subscribe | 1 | 1 | — |
| Prompt | 9 | 9 | 1:1 |
| **Multitask (composed)** | — | 7 | — |
| **Total** | ~130 CliActions + 20 session/utility | **~80 tools** (counting by-id as separate tools; ~50 unique tool names) | 100% of public CLI surface reachable |

The "by-id" variants are the main reason the tool count exceeds the
CliAction count when enumerated separately: many CliActions have a
`Foo` and `FooByPaneId` / `FooByTabId` form, and we expose both via
optional `paneId` / `tabId` parameters on a single tool. From the
model's perspective, every action is reachable through a tool with a
sensible parameter shape.