import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { foldTargets } from '../src/core/fold'

test('foldTargets reports containers with depth', () => {
  const text = '{"a": {"b": [1, {"c": 2}]}, "d": []}'
  const targets = foldTargets(text).map((t) => `${t.kind}@${t.depth}:${text.slice(t.start, t.end)}`)
  assert.deepEqual(targets, [
    'object@0:' + text,
    'object@1:{"b": [1, {"c": 2}]}',
    'array@2:[1, {"c": 2}]',
    'object@3:{"c": 2}',
    'array@1:[]',
  ])
})

test('foldTargets tolerates syntax errors', () => {
  assert.ok(foldTargets('{"a": {"b": 1}, "c": ').length >= 2)
})
