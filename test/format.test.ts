import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formatText, indentFollowingLines, lineIndentAt, minify } from '../src/core/format'
import { FOUR, TABS, TWO, dedent } from './helpers'

test('format pretty-prints minified JSON', () => {
  const result = formatText('{"a":1,"b":[1,2],"c":{}}', TWO)
  assert.deepEqual(result, { ok: true, text: dedent(`
    {
      "a": 1,
      "b": [
        1,
        2
      ],
      "c": {}
    }`) })
})

test('format keeps comments, big numbers and number literals', () => {
  const input = '{\n// note\n"big": 12345678901234567890, "f": 1.0, "e": 1e+3, "s": "\\u00e9"}'
  const result = formatText(input, FOUR)
  assert.ok(result.ok)
  assert.equal(result.text, '{\n    // note\n    "big": 12345678901234567890,\n    "f": 1.0,\n    "e": 1e+3,\n    "s": "\\u00e9"\n}')
})

test('format with tabs', () => {
  assert.deepEqual(formatText('{"a":{"b":1}}', TABS), { ok: true, text: '{\n\t"a": {\n\t\t"b": 1\n\t}\n}' })
})

test('format with keepLines only re-indents', () => {
  const result = formatText('{\n"a": [1, 2],\n      "b": 2\n}', FOUR, true)
  assert.ok(result.ok)
  assert.equal(result.text, '{\n    "a": [ 1, 2 ],\n    "b": 2\n}')
})

test('format refuses invalid JSON with a position', () => {
  const result = formatText('{\n  "a": 1\n  "b": 2\n}', TWO)
  assert.equal(result.ok, false)
  assert.ok(!result.ok)
  assert.equal(result.issue.message, 'Comma expected')
  assert.equal(result.issue.line, 3)
  assert.equal(result.issue.column, 3)
})

test('format accepts JSONC trailing commas', () => {
  assert.ok(formatText('{"a": 1,}', TWO).ok)
})

test('minify strips whitespace and comments, keeps literals', () => {
  const input = '{\n  // c\n  "a": [1.0, 2] /* x */,\n  "s": "a  b\\n"\n}'
  assert.deepEqual(minify(input), { ok: true, text: '{"a":[1.0,2],"s":"a  b\\n"}' })
})

test('minify refuses invalid JSON', () => {
  assert.equal(minify('{"a": }').ok, false)
})

test('indentFollowingLines', () => {
  assert.equal(indentFollowingLines('{\n  "a": 1\n}', '    '), '{\n      "a": 1\n    }')
  assert.equal(indentFollowingLines('{\n\n}', '  '), '{\n\n  }')
})

test('lineIndentAt', () => {
  const text = 'a\n    "x": 1\n\tb'
  assert.equal(lineIndentAt(text, 0), '')
  assert.equal(lineIndentAt(text, 8), '    ')
  assert.equal(lineIndentAt(text, text.length - 1), '\t')
})
