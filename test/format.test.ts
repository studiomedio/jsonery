import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { applyEdits } from 'jsonc-parser'
import { formatEdits, formatText, indentFollowingLines, lineIndentAt, minify } from '../src/core/format'
import { FOUR, SMART, TABS, TWO, dedent } from './helpers'

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

test('smart style keeps short containers on one line', () => {
  const input = '{"name":"Ann","tags":["a","b"],"pos":{"x":1,"y":2},"long":["aaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbb","cccccccccccccccccccc","dddddddddd"]}'
  const result = formatText(input, SMART)
  assert.ok(result.ok)
  assert.equal(result.text, dedent(`
    {
      "name": "Ann",
      "tags": ["a", "b"],
      "pos": { "x": 1, "y": 2 },
      "long": [
        "aaaaaaaaaaaaaaaaaaaa",
        "bbbbbbbbbbbbbbbbbbbb",
        "cccccccccccccccccccc",
        "dddddddddd"
      ]
    }`))
})

test('smart style puts the whole document on one line when it fits', () => {
  assert.deepEqual(formatText('{"a":[1,2],"b":{}}', SMART), { ok: true, text: '{ "a": [1, 2], "b": {} }' })
})

test('smart style respects maxLineWidth including indentation and comma', () => {
  const input = '{"k":[1,2,3]}'
  // `  "k": [1, 2, 3]` is 16 characters wide.
  assert.equal((formatText(input, { ...SMART, maxLineWidth: 15 }) as { text: string }).text, '{\n  "k": [\n    1,\n    2,\n    3\n  ]\n}')
  assert.equal((formatText(input, { ...SMART, maxLineWidth: 16 }) as { text: string }).text, '{\n  "k": [1, 2, 3]\n}')
})

test('smart style never inlines containers with comments', () => {
  const input = '{\n  "a": [\n    1, // one\n    2\n  ],\n  "b": [1, 2]\n}'
  const result = formatText(input, { ...SMART, maxLineWidth: 30 })
  assert.ok(result.ok)
  assert.equal(result.text, '{\n  "a": [\n    1, // one\n    2\n  ],\n  "b": [1, 2]\n}')
})

test('preserve style keeps line breaks', () => {
  const result = formatText('{\n"a": [1,2], "b": 3\n}', { ...TWO, style: 'preserve' })
  assert.deepEqual(result, { ok: true, text: '{\n  "a": [ 1, 2 ], "b": 3\n}' })
})

test('smart range formatting only collapses inside the range', () => {
  const text = '{\n  "a": [\n    1\n  ],\n  "b": [\n    2\n  ]\n}'
  const start = text.indexOf('"b"')
  const result = formatEdits(text, SMART, { range: { offset: start, length: text.lastIndexOf(']') + 1 - start } })
  assert.ok(result.ok)
  assert.equal(applyEdits(text, result.edits), '{\n  "a": [\n    1\n  ],\n  "b": [2]\n}')
})
