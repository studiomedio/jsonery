import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { sortKeys } from '../src/core/sort'
import { TWO, dedent } from './helpers'

function sorted(input: string, scope: 'recursive' | 'topLevel' = 'recursive'): string {
  const result = sortKeys(input, scope, TWO)
  assert.ok(result.ok, 'expected valid JSON')
  return result.text
}

test('sorts keys recursively, preserving layout', () => {
  const input = dedent(`
    {
      "b": {"z": 1, "y": 2},
      "a": [3, 2, 1],
      "c": [{"q": 1, "p": 2}]
    }`)
  assert.equal(sorted(input), dedent(`
    {
      "a": [3, 2, 1],
      "b": {"y": 2, "z": 1},
      "c": [{"p": 2, "q": 1}]
    }`))
})

test('top level leaves nested objects alone', () => {
  assert.equal(sorted('{"b": {"z": 1, "y": 2}, "a": 1}', 'topLevel'), '{"a": 1, "b": {"z": 1, "y": 2}}')
})

test('top level of an array root sorts each element', () => {
  assert.equal(sorted('[{"b": 1, "a": 2}, {"d": {"y": 1, "x": 2}, "c": 0}]', 'topLevel'), '[{"a": 2, "b": 1}, {"c": 0, "d": {"y": 1, "x": 2}}]')
})

test('comments travel with their property', () => {
  const input = dedent(`
    { // settings
      // about b
      "b": 1, // b trailing
      /* about a */
      "a": 2 // a trailing
      // footer
    }`)
  assert.equal(sorted(input), dedent(`
    { // settings
      /* about a */
      "a": 2, // a trailing
      // about b
      "b": 1 // b trailing
      // footer
    }`))
})

test('multi-line values keep their inner layout', () => {
  const input = dedent(`
    {
      "z": {
        "n": 1,
        "m": [
          1, 2
        ]
      },
      "a": true
    }`)
  assert.equal(sorted(input), dedent(`
    {
      "a": true,
      "z": {
        "m": [
          1, 2
        ],
        "n": 1
      }
    }`))
})

test('natural, case-insensitive order', () => {
  assert.equal(sorted('{"item10": 0, "Item2": 0, "item1": 0, "b": 0, "B": 0}'), '{"B": 0, "b": 0, "item1": 0, "Item2": 0, "item10": 0}')
})

test('keeps trailing comma and literals', () => {
  assert.equal(sorted('{\n  "b": 1.0,\n  "a": 12345678901234567890,\n}'), '{\n  "a": 12345678901234567890,\n  "b": 1.0,\n}')
})

test('compact objects stay compact', () => {
  assert.equal(sorted('{"b":1,"a":2}'), '{"a":2,"b":1}')
})

test('single-line block comments', () => {
  assert.equal(sorted('{ "b": 1 /* b */, /* a */ "a": 2 }'), '{ /* a */ "a": 2, "b": 1 /* b */ }')
})

test('surrounding text and CRLF are preserved', () => {
  const crlf = sortKeys('{\r\n  "b": 1,\r\n  "a": 2\r\n}\r\n', 'recursive', { ...TWO, eol: '\r\n' })
  assert.deepEqual(crlf, { ok: true, text: '{\r\n  "a": 2,\r\n  "b": 1\r\n}\r\n' })
})

test('already sorted input is unchanged', () => {
  const input = '{\n  "a": 1,\n  "b": {\n    "c": 2\n  }\n}\n'
  assert.equal(sorted(input), input)
})

test('refuses invalid JSON', () => {
  assert.equal(sortKeys('{"b": 1 "a": 2}', 'recursive', TWO).ok, false)
})
