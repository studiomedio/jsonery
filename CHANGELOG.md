# Changelog

## 1.0.0

Initial release.

- **Format** document or selection — in context inside JSON files, standalone anywhere else. Three
  styles (`jsonery.format.style`): `expanded` (default), `smart` (short arrays and objects on one
  line within `jsonery.format.maxLineWidth`) and `preserve` (keep line breaks).
- **Minify** document or selection.
- **Repair JSON** — fixes trailing/missing commas, comments, single and smart quotes, unquoted keys
  and values, Python and JavaScript literals, JSON5 numbers, invalid escapes, control characters,
  missing or mismatched brackets, JS/JSONP wrappers and multiple top-level values; reports what it
  fixed and never applies a result that isn't valid JSON. Offered from every "not valid JSON" error.
- **Change Indentation…** — 2 spaces, 4 spaces or tabs; keeps line structure; status bar indicator.
- **Fold to Level…**, **Fold All Arrays**, **Fold All Objects**, **Unfold All**.
- **Sort Keys** (recursive or top level) — natural order, layout kept, comments travel with their property.
- **JSON path** of the cursor in the status bar and **Copy JSON Path** (JSONPath, jq or JS style).
- **Escape as JSON String** / **Unescape JSON String** — including in-place expansion of a stringified value.
- **Format on paste** (opt-in) and **Paste As… → Insert formatted JSON**.
- **JSON Lines** — Format, Minify, Sort Keys and Repair per record; convert between JSON Lines and
  JSON arrays; Open Line as Formatted JSON.
- Document and range **formatter** provider for JSON and JSONC (document formatter for JSON Lines).
- **`.editorconfig` support** — indentation, final newline and line width; editor indentation is
  synced when a JSON file opens. `jsonery.editorconfig` to turn it off.
- Formatting settings are **language-overridable** (`"[jsonc]": { "jsonery.format.style": "smart" }`).
- **Large files** — linear-time operations and merged editor edits (an 11 MB minified file formats
  in about half a second), progress notifications above 2 MB, a clear message for files VS Code
  doesn't share with extensions (over 50 MB).
- Text-based editing via `jsonc-parser`: comments, big numbers and literals are preserved; invalid JSON is never modified.
- Runs in desktop VS Code and vscode.dev / github.dev.
