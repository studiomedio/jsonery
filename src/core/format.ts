import { SyntaxKind, applyEdits, createScanner, format } from 'jsonc-parser'
import type { EditsResult, FormatScope, FormatSettings, JsonResult } from '../types/json'
import { parse } from './parse'

// Everything here edits the source text through jsonc-parser instead of a JSON.parse/stringify
// round-trip, so comments, key order, number literals (1.0, 12345678901234567890) and escape
// sequences survive untouched.

/** Minimal edits that pretty-print `text` (or a region of it). Refuses invalid JSON. */
export function formatEdits(text: string, settings: FormatSettings, scope: FormatScope = {}): EditsResult {
  const { issue } = parse(text)
  if (issue) return { ok: false, issue }
  const edits = format(text, scope.range, {
    tabSize: settings.tabSize,
    insertSpaces: settings.insertSpaces,
    eol: settings.eol,
    insertFinalNewline: settings.insertFinalNewline,
    keepLines: scope.keepLines ?? false,
  })
  return { ok: true, edits }
}

/** Pretty-print a standalone piece of JSON. */
export function formatText(text: string, settings: FormatSettings, keepLines = false): JsonResult {
  const result = formatEdits(text, settings, { keepLines })
  if (!result.ok) return result
  return { ok: true, text: applyEdits(text, result.edits) }
}

/** Remove all insignificant whitespace and comments. Refuses invalid JSON. */
export function minify(text: string): JsonResult {
  const { issue } = parse(text)
  if (issue) return { ok: false, issue }

  const scanner = createScanner(text, false)
  let out = ''
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    switch (token) {
      case SyntaxKind.Trivia:
      case SyntaxKind.LineBreakTrivia:
      case SyntaxKind.LineCommentTrivia:
      case SyntaxKind.BlockCommentTrivia:
        break
      default:
        // Copy the raw token (not getTokenValue) so string escapes and number literals stay as written.
        out += text.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength())
    }
  }
  return { ok: true, text: out }
}

/** Prefix every line but the first with `indent` — for inserting a block mid-line. */
export function indentFollowingLines(text: string, indent: string): string {
  if (!indent) return text
  return text.replace(/\r?\n(?=[^\r\n])/g, (eol) => eol + indent)
}

/** Leading whitespace of the line containing `offset`. */
export function lineIndentAt(text: string, offset: number): string {
  const leading = /[ \t]*/y
  leading.lastIndex = text.lastIndexOf('\n', offset - 1) + 1
  return leading.exec(text)![0]
}

/** True if `text` is a JSON object or array (the only values worth formatting on their own). */
export function isContainer(text: string): boolean {
  const { tree } = parse(text)
  return tree?.type === 'object' || tree?.type === 'array'
}
