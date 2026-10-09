import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { repair } from '../src/core/repair'

function fixed(input: string, keepComments = false): string {
  const result = repair(input, { keepComments })
  assert.ok(result.ok, `expected repairable: ${!result.ok ? result.issue.message : ''}`)
  return result.text
}

test('valid JSON is unchanged and reports no fixes', () => {
  const input = '{\n  "a": [1, 2.5e3, -0.1],\n  "b": {"c": null}\n}\n'
  assert.deepEqual(repair(input, { keepComments: false }), { ok: true, text: input, fixes: {} })
})

test('trailing commas', () => {
  assert.equal(fixed('{"a": [1, 2,], "b": 3,}'), '{"a": [1, 2], "b": 3}')
  assert.deepEqual(repair('[1,]', { keepComments: false }).fixes, { trailingComma: 1 })
})

test('JavaScript object literal', () => {
  assert.equal(
    fixed("{name: 'Ann', 'age': 30, tags: ['a', \"b\"], active: true,}"),
    '{"name": "Ann", "age": 30, "tags": ["a", "b"], "active": true}',
  )
})

test('Python repr', () => {
  assert.equal(fixed("{'ok': True, 'value': None, 'list': [False, 1]}"), '{"ok": true, "value": null, "list": [false, 1]}')
})

test('comments are removed in strict JSON and kept in JSONC', () => {
  const input = '{\n  // comment line\n  "a": 1, /* inline */\n  "b": 2 # hash\n}'
  assert.equal(fixed(input), '{\n  "a": 1,\n  "b": 2\n}')
  assert.equal(fixed('{\n  // keep\n  "a": 1,\n}', true), '{\n  // keep\n  "a": 1\n}')
})

test('smart quotes from chat apps and documents', () => {
  assert.equal(fixed('{“name”: “Ann’s”}'), '{"name": "Ann’s"}')
})

test('missing commas between properties and elements', () => {
  assert.equal(fixed('{\n  "a": 1\n  "b": [1 2]\n}'), '{\n  "a": 1,\n  "b": [1, 2]\n}')
})

test('missing and mismatched brackets', () => {
  assert.equal(fixed('{"a": [1, 2'), '{"a": [1, 2]}')
  assert.equal(fixed('{"a": [1, 2}'), '{"a": [1, 2]}')
  assert.equal(fixed('[1, 2]]'), '[1, 2]')
})

test('missing values and colons', () => {
  assert.equal(fixed('{"a": , "b"}'), '{"a": null, "b": null}')
  assert.equal(fixed('{"a" 1}'), '{"a": 1}')
})

test('extra commas', () => {
  assert.equal(fixed('[1,, 2]'), '[1, 2]')
  assert.equal(fixed('{, "a": 1}'), '{ "a": 1}')
})

test('JSON5 numbers', () => {
  assert.equal(fixed('[+1, .5, 5., 0x1F, -.25, 007, 1e3]'), '[1, 0.5, 5.0, 31, -0.25, 7, 1e3]')
  assert.equal(fixed('[NaN, Infinity, -Infinity, undefined]'), '[null, null, null, null]')
})

test('big numbers stay exact', () => {
  assert.equal(fixed('{a: 12345678901234567890}'), '{"a": 12345678901234567890}')
})

test('string escapes and control characters', () => {
  assert.equal(fixed("['it\\'s', 'say \"hi\"']"), '["it\'s", "say \\"hi\\""]')
  assert.equal(fixed('{"path": "C:\\Users\\ann"}'), '{"path": "C:\\\\Users\\\\ann"}')
  assert.equal(fixed('{"text": "line 1\nline 2\tend"}'), '{"text": "line 1\\nline 2\\tend"}')
  assert.equal(fixed('["\\x41"]'), '["\\u0041"]')
})

test('unquoted values, including several words', () => {
  assert.equal(fixed('{status: active, name: John Smith}'), '{"status": "active", "name": "John Smith"}')
})

test('several top-level values become an array', () => {
  assert.equal(fixed('{"a": 1}\n{"a": 2}\n'), '[{"a": 1},\n{"a": 2}]\n')
  assert.equal(fixed('{"a": 1}, {"a": 2},'), '[{"a": 1}, {"a": 2}]')
})

test('JavaScript and JSONP wrappers', () => {
  assert.equal(fixed('const data = {a: 1};\n'), '{"a": 1}\n')
  assert.equal(fixed('module.exports = [1, 2]'), '[1, 2]')
  assert.equal(fixed('callback({"a": 1});'), '{"a": 1}')
})

test('BOM and non-breaking spaces', () => {
  assert.equal(fixed('\ufeff{"a":\u00a01}'), '{"a": 1}')
})

test('unrepairable input is refused with the original error position', () => {
  const result = repair('{"a": 1, {}}', { keepComments: false })
  assert.equal(result.ok, false)
  assert.ok(!result.ok && result.issue.line === 1)
})

test('fix summary counts each kind', () => {
  const result = repair("{a: 'x', b: [1,],}", { keepComments: false })
  assert.ok(result.ok)
  assert.deepEqual(result.fixes, { unquotedKey: 2, singleQuotes: 1, trailingComma: 2 })
})

test('property: random valid JSON is returned byte-for-byte', () => {
  let seed = 42
  const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
  const pick = <T>(items: T[]) => items[Math.floor(random() * items.length)]
  const strings = ['', 'a', 'it\'s', 'say "hi"', 'C:\\dir', 'line\nbreak', 'é', '😀', '//not a comment', '#hash', '\u2028']
  const value = (depth: number): unknown => {
    const r = random()
    if (depth > 3 || r < 0.4) return pick<unknown>([0, -1.5, 1e21, 12, true, false, null, ...strings])
    if (r < 0.7) return Array.from({ length: Math.floor(random() * 4) }, () => value(depth + 1))
    return Object.fromEntries(Array.from({ length: Math.floor(random() * 4) }, (_, i) => [pick(strings) + i, value(depth + 1)]))
  }
  for (let i = 0; i < 500; i++) {
    const text = JSON.stringify(value(0), null, pick([0, 2, 4, '\t']))
    const result = repair(text, { keepComments: false })
    assert.ok(result.ok, text)
    assert.equal(result.text, text)
    assert.deepEqual(result.fixes, {})
  }
})
