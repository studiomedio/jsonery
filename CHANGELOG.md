# Changelog

## 0.1.0

Initial release.

- **Format** document or selection — in context inside JSON files, standalone anywhere else.
- **Minify** document or selection.
- **Change Indentation…** — 2 spaces, 4 spaces or tabs; keeps line structure; status bar indicator.
- **Fold to Level…**, **Fold All Arrays**, **Fold All Objects**, **Unfold All**.
- **Sort Keys** (recursive or top level) — natural order, layout kept, comments travel with their property.
- **JSON path** of the cursor in the status bar and **Copy JSON Path** (JSONPath, jq or JS style).
- **Escape as JSON String** / **Unescape JSON String** — including in-place expansion of a stringified value.
- **Format on paste** (opt-in) and **Paste As… → Insert formatted JSON**.
- Document and range **formatter** provider for JSON and JSONC.
- Text-based editing via `jsonc-parser`: comments, big numbers and literals are preserved; invalid JSON is never modified.
- Runs in desktop VS Code and vscode.dev / github.dev.
