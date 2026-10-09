# Jsonery — VS Code extension

A small, reliable JSON toolkit for VS Code: format, minify, repair broken JSON, change indentation,
fold to a level, sort keys, see the JSON path under the cursor, escape/unescape stringified JSON and
work with JSON Lines.

**Your file is never damaged.** Jsonery edits the text through Microsoft's `jsonc-parser` (the
parser VS Code itself uses) instead of a `JSON.parse` / `JSON.stringify` round-trip, so:

- comments in JSONC files (`tsconfig.json`, `settings.json`, …) are kept,
- big numbers stay exact — `12345678901234567890` doesn't turn into `12345678901234567000`,
- number literals and escapes stay as written — `1.0` stays `1.0`, `"\u00e9"` stays `"\u00e9"`,
- invalid JSON is **never** modified — you get the error position, a *Go to Error* button and an
  offer to *Repair JSON* instead.

Works on JSON, JSONC and JSON Lines, in desktop VS Code and in vscode.dev / github.dev. Fast on big files
(an 11 MB minified file formats in about half a second). One runtime dependency, no telemetry.

## Features

### Formatting

- **Format** — the whole document, or just the selection. A selection inside a JSON file is
  formatted in context; a selection in *any* other file (a log, a test, a markdown note) is
  formatted as a standalone value and indented to fit its line. Three styles
  (`jsonery.format.style`):
  - `expanded` (default) — every array and object over several lines, like VS Code's formatter;
  - `smart` — arrays and objects that fit in `jsonery.format.maxLineWidth` (80) stay on one line:

    ```json
    {
      "name": "Ann",
      "tags": ["admin", "editor"],
      "position": { "x": 10, "y": 20 },
      "permissions": [
        "projects.read",
        "projects.write",
        "billing.read",
        "billing.write"
      ]
    }
    ```
  - `preserve` — keeps your line breaks and fixes only indentation and spacing.
- **Minify** — strips whitespace and comments from the document or selection.
- **Repair JSON** — turns almost-JSON into valid JSON and tells you what it fixed: trailing and
  missing commas, comments (kept in JSONC), single and smart quotes (`“…”` from chat apps and
  documents), unquoted keys and values, Python `True` / `False` / `None`, `NaN` / `Infinity` /
  `undefined`, JSON5 numbers (`0x1F`, `.5`, `+1`), invalid escapes (`C:\Users`), raw line breaks
  inside strings, missing or mismatched brackets, `const data = {…};` and `callback({…})` wrappers,
  and several top-level values (joined into an array). Only broken tokens are rewritten, so the
  layout stays; if the result still isn't valid JSON, nothing is changed.
### Indentation, folding and sorting

- **Change Indentation…** — 2 spaces, 4 spaces or tabs. Re-indents the document while keeping its
  line structure (compact `[1, 2, 3]` arrays stay on one line) and switches the editor to the new
  indentation. The current indentation is shown in the status bar — click it to change.
- **Fold to Level…** — *Level 1* shows only the top-level keys, *Level 2* one level deeper, and so on.
  Plus **Fold All Arrays**, **Fold All Objects** and **Unfold All**.
- **Sort Keys** — *Recursive* or *Top Level* (for an array of objects, top level means each element).
  Natural, case-insensitive order (`item2` before `item10`). The original text of every property
  is moved as-is, so the layout is kept and comments travel with the property they describe.
### Navigating and strings

- **JSON path in the status bar** — `$.users[3].address.city` for the value under the cursor.
  Click it (or run **Copy JSON Path**) to copy it. JSONPath, jq or JavaScript style.
- **Escape as JSON String** — `{"a": 1}` → `"{\"a\":1}"`, for embedding a payload in another document.
- **Unescape JSON String** — the reverse, pretty-printed. With the cursor on a stringified value
  and nothing selected, it expands in place — `"body": "{\"id\":1}"` becomes a real nested
  object, indented to fit. If the result is still a string (double-encoded), run it again.
### Pasting and the formatter

- **Format on paste** — pasting a minified object or array into a JSON file inserts it formatted
  (opt-in, see settings). **Paste As… → Insert formatted JSON** is always available, and the paste
  widget can switch back to plain text.
