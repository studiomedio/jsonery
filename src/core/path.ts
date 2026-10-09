import { getLocation } from 'jsonc-parser'
import type { PathSegment, PathStyle } from '../types/json'

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

/** Path of the value at `offset`, e.g. ['users', 3, 'address', 'city']. */
export function pathAt(text: string, offset: number): PathSegment[] {
  const location = getLocation(text, offset)
  const path = [...location.path]
  // In an empty key slot (`{ | }`, after a comma) jsonc-parser reports a trailing '' with no key node.
  if (path[path.length - 1] === '' && !location.previousNode) path.pop()
  return path
}

/** Path of the value at `offset` in a JSON Lines document — relative to the record on that line. */
export function pathAtJsonLines(text: string, offset: number): PathSegment[] {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  const lineEnd = text.indexOf('\n', offset)
  const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
  return pathAt(line, offset - lineStart)
}

export function formatPath(path: PathSegment[], style: PathStyle): string {
  switch (style) {
    case 'jq':
      return path.length === 0
        ? '.'
        : path.map((s) => (typeof s === 'number' ? `[${s}]` : IDENTIFIER.test(s) ? `.${s}` : `.${JSON.stringify(s)}`)).join('').replace(/^\[/, '.[')
    case 'js':
      return path
        .map((s, i) => (typeof s === 'number' ? `[${s}]` : IDENTIFIER.test(s) ? (i === 0 ? s : `.${s}`) : `[${JSON.stringify(s)}]`))
        .join('')
    case 'jsonpath':
    default:
      return '$' + path.map((s) => (typeof s === 'number' ? `[${s}]` : IDENTIFIER.test(s) ? `.${s}` : `['${escapeSingleQuoted(s)}']`)).join('')
  }
}

function escapeSingleQuoted(key: string): string {
  return key.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}
