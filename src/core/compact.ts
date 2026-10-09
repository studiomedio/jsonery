import { type Node, SyntaxKind, createScanner } from 'jsonc-parser'
import type { OffsetEdit, Span } from '../types/json'
import { applyOffsetEdits } from './edits'
import { parse } from './parse'

/**
 * Collapse arrays and objects of already-formatted JSON onto one line when they fit within
 * `maxWidth` (indentation, key and trailing comma included). Works top-down, so an object too
 * long for one line can still have short arrays inside it. Containers holding comments stay as is.
 */
export function compactContainers(text: string, maxWidth: number, within?: Span): string {
  const { tree } = parse(text)
  if (!tree) return text
  const replacements: OffsetEdit[] = []

  const visit = (node: Node) => {
    const start = node.offset
    const end = node.offset + node.length
    if (within && (end <= within.start || start >= within.end)) return
    if (node.type === 'property') {
      const value = node.children?.[1]
      if (value) visit(value)
      return
    }
    if ((node.type !== 'object' && node.type !== 'array') || !node.children?.length) return

    const fullyInside = !within || (start >= within.start && end <= within.end)
    const lineBreak = text.indexOf('\n', start)
    if (lineBreak === -1 || lineBreak >= end) return // already on one line
    if (fullyInside) {
      const inline = renderInline(text, start, end)
      if (inline !== undefined) {
        const column = start - (text.lastIndexOf('\n', start - 1) + 1)
        const comma = text[end] === ',' ? 1 : 0
        if (column + inline.length + comma <= maxWidth) {
          replacements.push({ offset: start, length: node.length, content: inline })
          return
        }
      }
    }
    for (const child of node.children) visit(child)
  }
  visit(tree)

  return applyOffsetEdits(text, replacements)
}

/** One-line rendering — `{ "a": 1, "b": [1, 2] }` — or undefined if the range contains comments. */
function renderInline(text: string, start: number, end: number): string | undefined {
  const scanner = createScanner(text.slice(start, end), false)
  let out = ''
  let previous: SyntaxKind | undefined
  for (let token = scanner.scan(); token !== SyntaxKind.EOF; token = scanner.scan()) {
    switch (token) {
      case SyntaxKind.Trivia:
      case SyntaxKind.LineBreakTrivia:
        continue
      case SyntaxKind.LineCommentTrivia:
      case SyntaxKind.BlockCommentTrivia:
        return undefined
      case SyntaxKind.CloseBraceToken:
        out += previous === SyntaxKind.OpenBraceToken ? '}' : ' }'
        break
      case SyntaxKind.CloseBracketToken:
        out += ']'
        break
      case SyntaxKind.CommaToken:
        out += ','
        break
      case SyntaxKind.ColonToken:
        out += ': '
        break
      default:
        if (previous === SyntaxKind.CommaToken || previous === SyntaxKind.OpenBraceToken) out += ' '
        // Raw token text (`{`, `[`, strings, numbers, literals) — never re-serialised.
        out += text.slice(start + scanner.getTokenOffset(), start + scanner.getTokenOffset() + scanner.getTokenLength())
    }
    previous = token
  }
  return out
}
