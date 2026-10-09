import type { RepairFix, RepairFrame, RepairOptions, RepairResult, RepairToken } from '../types/json'
import { parse } from './parse'

// "Repair JSON" turns almost-JSON (JavaScript object literals, Python reprs, JSON5, text copied out
// of chat apps and logs) into valid JSON. It works on a tolerant token stream and rewrites only what
// is broken, so the layout survives and the result can be formatted afterwards. If the outcome still
// isn't valid JSON, nothing is applied.

const WHITESPACE = /[ \t\r\n\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000\ufeff]/
const NUMBER = /[+-]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/y
const VALID_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/
const WORD_END = /[\s{}[\]:,"'`“”‘’/#;=()]/
const SIMPLE_ESCAPES = '"\\/bfnrt'

const CLOSERS: Record<string, string[]> = {
  '"': ['"'],
  "'": ["'"],
  '`': ['`'],
  '“': ['”', '“', '"'],
  '”': ['”', '“', '"'],
  '‘': ['’', '‘'],
  '’': ['’', '‘'],
}

const LITERALS: Record<string, string> = {
  True: 'true', TRUE: 'true', False: 'false', FALSE: 'false',
  None: 'null', NONE: 'null', Null: 'null', NULL: 'null', nil: 'null', undefined: 'null',
  NaN: 'null', Infinity: 'null', '+Infinity': 'null', '-Infinity': 'null',
}

// `const data = {…};`, `module.exports = […]`, `callback({…})` — keep only the JSON part.
const ASSIGNMENT_PREFIX = /^\s*(?:export\s+default\s+|(?:(?:const|let|var)\s+)?[\w$.]+\s*=\s*)(?=[[{])/
const CALL_PREFIX = /^\s*[\w$.]+\s*\(\s*(?=[[{])/

export function repair(source: string, options: RepairOptions): RepairResult {
  const fixes: Partial<Record<RepairFix, number>> = {}
  const fix = (kind: RepairFix, count = 1) => {
    fixes[kind] = (fixes[kind] ?? 0) + count
  }

  const text = unwrap(source, fix)
  const tokens = lex(text, fix)
  const out = new Emitter()

  const stack: RepairFrame[] = []
  let rootDone = false
  let rootCommaPiece = -1
  let rootCount = 0
  let firstRootPiece = -1

  /** Called before a value token; repairs whatever separator is missing in front of it. */
  function beginValue(): 'key' | 'value' {
    const top = stack[stack.length - 1]
    if (!top) {
      // Several top-level values (e.g. JSON Lines pasted into a .json file) — joined into an array at the end.
      if (rootDone) out.appendToLast(',')
      if (firstRootPiece === -1) firstRootPiece = out.pieces.length
      rootCount++
      return 'value'
    }
    if (top.state === 'comma') {
      out.appendToLast(',')
      fix('missingComma')
      top.state = top.kind === 'object' ? 'key' : 'value'
    }
    if (top.kind === 'object') {
      if (top.state === 'colon') {
        out.appendToLast(':')
        fix('missingColon')
        top.state = 'value'
      }
      return top.state === 'key' ? 'key' : 'value'
    }
    return 'value'
  }

  function endValue(): void {
    const top = stack[stack.length - 1]
    if (top) {
      top.state = 'comma'
      top.afterComma = false
    } else {
      rootDone = true
    }
  }

  function close(frame: RepairFrame, closer: string): void {
    if (frame.afterComma && (frame.state === 'key' || frame.state === 'value')) {
      out.pieces[frame.commaPiece] = ''
      fix('trailingComma')
    } else if (frame.kind === 'object' && frame.state === 'colon') {
      out.appendToLast(': null')
      fix('missingValue')
    } else if (frame.kind === 'object' && frame.state === 'value') {
      out.appendToLast(' null')
      fix('missingValue')
    }
    out.push(closer, true)
  }

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    switch (token.kind) {
      case 'space':
        out.push(token.text, false)
        break

      case 'comment':
        if (options.keepComments) out.push(token.raw, false)
        else {
          out.dropComment()
          fix('comment')
        }
        break

      case 'other':
        fix('stray')
        break

      case 'string':
      case 'number':
      case 'word': {
        const role = beginValue()
        const top = stack[stack.length - 1]
        if (role === 'key') {
          if (token.kind === 'string') out.push(token.text, true)
          else {
            out.push(JSON.stringify(token.raw), true)
            fix('unquotedKey')
          }
          top!.state = 'colon'
          break
        }
        if (token.kind !== 'word') {
          out.push(token.text, true)
        } else if (token.raw === 'true' || token.raw === 'false' || token.raw === 'null') {
          out.push(token.raw, true)
        } else if (token.raw in LITERALS) {
          out.push(LITERALS[token.raw], true)
          fix('literal')
        } else {
          // An unquoted value may span several words on one line: {name: John Smith}
          let value = token.raw
          while (
            tokens[i + 1]?.kind === 'space' && !/\n/.test(tokens[i + 1].raw) &&
            (tokens[i + 2]?.kind === 'word' || tokens[i + 2]?.kind === 'number')
          ) {
            value += tokens[i + 1].raw + tokens[i + 2].raw
            i += 2
          }
          out.push(JSON.stringify(value), true)
          fix('unquotedValue')
        }
        endValue()
        break
      }

      case 'punct': {
        const top = stack[stack.length - 1]
        const char = token.raw
        if (char === '{' || char === '[') {
          // (A container where a key belongs can't be repaired sensibly — final validation rejects it.)
          beginValue()
          out.push(char, true)
          stack.push({ kind: char === '{' ? 'object' : 'array', state: char === '{' ? 'key' : 'value', afterComma: false, commaPiece: -1 })
        } else if (char === '}' || char === ']') {
          const kind = char === '}' ? 'object' : 'array'
          let match = stack.length - 1
          while (match >= 0 && stack[match].kind !== kind) match--
          if (match === -1) {
            fix('bracket')
            break
          }
          while (stack.length - 1 > match) {
            const unclosed = stack.pop()!
            close(unclosed, unclosed.kind === 'object' ? '}' : ']')
            fix('bracket')
            endValue()
          }
          close(stack.pop()!, char)
          endValue()
        } else if (char === ':') {
          if (top?.kind === 'object' && top.state === 'colon') {
            out.push(':', true)
            top.state = 'value'
          } else {
            fix('stray')
          }
        } else if (char === ',') {
          if (!top) {
            // `{…}, {…}` at the top level: several values, wrapped into an array at the end.
            if (rootDone) {
              out.push(',', true)
              rootDone = false
              rootCommaPiece = out.pieces.length - 1
            } else {
              fix('extraComma')
            }
            break
          }
          if (top.state === 'comma') {
            out.push(',', true)
            top.state = top.kind === 'object' ? 'key' : 'value'
            top.afterComma = true
            top.commaPiece = out.pieces.length - 1
          } else if (top.kind === 'object' && (top.state === 'colon' || top.state === 'value')) {
            out.appendToLast(top.state === 'colon' ? ': null' : ' null', true)
            fix('missingValue')
            out.push(',', true)
            top.state = 'key'
            top.afterComma = true
            top.commaPiece = out.pieces.length - 1
          } else {
            fix('extraComma')
          }
        }
        break
      }
    }
  }

  while (stack.length > 0) {
    const unclosed = stack.pop()!
    close(unclosed, unclosed.kind === 'object' ? '}' : ']')
    fix('bracket')
    endValue()
  }

  // A dangling separator after the last top-level value.
  if (!rootDone && rootCommaPiece >= 0) {
    out.pieces[rootCommaPiece] = ''
    fix('extraComma')
  }
  if (rootCount > 1) {
    out.pieces[firstRootPiece] = '[' + out.pieces[firstRootPiece]
    out.appendToLast(']')
    fix('multipleValues', rootCount)
  }

  const repaired = out.pieces.join('')

  const { issue } = parse(repaired)
  if (issue) return { ok: false, issue: parse(source).issue ?? issue, fixes }
  return { ok: true, text: repaired, fixes }
}

function unwrap(text: string, fix: (kind: RepairFix) => void): string {
  const call = CALL_PREFIX.exec(text)
  const prefix = call ?? ASSIGNMENT_PREFIX.exec(text)
  const body = prefix ? text.slice(prefix[0].length) : text
  const unwrapped = body.replace(call ? /\)\s*;?(\s*)$/ : /;(\s*)$/, '$1')
  if (prefix || unwrapped !== body) fix('stray')
  return unwrapped
}

/** Output pieces, with helpers to patch separators onto the last emitted token. */
class Emitter {
  readonly pieces: string[] = []
  private significant: number[] = []
  private stripNextNewline = false

  push(text: string, significant: boolean): void {
    if (!significant && this.stripNextNewline) {
      text = text.replace(/^[ \t]*\r?\n/, '')
    }
    this.stripNextNewline = false
    this.pieces.push(text)
    if (significant) this.significant.push(this.pieces.length - 1)
  }

  lastSignificant(): number {
    return this.significant.length > 0 ? this.significant[this.significant.length - 1] : -1
  }

  /** Patch `text` onto the last token; `tight` also drops same-line whitespace emitted after it. */
  appendToLast(text: string, tight = false): void {
    const last = this.lastSignificant()
    if (last < 0) return
    this.pieces[last] += text
    if (tight) {
      for (let i = last + 1; i < this.pieces.length; i++) if (/^[ \t]*$/.test(this.pieces[i])) this.pieces[i] = ''
    }
  }

  /** Remove a comment and the whitespace it leaves behind (a whole comment line disappears). */
  dropComment(): void {
    let i = this.pieces.length - 1
    while (i >= 0 && this.pieces[i] === '') i--
    if (i >= 0 && /^\s*$/.test(this.pieces[i])) this.pieces[i] = this.pieces[i].replace(/[ \t]+$/, '')
    while (i >= 0 && this.pieces[i] === '') i--
    this.stripNextNewline = i < 0 || this.pieces[i].endsWith('\n')
  }
}

function lex(text: string, fix: (kind: RepairFix) => void): RepairToken[] {
  const tokens: RepairToken[] = []
  const n = text.length
  let i = 0
  const push = (kind: RepairToken['kind'], start: number, end: number, normalized?: string) => {
    const raw = text.slice(start, end)
    tokens.push({ kind, raw, text: normalized ?? raw, offset: start })
  }

  while (i < n) {
    const c = text[i]

    if (WHITESPACE.test(c)) {
      const start = i
      while (i < n && WHITESPACE.test(text[i])) i++
      const raw = text.slice(start, i)
      const normalized = raw.replace(/\ufeff/g, '').replace(/[^ \t\r\n]/g, ' ')
      if (normalized !== raw) fix('stray')
      push('space', start, i, normalized)
      continue
    }

    if ((c === '/' && text[i + 1] === '/') || c === '#') {
      const start = i
      while (i < n && text[i] !== '\n' && text[i] !== '\r') i++
      push('comment', start, i)
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const start = i
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? n : end + 2
      push('comment', start, i)
      continue
    }

    if ('{}[]:,'.includes(c)) {
      push('punct', i, ++i)
      continue
    }

    if (c in CLOSERS) {
      const start = i
      const { end, value } = lexString(text, i, fix)
      i = end
      if (c === "'" || c === '`') fix('singleQuotes')
      else if (c !== '"') fix('smartQuotes')
      push('string', start, i, value)
      continue
    }

    NUMBER.lastIndex = i
    const number = NUMBER.exec(text)
    if (number && (i + number[0].length >= n || WORD_END.test(text[i + number[0].length]))) {
      const raw = number[0]
      const normalized = normalizeNumber(raw)
      if (normalized !== raw) fix('number')
      push('number', i, i + raw.length, normalized)
      i += raw.length
      continue
    }

    if (';=()'.includes(c)) {
      push('other', i, ++i)
      continue
    }

    const start = i
    while (i < n && !WORD_END.test(text[i])) i++
    if (i === start) i++ // a lone '/' that does not start a comment
    push('word', start, i)
  }
  return tokens
}

/** Read a string starting at `start` (any quote style); returns the JSON double-quoted form. */
function lexString(text: string, start: number, fix: (kind: RepairFix) => void): { end: number; value: string } {
  const closers = CLOSERS[text[start]]
  let out = '"'
  let i = start + 1
  while (i < text.length) {
    const ch = text[i]
    if (ch === '\\') {
      const next = text[i + 1]
      if (next !== undefined && SIMPLE_ESCAPES.includes(next)) {
        out += '\\' + next
        i += 2
      } else if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(i + 2, i + 6))) {
        out += text.slice(i, i + 6)
        i += 6
      } else if (next === "'" || next === '`') {
        out += next
        i += 2
        fix('escape')
      } else if (next === 'x' && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 2, i + 4))) {
        out += '\\u00' + text.slice(i + 2, i + 4)
        i += 4
        fix('escape')
      } else if (next === '\n' || next === '\r') {
        // Line continuation: drop the backslash and the line break.
        i += next === '\r' && text[i + 2] === '\n' ? 3 : 2
        fix('escape')
      } else {
        // Unknown escape (typically a Windows path like C:\Users) — keep the backslash literally.
        out += '\\\\'
        i += 1
        fix('escape')
      }
      continue
    }
    if (closers.includes(ch)) return { end: i + 1, value: out + '"' }
    if (ch === '"') {
      out += '\\"'
      fix('singleQuotes')
    } else if (ch < ' ') {
      out += ch === '\n' ? '\\n' : ch === '\r' ? '\\r' : ch === '\t' ? '\\t' : '\\u' + ch.charCodeAt(0).toString(16).padStart(4, '0')
      fix('controlCharacter')
    } else {
      out += ch
    }
    i++
  }
  fix('stray') // unterminated string, closed at the end of the text
  return { end: text.length, value: out + '"' }
}

function normalizeNumber(raw: string): string {
  if (VALID_NUMBER.test(raw)) return raw
  let sign = ''
  let body = raw
  if (body[0] === '+' || body[0] === '-') {
    sign = body[0] === '-' ? '-' : ''
    body = body.slice(1)
  }
  if (/^0[xX]/.test(body)) return sign + BigInt(body).toString()
  if (body.startsWith('.')) body = '0' + body
  body = body.replace(/\.(?=[eE]|$)/, '.0')
  body = body.replace(/^0+(?=\d)/, '')
  return sign + body
}
