# Jsonery — VS Code extension

A small, reliable JSON toolkit for VS Code: format, minify, change indentation, fold to a level,
sort keys, see the JSON path under the cursor, and escape/unescape stringified JSON.

**Your file is never damaged.** Jsonery edits the text through Microsoft's `jsonc-parser` (the
parser VS Code itself uses) instead of a `JSON.parse` / `JSON.stringify` round-trip, so:

- comments in JSONC files (`tsconfig.json`, `settings.json`, …) are kept,
- big numbers stay exact — `12345678901234567890` doesn't turn into `12345678901234567000`,
- number literals and escapes stay as written — `1.0` stays `1.0`, `"é"` stays `"é"`,
- invalid JSON is **never** modified — you get the error position and a *Go to Error* button instead.

Works on JSON, JSONC and JSON Lines, in desktop VS Code and in vscode.dev / github.dev. One runtime
dependency, no telemetry.

## Features

- **Format** — the whole document, or just the selection. A selection inside a JSON file is
  formatted in context; a selection in *any* other file (a log, a test, a markdown note) is
  formatted as a standalone value and indented to fit its line.
- **Minify** — strips whitespace and comments from the document or selection.
- **Change Indentation…** — 2 spaces, 4 spaces or tabs. Re-indents the document while keeping its
  line structure (compact `[1, 2, 3]` arrays stay on one line) and switches the editor to the new
  indentation. The current indentation is shown in the status bar — click it to change.
- **Fold to Level…** — *Level 1* shows only the top-level keys, *Level 2* one level deeper, and so on.
  Plus **Fold All Arrays**, **Fold All Objects** and **Unfold All**.
- **Sort Keys** — *Recursive* or *Top Level* (for an array of objects, top level means each element).
  Natural, case-insensitive order (`item2` before `item10`). The original text of every property
  is moved as-is, so the layout is kept and comments travel with the property they describe.
- **JSON path in the status bar** — `$.users[3].address.city` for the value under the cursor.
  Click it (or run **Copy JSON Path**) to copy it. JSONPath, jq or JavaScript style.
- **Escape as JSON String** — `{"a": 1}` → `"{\"a\":1}"`, for embedding a payload in another document.
- **Unescape JSON String** — the reverse, pretty-printed. With the cursor on a stringified value
  and nothing selected, it expands in place — `"body": "{\"id\":1}"` becomes a real nested
  object, indented to fit. If the result is still a string (double-encoded), run it again.
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

All commands are in the Command Palette under **Jsonery:** and in the editor context menu under
**Jsonery**. With no selection, a command works on the whole document.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `jsonery.formatOnPaste` | `false` | Format JSON objects/arrays pasted into JSON and JSONC files |
| `jsonery.path.style` | `jsonpath` | Path style: `jsonpath` (`$.a[0].b`), `jq` (`.a[0].b`) or `js` (`a[0].b`) |
| `jsonery.statusBar.path` | `true` | Show the JSON path of the cursor in the status bar |
| `jsonery.statusBar.indentation` | `true` | Show the indentation in the status bar |

Indentation comes from the editor — VS Code detects it from the file, or set it per language:

```json
"[json]": { "editor.tabSize": 2, "editor.insertSpaces": true }
```

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
