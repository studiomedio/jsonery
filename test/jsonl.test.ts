import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { minify } from '../src/core/format'
import { arrayToLines, linesToArray, mapLines } from '../src/core/jsonl'
import { sortKeys } from '../src/core/sort'
import { SMART, TWO } from './helpers'

test('mapLines minifies each record and keeps blank lines and CRLF', () => {
  assert.deepEqual(mapLines('{ "a": 1 }\r\n\r\n[1, 2]\r\n', minify), { ok: true, text: '{"a":1}\r\n\r\n[1,2]\r\n' })
})

test('mapLines reports the failing line', () => {
  const result = mapLines('{"a": 1}\n{"b": }\n', minify)
  assert.ok(!result.ok)
  assert.equal(result.issue.line, 2)
  assert.equal(result.issue.column, 7)
})

test('sorting JSON Lines sorts each record', () => {
  assert.deepEqual(mapLines('{"b":1,"a":2}\n{"d":0,"c":0}', (l) => sortKeys(l, 'recursive', TWO)), {
    ok: true,
    text: '{"a":2,"b":1}\n{"c":0,"d":0}',
  })
})

test('linesToArray', () => {
  assert.deepEqual(linesToArray('{"a": 1}\n\n{"a": 12345678901234567890}\n', SMART), {
    ok: true,
    text: '[{ "a": 1 }, { "a": 12345678901234567890 }]',
  })
})

test('arrayToLines', () => {
  assert.deepEqual(arrayToLines('[\n  {"a": 1.0},\n  "x",\n  [1, 2]\n]', '\n'), { ok: true, text: '{"a":1.0}\n"x"\n[1,2]\n' })
  assert.equal(arrayToLines('{"a": 1}', '\n').ok, false)
})
