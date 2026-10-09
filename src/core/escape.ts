import type { FormatSettings, UnescapeResult } from '../types/json'
import { formatText, minify } from './format'

/**
 * Turn text into a JSON string literal: `{"a": 1}` → `"{\"a\":1}"`.
 * Valid JSON is minified first (the usual shape of an embedded payload); anything else is escaped verbatim.
 */
export function escapeToString(text: string): string {
  const compact = minify(text)
  return JSON.stringify(compact.ok ? compact.text : text)
}

/**
 * Decode a JSON string literal — with or without its surrounding quotes. When the decoded content is
 * itself JSON (a "stringified" payload) it is pretty-printed.
 */
export function unescapeString(text: string, settings: FormatSettings): UnescapeResult {
  const trimmed = text.trim()
  const quoted = trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')
  let decoded: unknown
  try {
    decoded = JSON.parse(quoted ? trimmed : `"${trimmed}"`)
  } catch {
    return { ok: false, message: 'Not a valid JSON string literal.' }
  }
  if (typeof decoded !== 'string') return { ok: false, message: 'Not a valid JSON string literal.' }

  const formatted = formatText(decoded, { ...settings, insertFinalNewline: false })
  if (formatted.ok && /^\s*[[{]/.test(decoded)) return { ok: true, text: formatted.text, isJson: true }
  return { ok: true, text: decoded, isJson: false }
}
