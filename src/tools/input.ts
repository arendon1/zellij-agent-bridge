/**
 * src/tools/input.ts — send input to a pane.
 *
 * Phase 3 deliverables:
 *
 *   zj_pane_write_chars  → `zellij action write-chars "<text>" --pane-id <id>`
 *                          (writes literal chars to the pane's PTY)
 *   zj_pane_paste        → `zellij action paste "<text>" --pane-id <id>`
 *                          (bracketed-paste mode, for terminals that distinguish)
 *   zj_pane_send_keys    → `zellij action send-keys <KEYS...> --pane-id <id>`
 *                          accepts zellij key syntax: "Ctrl a", "Alt Tab",
 *                          "F1", "PageUp", "Enter", "Esc", "BackTab",
 *                          "Left", "Right", "Up", "Down", "Home", "End",
 *                          "Insert", "Delete", plus modifier-prefixed forms.
 *                          Multi-key sequences (e.g. "Ctrl x", "Ctrl c") are
 *                          a single string with comma-separated keys.
 *   zj_pane_send_bytes   → `zellij action write <bytes...> --pane-id <id>`
 *                          (raw bytes — for tools that need exact escape sequences)
 *
 * send_keys() implementation note:
 *   zellij's CLI parses each `send-keys` argument individually. So
 *   `["Ctrl a","Enter"]` becomes two arguments; we split on commas if the
 *   caller passes one string ("Ctrl a,Enter") or accept an array.
 */
export {}; // phase 0 — module body intentionally blank