- **Default formatter** — Jsonery can be the JSON formatter for *Format Document*, format on save
  and `editor.formatOnPaste`:

  ```json
  "[json][jsonc]": {
    "editor.defaultFormatter": "studiomedio.jsonery"
  }
  ```

### JSON Lines (`.jsonl`, `.ndjson`)

- **Format**, **Minify**, **Sort Keys** and **Repair JSON** work record by record — every record
  stays on its own line, and an error points at the exact line.
- **Convert JSON Lines to JSON Array** and **Convert JSON Array to JSON Lines** open the result in
  a new editor, leaving the source file alone.
- **Open Line as Formatted JSON** pretty-prints the record under the cursor in a side editor.
- The status bar path is relative to the record on the current line; **Unescape** works in place.

### Large files

Every operation is linear and edits are merged before they reach the editor, so multi-megabyte files
stay responsive; files over 2 MB show a progress notification. The live status bar path switches
off above 5 MB (**Copy JSON Path** still works). VS Code itself doesn't hand files over 50 MB to
extensions — Jsonery tells you when that's the case.

All commands are in the Command Palette under **Jsonery:** and in the editor context menu under
**Jsonery**. With no selection, a command works on the whole document.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `jsonery.format.style` | `expanded` | `expanded`, `smart` or `preserve` (see Formatting) |
| `jsonery.format.maxLineWidth` | `80` | Line width for the `smart` style |
| `jsonery.formatOnPaste` | `false` | Format JSON objects/arrays pasted into JSON and JSONC files |
| `jsonery.editorconfig` | `true` | Honour `.editorconfig` files |
| `jsonery.path.style` | `jsonpath` | Path style: `jsonpath` (`$.a[0].b`), `jq` (`.a[0].b`) or `js` (`a[0].b`) |
| `jsonery.statusBar.path` | `true` | Show the JSON path of the cursor in the status bar |
| `jsonery.statusBar.indentation` | `true` | Show the indentation in the status bar |

The formatting settings can differ per language — for example, smart formatting only for JSONC:

```json
"[jsonc]": { "jsonery.format.style": "smart" }
```

**Indentation** comes from, in order: an explicit **Change Indentation…**, `.editorconfig`, and the
editor (VS Code detects it from the file, or set `"[json]": { "editor.tabSize": 2 }`).

**`.editorconfig`** — Jsonery reads `indent_style`, `indent_size`, `tab_width`,
`insert_final_newline` and `max_line_length` (used as the `smart` line width), and applies the
indentation to JSON editors when they open, so typing matches what Format produces. No separate
EditorConfig extension is needed (it's harmless if you have one). Works in local, remote and
vscode.dev workspaces.

## Keybindings

Jsonery ships without keybindings so it never clashes with yours. Some useful ones:

```json
[
  { "key": "ctrl+alt+f", "command": "jsonery.format", "when": "editorTextFocus" },
  { "key": "ctrl+alt+m", "command": "jsonery.minify", "when": "editorTextFocus" },
  { "key": "ctrl+alt+1", "command": "jsonery.foldToLevel", "args": 1, "when": "editorTextFocus" },
  { "key": "ctrl+alt+2", "command": "jsonery.changeIndentation", "args": 2, "when": "editorTextFocus" },
  { "key": "ctrl+alt+4", "command": "jsonery.changeIndentation", "args": 4, "when": "editorTextFocus" },
  { "key": "ctrl+alt+t", "command": "jsonery.changeIndentation", "args": "tab", "when": "editorTextFocus" }
]
```

`jsonery.foldToLevel` takes a level (1–7); `jsonery.changeIndentation` takes a number of spaces,
`"tab"`, or `{ "tabSize": 4, "insertSpaces": true }`.

## Development

```bash
npm install
npm run watch              # rebuild on change; press F5 to launch the Extension Development Host
npm run typecheck
npm test                   # unit tests (src/core, plain Node)
npm run test:integration   # end-to-end in a downloaded VS Code (cached in .vscode-test/)
npm run package            # -> jsonery-<version>.vsix
```

`src/core` is pure logic with no `vscode` import (unit-tested); `src/commands`, `src/providers` and
`src/statusBar.ts` wire it into the editor. See [PUBLISHING.md](PUBLISHING.md) for releases.

## License

MIT
