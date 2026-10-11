# API mapping — every zellij CLI surface → bridge tool

> The bridge's coverage goal: **100% of `zellij action <X>`** CliAction
> variants, **100% of the Sessions group** subcommands, and **all
> structured-read outputs**. Below is the planned mapping for every CLI
> surface in `zellij` 0.45+.

Legend:
- 📖 read tool (`readOnlyHint: true`)
- ✏️  mutating tool (`destructiveHint: false`)
- 💥 destructive tool (`destructiveHint: true`)
- 🔁 streaming tool (uses `onUpdate`)
- ⏳ blocking tool (uses ctx.signal for cancel)

## Top-level subcommands

| zellij CLI | Tool | Notes |
|---|---|---|
| `zellij --version` | (internal only) | sanity check at extension load |
| `zellij --help` | (internal only) | — |
| `zellij options [KEY=VALUE...]` | `zj_options_set` ✏️ | CLI overrides for `~/.config/options` |
| `zellij setup --check` | `zj_setup_check` 📖 | validates config without applying |
| `zellij setup --dump-config` | `zj_setup_dump_config` 📖 | returns effective config |
| `zellij setup --dump-layout <NAME>` | `zj_setup_dump_layout` 📖 | `default`, `strider`, `compact`, `disable-status`, `classic`, or custom `.kdl` |
| `zellij setup --dump-swap-layout <NAME>` | `zj_setup_dump_swap_layout` 📖 | — |
| `zellij setup --dump-keybinds <NAME>` | `zj_setup_dump_keybinds` 📖 | — |
| `zellij setup --dump-plugins [<DIR>]` | `zj_setup_dump_plugins` 📖 | — |
| `zellij setup --generate-completion <SHELL>` | `zj_setup_generate_completion` 📖 | — |
| `zellij setup --generate-auto-start <SHELL>` | `zj_setup_generate_autostart` 📖 | — |
| `zellij web --start` / `--status` / `--stop` | (separate concern) | out of scope — `zellij web` is its own subsystem |

## Session management

| zellij CLI | Tool | Notes |
|---|---|---|
| `zellij ls` / `list-sessions` | `zj_session_ls` 📖 | returns string[] of session names |
| `zellij list-sessions --short` | (same; flag auto) | compact form for fast model consumption |
| `zellij list-aliases` | `zj_session_aliases` 📖 | plugin aliases |
| `zellij attach [NAME] [-c\|--create] [-b]` | `zj_session_attach` ✏️ | — |
| `zellij attach --initial-command ...` | `zj_session_attach_cmd` ✏️ | runs command on attach |
| `zellij attach --index N` | (flag on attach) | — |
| `zellij watch [NAME]` | `zj_session_watch` 📖 | read-only attach helper |
| `zellij kill-session [NAME]` | `zj_session_kill` 💥 | alias `k` |
| `zellij delete-session [NAME] [-f]` | `zj_session_delete` 💥 | — |
| `zellij kill-all-sessions [--yes]` | `zj_session_kill_all` 💥 | alias `ka` |
| `zellij delete-all-sessions [--yes] [-f]` | `zj_session_delete_all` 💥 | — |
| `zellij run -- CMD...` | `zj_pane_spawn` ✏️ | opens a new pane running the command (full flag set below) |
| — (introspection) | `zj_session_attach_info` 📖 | returns calling agent's session + pane id (env vars) |

## `zellij action` — pane mutation

Every `CliAction` variant is mapped. Pane IDs are typed `PaneId`.

