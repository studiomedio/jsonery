import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { indentationFrom, matchesGlob, parseEditorConfig, resolveEditorConfig } from '../src/core/editorconfig'

test('glob matching', () => {
  assert.ok(matchesGlob('*', 'a/b/c.json'))
  assert.ok(matchesGlob('*.json', 'deep/dir/x.json'))
  assert.ok(!matchesGlob('*.json', 'x.jsonc'))
  assert.ok(matchesGlob('*.{json,jsonc}', 'x.jsonc'))
  assert.ok(matchesGlob('{package.json,.babelrc}', 'web/package.json'))
  assert.ok(matchesGlob('/config/*.json', 'config/a.json'))
  assert.ok(!matchesGlob('/config/*.json', 'other/config/a.json'))
  assert.ok(matchesGlob('src/**/*.json', 'src/a/b/c.json'))
  assert.ok(matchesGlob('src/**/*.json', 'src/c.json'))
  assert.ok(matchesGlob('file[0-9].json', 'file7.json'))
  assert.ok(!matchesGlob('file[!0-9].json', 'file7.json'))
  assert.ok(matchesGlob('v{1..3}.json', 'v2.json'))
  assert.ok(!matchesGlob('v{1..3}.json', 'v4.json'))
})

test('closer files and later sections win', () => {
  const outer = parseEditorConfig('root = true\n[*]\nindent_style = tab\ntab_width = 8\n[*.json]\nindent_size = 4\n')
  const inner = parseEditorConfig('# project\n[*.json]\nindent_style = space\nindent_size = 2\nmax_line_length = 100\ninsert_final_newline = true\n')
  const props = resolveEditorConfig([
    { file: outer, relativePath: 'app/data.json' },
    { file: inner, relativePath: 'data.json' },
  ])
  assert.equal(outer.root, true)
  assert.deepEqual(props, { indentStyle: 'space', indentSize: 2, tabWidth: 8, insertFinalNewline: true, maxLineLength: 100 })
})

test('indentationFrom', () => {
  const fallback = { tabSize: 4, insertSpaces: true }
  assert.deepEqual(indentationFrom({ indentStyle: 'space', indentSize: 2 }, fallback), { tabSize: 2, insertSpaces: true })
  assert.deepEqual(indentationFrom({ indentStyle: 'tab', tabWidth: 8 }, fallback), { tabSize: 8, insertSpaces: false })
  assert.deepEqual(indentationFrom({ indentStyle: 'tab' }, fallback), { tabSize: 4, insertSpaces: false })
  assert.deepEqual(indentationFrom({}, fallback), fallback)
})

test('ignores unknown and invalid values', () => {
  const file = parseEditorConfig('[*]\nindent_size = big\nmax_line_length = off\nindent_style = Space\n')
  assert.deepEqual(resolveEditorConfig([{ file, relativePath: 'a.json' }]), { indentStyle: 'space' })
})
