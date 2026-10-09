import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { escapeToString, unescapeString } from '../src/core/escape'
import { TWO } from './helpers'

test('escape minifies JSON into a string literal', () => {
  assert.equal(escapeToString('{\n  "a": "x\\"y",\n  "n": 1.0\n}'), '"{\\"a\\":\\"x\\\\\\"y\\",\\"n\\":1.0}"')
})

test('escape falls back to plain text', () => {
  assert.equal(escapeToString('line 1\nsay "hi"'), '"line 1\\nsay \\"hi\\""')
})

test('unescape round-trips and formats JSON payloads', () => {
  assert.deepEqual(unescapeString('"{\\"a\\":1,\\"b\\":[true]}"', TWO), {
    ok: true,
    isJson: true,
    text: '{\n  "a": 1,\n  "b": [\n    true\n  ]\n}',
  })
})

test('unescape works without surrounding quotes', () => {
  assert.deepEqual(unescapeString('{\\"a\\":1}', TWO), { ok: true, isJson: true, text: '{\n  "a": 1\n}' })
})

test('unescape plain strings', () => {
  assert.deepEqual(unescapeString('"a\\tb"', TWO), { ok: true, isJson: false, text: 'a\tb' })
  assert.deepEqual(unescapeString('"42"', TWO), { ok: true, isJson: false, text: '42' })
})

test('unescape rejects broken literals', () => {
  assert.equal(unescapeString('"abc', TWO).ok, false)
})