| zellij action | Tool | Notes |
|---|---|---|
| `new-pane` / `new-blocking-pane` / `new-tiled-pane` | `zj_pane_spawn` ✏️ | — |
| `run -- ...` (also in Sessions) | (rolled into `zj_pane_spawn`) | full flag set |
| `edit <PATH>` | `zj_pane_edit` ✏️ | opens file in user's editor |
| `close-pane` | `zj_pane_close` 💥 | — |
| `clear` | `zj_pane_clear` ✏️ | — |
| `rename-pane [name]` | `zj_pane_rename` ✏️ | — |
| `undo-rename-pane` | `zj_pane_undo_rename` ✏️ | — |
| `resize [direction]` | `zj_pane_resize` ✏️ | direction enum: `left\|right\|up\|down` |
| `move-focus [direction]` | `zj_pane_move_focus` ✏️ | — |
| `move-focus-or-tab [direction]` | `zj_pane_move_focus_or_tab` ✏️ | — |
| `move-pane [direction]` | `zj_pane_move` ✏️ | — |
| `move-pane-backwards` | `zj_pane_move_backwards` ✏️ | — |
| `focus-next-pane` / `focus-previous-pane` / `focus-last-pane` | `zj_pane_focus_next` / `_prev` / `_last` ✏️ | — |
| `focus-pane-id <ID>` | `zj_pane_focus` ✏️ | typed by id |
| `toggle-pane-embed-or-floating` | `zj_pane_toggle_embedded` ✏️ | — |
| `toggle-floating-panes` | `zj_pane_toggle_floating` ✏️ | — |
| `show-floating-panes` / `hide-floating-panes` / `are-floating-panes-visible` | `zj_pane_floating_show` / `_hide` ✏️ + `zj_pane_floating_visible` 📖 | — |
| `toggle-pane-pinned` | `zj_pane_toggle_pinned` ✏️ | — |
| `toggle-pane-borderless` / `set-pane-borderless` / `set-pane-border-style` | `zj_pane_set_borderless` / `_set_border_style` ✏️ | — |
| `set-pane-color` | `zj_pane_set_color` ✏️ | fg / bg |
| `change-floating-pane-coordinates` | `zj_pane_set_floating_coords` ✏️ | — |
| `stack-panes <ids...>` | `zj_pane_stack` ✏️ | — |
| `toggle-fullscreen` / `toggle-no-ui-fullscreen` | `zj_pane_toggle_fullscreen` ✏️ | — |
| `toggle-pane-frames` | `zj_pane_toggle_frames` ✏️ | — |
| `set-pane-frame-style` | `zj_pane_set_frame_style` ✏️ | — |
| `toggle-active-sync-tab` | `zj_pane_toggle_sync_tab` ✏️ | — |

## `zellij action` — tab mutation

| zellij action | Tool | Notes |
|---|---|---|
| `new-tab [--name N]` | `zj_tab_new` ✏️ | returns new tab id |
| `close-tab` | `zj_tab_close` 💥 | — |
| `close-tab-by-id <ID>` | `zj_tab_close_id` 💥 | — |
| `go-to-tab <idx>` | `zj_tab_goto` ✏️ | — |
| `go-to-tab-by-id <ID>` | `zj_tab_goto_id` ✏️ | — |
| `go-to-tab-name <NAME> [-c]` | `zj_tab_goto_name` ✏️ | -c creates if missing |
| `go-to-next-tab` / `go-to-previous-tab` | `zj_tab_next` / `zj_tab_prev` ✏️ | — |
| `rename-tab [name]` / `rename-tab-by-id` | `zj_tab_rename` / `zj_tab_rename_id` ✏️ | — |
| `undo-rename-tab` | `zj_tab_undo_rename` ✏️ | — |
| `move-tab <dir>` | `zj_tab_move` ✏️ | — |
| `next-swap-layout` / `previous-swap-layout` | `zj_layout_swap_next` / `_prev` ✏️ | — |
| `apply-tiled-swap-layout <NAME>` | `zj_layout_apply_swap_tiled` ✏️ | — |
| `apply-floating-swap-layout <NAME>` | `zj_layout_apply_swap_floating` ✏️ | — |
| `override-layout [--layout PATH\|--layout-string KDL] [--retain-existing-terminal-panes] [--retain-existing-plugin-panes] [--apply-only-to-active-tab]` | `zj_layout_apply` ✏️ | the atomic N-pane spawner |
| `toggle-tab` | `zj_tab_toggle` ✏️ | — |

## `zellij action` — plugin actions

| zellij action | Tool | Notes |
|---|---|---|
| `launch-plugin --url <URL>` | `zj_plugin_launch` ✏️ | full flag set |
| `launch-or-focus-plugin` | `zj_plugin_launch_or_focus` ✏️ | — |
| `start-or-reload-plugin --url <URL>` | `zj_plugin_reload` ✏️ | — |
| `pipe` | `zj_pipe_send` ✏️ | full flag set; no built-in pipe names |

## `zellij action` — input

| zellij action | Tool | Notes |
|---|---|---|
| `write <bytes...> --pane-id` | `zj_pane_send_bytes` ✏️ | raw bytes |
| `write-chars "<text>" --pane-id` | `zj_pane_write_chars` ✏️ | literal chars |
| `paste "<text>" --pane-id` | `zj_pane_paste` ✏️ | bracketed-paste mode |
| `send-keys <KEYS...> --pane-id` | `zj_pane_send_keys` ✏️ | key syntax: `"Ctrl a"`, `"Alt Tab"`, `"F1"`, etc. |

## `zellij action` — scroll / dump / edit

| zellij action | Tool | Notes |
|---|---|---|
| `scroll-up` / `scroll-down` / `scroll-to-top` / `scroll-to-bottom` | `zj_pane_scroll_up` / `_down` / `_to_top` / `_to_bottom` ✏️ | — |
| `page-scroll-up` / `page-scroll-down` | `zj_pane_page_scroll_up` / `_down` ✏️ | — |
| `half-page-scroll-up` / `half-page-scroll-down` | `zj_pane_half_page_scroll_up` / `_down` ✏️ | — |
| `dump-screen [--path FILE \| --full \| --pane-id \| --ansi]` | `zj_pane_read_screen` 📖 | text or ANSI |
| `dump-layout` | `zj_layout_dump` 📖 | KDL string |
| `edit-scrollback [--pane-id] [--ansi]` | `zj_pane_edit_scrollback` ✏️ | opens in $EDITOR |

