import type { OffsetEdit } from '../types/json'

/**
 * Apply non-overlapping edits in one linear pass. (jsonc-parser's `applyEdits` rebuilds the string
 * per edit — quadratic, and minutes on a multi-megabyte minified file.)
 */
export function applyOffsetEdits(text: string, edits: OffsetEdit[]): string {
  if (edits.length === 0) return text
  const sorted = isSorted(edits) ? edits : [...edits].sort((a, b) => a.offset - b.offset)
  const parts: string[] = []
  let cursor = 0
  for (const edit of sorted) {
    parts.push(text.slice(cursor, edit.offset), edit.content)
    cursor = edit.offset + edit.length
  }
  parts.push(text.slice(cursor))
  return parts.join('')
}

/** The smallest single edit turning `before` into `after` (common prefix and suffix trimmed). */
export function minimalEdit(before: string, after: string): OffsetEdit[] {
  if (before === after) return []
  let prefix = 0
  const max = Math.min(before.length, after.length)
  while (prefix < max && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix++
  let suffix = 0
  while (
    suffix < max - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) suffix++
  return [{ offset: prefix, length: before.length - prefix - suffix, content: after.slice(prefix, after.length - suffix) }]
}

function isSorted(edits: OffsetEdit[]): boolean {
  for (let i = 1; i < edits.length; i++) if (edits[i].offset < edits[i - 1].offset) return false
  return true
}
