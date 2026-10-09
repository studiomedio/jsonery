import type { FormatSettings, JsonIssue, JsonResult } from '../types/json'
import { formatText, minify } from './format'
import { parse, toIssue } from './parse'

// JSON Lines (.jsonl / .ndjson): one JSON value per line. Operations run per line and must keep
// every record on a single line.

/**
 * Transform every non-blank line with `fn`, keeping blank lines and line endings. The first failing
 * line aborts the whole operation, reported at its position in the full text.
 */
export function mapLines(text: string, fn: (line: string) => JsonResult): JsonResult {
  const parts = text.split(/(\r?\n)/)
  const out: string[] = []
  let offset = 0
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (i % 2 === 1 || part.trim() === '') {
      out.push(part)
    } else {
      const result = fn(part)
      if (!result.ok) return { ok: false, issue: shift(text, result.issue, offset) }
      if (/[\r\n]/.test(result.text)) {
        return { ok: false, issue: toIssue(text, 'A record would span several lines', offset) }
      }
      out.push(result.text)
    }
    offset += part.length
  }
  return { ok: true, text: out.join('') }
}

/** JSON Lines → a JSON array, formatted with `settings`. */
export function linesToArray(text: string, settings: FormatSettings): JsonResult {
  const records: string[] = []
  const checked = mapLines(text, (line) => {
    const compact = minify(line)
    if (compact.ok) records.push(compact.text)
    return compact
  })
  if (!checked.ok) return checked
  return formatText(`[${records.join(',')}]`, settings)
}

/** A JSON array → JSON Lines, one minified element per line. */
export function arrayToLines(text: string, eol: string): JsonResult {
  const { tree, issue } = parse(text)
  if (issue) return { ok: false, issue }
  if (tree.type !== 'array') return { ok: false, issue: toIssue(text, 'The root value is not an array', tree.offset) }
  const lines: string[] = []
  for (const element of tree.children ?? []) {
    const compact = minify(text.slice(element.offset, element.offset + element.length))
    if (!compact.ok) return { ok: false, issue: shift(text, compact.issue, element.offset) }
    lines.push(compact.text)
  }
  return { ok: true, text: lines.map((line) => line + eol).join('') }
}

/** Re-anchor an issue found in a slice that starts at `offset` of `text`. */
function shift(text: string, issue: JsonIssue, offset: number): JsonIssue {
  return toIssue(text, issue.message, offset + issue.offset)
}