## `zellij action` — session-level mutation

| zellij action | Tool | Notes |
|---|---|---|
| `detach` | `zj_session_detach` 💥 | detaches current client |
| `save-session` | `zj_session_save` ✏️ | persists layout |
| `rename-session <NAME>` | `zj_session_rename` ✏️ | — |
| `switch-session <NAME> [--tab-position --pane-id --layout --layout-string --layout-dir --cwd]` | `zj_session_switch` ✏️ | — |
| `set-dark-theme` / `set-light-theme` / `toggle-theme` | `zj_theme_set_dark` / `_set_light` / `_toggle` ✏️ | — |
| `dismiss-info-popups` | `zj_ui_dismiss_popups` ✏️ | — |
| `open-context-menu` | `zj_ui_open_context_menu` ✏️ | — |

## `zellij action` — structured reads

| zellij action | Tool | Notes |
|---|---|---|
| `list-panes --json` | `zj_pane_list` 📖 | outputSchema: PaneInfo[] |
| `list-tabs --json` | `zj_tab_list` 📖 | outputSchema: TabInfo[] |
| `current-tab-info --json` | `zj_tab_current` 📖 | outputSchema: TabInfo |
| `list-clients` | `zj_clients_list` 📖 | plain-text |
| `query-tab-names` | `zj_tab_query_names` 📖 | plain-text |
| `dump-screen` / `dump-layout` | (rolled into query / layout) | — |

## `zellij subscribe` — pane render stream

| zellij CLI | Tool | Notes |
|---|---|---|
| `zellij subscribe --format json --pane-id ...` | `zj_pane_subscribe` 🔁 | streaming; modes: until-prompt / for-duration / until-match |
| `zellij subscribe --scrollback [N]` | (flag on subscribe) | — |
| `zellij subscribe --ansi` | (flag on subscribe) | — |

## `zellij prompt` — popup UI

| zellij CLI | Tool | Notes |
|---|---|---|
| `zellij promptconfirm ...` | `zj_prompt_confirm` ✏️ | 0=answered / 1=cancelled / 124=timeout |
| `zellij promptchoose ...` | `zj_prompt_choose` ✏️ | — |
| `zellij promptinput ...` | `zj_prompt_input` ✏️ | — |
| `zellij promptnumber ...` | `zj_prompt_number` ✏️ | — |
| `zellij prompttoggle ...` | `zj_prompt_toggle` ✏️ | — |
| `zellij promptselect ...` | `zj_prompt_select` ✏️ | — |
| `zellij promptmenu ...` | `zj_prompt_menu` ✏️ | — |
| `zellij promptform ...` | `zj_prompt_form` ✏️ | — |
| `zellij promptnotify ...` | `zj_prompt_notify` ✏️ | — |

## Multitask layer (built on the above)

| Tool | Composed of | Notes |
|---|---|---|
| `zj_farm_spawn` ✏️ | `zj_layout_apply` or N × `zj_pane_spawn` | returns `WorkerHandle[]` |
| `zj_farm_collect` ⏳ | N × `zj_pane_wait_exit` (parallel) | with deadline |
| `zj_farm_status` 📖 | N × `zj_pane_read_screen` (parallel) | — |
| `zj_pane_wait_for` ⏳ | `zj_pane_subscribe` + regex match | — |
| `zj_pane_collect_lines` 📖 | `zj_pane_read_screen --full` + regex | — |
| `zj_farm_reduce` 📖 | `zj_pane_read_screen` per handle + reducer | modes: max / sum / all |

## Total coverage

| Category | Actions | Tools |
|---|---|---|
| Lifecycle / global | 23 | 23 |
| Input | 6 | 4 |
| Panes | 38 + by-id variants | 26 |
| Tabs | 16 + by-id variants | 14 |
| Plugins | 6 | 3 |
| Search | 3 | 0 (covered by `zj_pane_subscribe` regex mode) |
| Structured reads | 6 | 6 (rolled into query.ts) |
| Session group | 11 | 11 |
| Subscribe | 1 | 1 |
| Prompt | 9 | 9 |
| Multitask | 6 | 6 |
| **Total** | ~120 CliActions + 20 session/utility | ~50 tools |

100% CliAction coverage. Tools are slightly fewer because many CliActions
share a tool (e.g. `move-pane` and `move-pane-backwards` are `direction`
parameters of one tool, not two).