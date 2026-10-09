import { type Node, type ParseError, parseTree, printParseErrorCode } from 'jsonc-parser'
import type { JsonIssue, ParseResult } from '../types/json'

// Tolerant on purpose: Jsonery formats JSON and JSONC alike and is not a linter.
const PARSE_OPTIONS = { allowTrailingComma: true, disallowComments: false, allowEmptyContent: false }

/** Parse into a syntax tree, or report the first syntax error. */
export function parse(text: string): ParseResult {
  const errors: ParseError[] = []
  const tree = parseTree(text, errors, PARSE_OPTIONS)
  if (errors.length > 0 || !tree) {
    const error = errors[0] ?? { error: 0, offset: 0, length: 0 }
    return { issue: toIssue(text, errors.length > 0 ? describe(error.error) : 'Empty content', error.offset) }
  }
  return { tree }
}

/** Parse leniently — returns whatever tree could be recovered, errors or not. */
export function parseLenient(text: string): Node | undefined {
  return parseTree(text, [], PARSE_OPTIONS)
}

export function toIssue(text: string, message: string, offset: number): JsonIssue {
  let line = 1
  let lineStart = 0
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { message, offset, line, column: offset - lineStart + 1 }
}

/** "CommaExpected" → "Comma expected" */
function describe(code: number): string {
  const name = printParseErrorCode(code)
  return name.replace(/(?<=[a-z])(?=[A-Z])/g, ' ').replace(/ ([A-Z])/g, (_, c: string) => ` ${c.toLowerCase()}`)
}
