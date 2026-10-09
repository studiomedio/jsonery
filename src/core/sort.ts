import { type Node, SyntaxKind, createScanner } from 'jsonc-parser'
import type { FormatSettings, GapComments, JsonResult, SortScope, Span } from '../types/json'
import { lineIndentAt } from './format'
import { parse } from './parse'

// Sorting reorders the *original text* of each property instead of re-serialising, so values,
// layout and comments survive. Comments travel with the property they describe:
//   - on the same line after a property (`"a": 1, // note`) → trailing, stays with "a"
//   - on lines above a property → leading, moves with that property
//   - after the last property → stays at the end of the object

// Natural order ("item2" before "item10"), case-insensitive, with a stable case-sensitive tie-break.
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })

function compareKeys(a: string, b: string): number {
  return collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0)
}

export function sortKeys(text: string, scope: SortScope, settings: FormatSettings): JsonResult {
  const { tree, issue } = parse(text)
  if (issue) return { ok: false, issue }

  const raw = (node: Node) => text.slice(node.offset, node.offset + node.length)
  const unit = settings.insertSpaces ? ' '.repeat(settings.tabSize) : '\t'

  // Objects inside arrays share the array's depth, so "top level" of `[{…}, {…}]` means each element.
  function emit(node: Node, depth: number): string {
    if (!node.children?.length) return raw(node)
    if (scope === 'topLevel' && depth > 0) return raw(node)
    if (node.type === 'object' && node.children.length > 1) return sortObject(node, depth)
    return splice(node, node.type === 'object' ? depth + 1 : depth)
  }

  /** The node's own text with each child replaced by its emitted form. */
  function splice(node: Node, childDepth: number): string {
    let out = ''
    let cursor = node.offset
    for (const child of node.children ?? []) {
      out += text.slice(cursor, child.offset) + emit(child, childDepth)
      cursor = child.offset + child.length
    }
    return out + text.slice(cursor, node.offset + node.length)
  }

  function propertyText(property: Node, depth: number): string {
    const value = property.children?.[1]
    if (!value) return raw(property)
    const valueEnd = value.offset + value.length
    return (
      text.slice(property.offset, value.offset) +
      emit(value, depth + 1) +
      text.slice(valueEnd, property.offset + property.length)
    )
  }

  /** Classify the comments between two tokens of an object. */
  function splitGap(start: number, end: number, mode: 'first' | 'between' | 'last', singleLine: boolean): GapComments {
    const result: GapComments = { hasComma: false }
    const scanner = createScanner(text.slice(start, end), false)
    let seenLineBreak = false
    for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
      if (token === SyntaxKind.LineBreakTrivia) seenLineBreak = true
      else if (token === SyntaxKind.CommaToken) result.hasComma = true
      else if (token === SyntaxKind.LineCommentTrivia || token === SyntaxKind.BlockCommentTrivia) {
        const span = { start: start + scanner.getTokenOffset(), end: start + scanner.getTokenOffset() + scanner.getTokenLength() }
        const belongsBefore = singleLine
          ? mode !== 'first' && !result.hasComma
          : !seenLineBreak
        if (belongsBefore) {
          result.trailing = { start: result.trailing?.start ?? span.start, end: span.end }
        } else {
          result.leading = { start: result.leading?.start ?? span.start, end: span.end }
        }
      }
    }
    // Leading comments keep the original line break + indentation in front of the property.
    if (result.leading && mode !== 'last') result.leading.end = end
    return result
  }

  function sortObject(node: Node, depth: number): string {
    const properties = node.children!
    const open = node.offset
    const close = node.offset + node.length - 1
    const singleLine = !/[\r\n]/.test(text.slice(open, close))
    const slice = (span?: Span) => (span ? text.slice(span.start, span.end) : '')

    const gaps: GapComments[] = properties.map((p, i) =>
      i === 0
        ? splitGap(open + 1, p.offset, 'first', singleLine)
        : splitGap(properties[i - 1].offset + properties[i - 1].length, p.offset, 'between', singleLine),
    )
    const last = properties[properties.length - 1]
    const tail = splitGap(last.offset + last.length, close, 'last', singleLine)

    const items = properties.map((property, i) => ({
      key: String(property.children?.[0]?.value ?? ''),
      leading: slice(gaps[i].leading),
      body: propertyText(property, depth),
      trailing: slice(i + 1 < properties.length ? gaps[i + 1].trailing : tail.trailing),
    }))
    const header = slice(gaps[0].trailing)
    const footer = slice(tail.leading)

    items.sort((a, b) => compareKeys(a.key, b.key))

    if (singleLine) {
      const openPad = /^\s*/.exec(text.slice(open + 1, properties[0].offset))![0]
      const closePad = /\s*$/.exec(text.slice(last.offset + last.length, close))![0]
      const firstGap = text.slice(properties[0].offset + properties[0].length, properties[1].offset)
      const separator = /^\s*,\s*$/.test(firstGap) ? firstGap : ', '
      const body = items.map((item) => item.leading + item.body + (item.trailing ? ' ' + item.trailing : '')).join(separator)
      return '{' + openPad + body + (tail.hasComma ? ',' : '') + (footer ? ' ' + footer : '') + closePad + '}'
    }

    const braceIndent = lineIndentAt(text, open)
    const braceLine = lineOf(open)
    const firstOwnLine = properties.find((p) => lineOf(p.offset) !== braceLine)
    const indent = firstOwnLine ? lineIndentAt(text, firstOwnLine.offset) : braceIndent + unit
    const closeOnOwnLine = /^[ \t]*$/.test(text.slice(text.lastIndexOf('\n', close - 1) + 1, close))
    const closeIndent = closeOnOwnLine ? lineIndentAt(text, close) : braceIndent
    const eol = settings.eol

    let out = '{' + (header ? ' ' + header : '')
    items.forEach((item, i) => {
      const comma = i < items.length - 1 || tail.hasComma ? ',' : ''
      out += eol + indent + item.leading + item.body + comma + (item.trailing ? ' ' + item.trailing : '')
    })
    if (footer) out += eol + indent + footer
    return out + eol + closeIndent + '}'
  }

  let lineStarts: number[] | undefined
  function lineOf(offset: number): number {
    if (!lineStarts) {
      lineStarts = [0]
      for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) lineStarts.push(i + 1)
    }
    let low = 0
    let high = lineStarts.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (lineStarts[mid] <= offset) low = mid
      else high = mid - 1
    }
    return low
  }

  const sorted = text.slice(0, tree.offset) + emit(tree, 0) + text.slice(tree.offset + tree.length)
  return { ok: true, text: sorted }
}
