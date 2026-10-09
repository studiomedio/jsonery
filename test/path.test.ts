import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { formatPath, pathAt, pathAtJsonLines } from '../src/core/path'

const doc = '{"users": [{"name": "Ann", "my key": {"x": 1}}]}'

test('pathAt resolves nested values', () => {
  assert.deepEqual(pathAt(doc, doc.indexOf('Ann')), ['users', 0, 'name'])
  assert.deepEqual(pathAt(doc, doc.indexOf('"x"') + 1), ['users', 0, 'my key', 'x'])
  assert.deepEqual(pathAt(doc, 0), [])
})

test('formatPath styles', () => {
  const path = ['users', 0, 'my key', 'x']
  assert.equal(formatPath(path, 'jsonpath'), "$.users[0]['my key'].x")
  assert.equal(formatPath(path, 'jq'), '.users[0]."my key".x')
  assert.equal(formatPath(path, 'js'), 'users[0]["my key"].x')
  assert.equal(formatPath([], 'jsonpath'), '$')
  assert.equal(formatPath([], 'jq'), '.')
  assert.equal(formatPath([2, 'a'], 'jq'), '.[2].a')
  assert.equal(formatPath(["it's"], 'jsonpath'), "$['it\\'s']")
})

test('pathAtJsonLines is relative to the record on the line', () => {
  const text = '{"a": 1}\n{"b": {"c": 2}}\n'
  assert.deepEqual(pathAtJsonLines(text, text.indexOf('2')), ['b', 'c'])
})

test('pathAt in an empty key slot points at the container', () => {
  assert.deepEqual(pathAt('{ }', 1), [])
  assert.deepEqual(pathAt('{"a": {"b": 1, }}', 15), ['a'])
  assert.deepEqual(pathAt('{"": 1}', 1), [''])
})
