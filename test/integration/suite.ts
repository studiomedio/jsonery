import { strict as assert } from 'node:assert'
import * as vscode from 'vscode'

// Runs inside a real VS Code instance (see run.js). Minimal runner — no mocha needed.
const cases: [string, () => Promise<void>][] = []
const test = (name: string, fn: () => Promise<void>) => cases.push([name, fn])

async function open(content: string, language = 'json'): Promise<vscode.TextEditor> {
  const document = await vscode.workspace.openTextDocument({ content, language })
  const editor = await vscode.window.showTextDocument(document)
  editor.options = { tabSize: 2, insertSpaces: true }
  return editor
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function closeAll(): Promise<void> {
  await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor')
}

test('extension activates on a JSON file and registers commands', async () => {
  await open('{}')
  await pause(300)
  const commands = await vscode.commands.getCommands(true)
  for (const id of ['jsonery.format', 'jsonery.sortKeys', 'jsonery.foldToLevel', 'jsonery.unescape']) {
    assert.ok(commands.includes(id), `${id} is registered`)
  }
  await closeAll()
})

test('format document', async () => {
  const editor = await open('{"a":1,"big":12345678901234567890,"b":[1.0]}')
  await vscode.commands.executeCommand('jsonery.format')
  assert.equal(editor.document.getText(), '{\n  "a": 1,\n  "big": 12345678901234567890,\n  "b": [\n    1.0\n  ]\n}')
  await closeAll()
})

test('format selection inside a non-JSON file', async () => {
  const editor = await open('log line\n    payload: {"a":{"b":1}} end', 'plaintext')
  const line = editor.document.lineAt(1).text
  const start = line.indexOf('{')
  editor.selection = new vscode.Selection(1, start, 1, line.lastIndexOf('}') + 1)
  await vscode.commands.executeCommand('jsonery.format')
  assert.equal(editor.document.getText(), 'log line\n    payload: {\n      "a": {\n        "b": 1\n      }\n    } end')
  await closeAll()
})

test('Jsonery is offered as a document formatter', async () => {
  const editor = await open('{"a":1}')
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    'vscode.executeFormatDocumentProvider',
    editor.document.uri,
    { tabSize: 4, insertSpaces: true },
  )
  assert.ok(edits && edits.length > 0, 'formatter returned edits')
  await closeAll()
})

test('minify keeps literals', async () => {
  const editor = await open('{\n  // comment\n  "n": 1.50\n}')
  await vscode.commands.executeCommand('jsonery.minify')
  assert.equal(editor.document.getText(), '{"n":1.50}')
  await closeAll()
})

test('change indentation re-indents and updates editor options', async () => {
  const editor = await open('{\n  "a": {\n    "b": [1, 2]\n  }\n}')
  await vscode.commands.executeCommand('jsonery.changeIndentation', 4)
  assert.equal(editor.document.getText(), '{\n    "a": {\n        "b": [ 1, 2 ]\n    }\n}')
  assert.equal(editor.options.tabSize, 4)
  await vscode.commands.executeCommand('jsonery.changeIndentation', 'tab')
  assert.equal(editor.document.getText(), '{\n\t"a": {\n\t\t"b": [ 1, 2 ]\n\t}\n}')
  assert.equal(editor.options.insertSpaces, false)
  await closeAll()
})

test('sort keys keeps comments with their property', async () => {
  const editor = await open('{\n  // about b\n  "b": 1,\n  "a": {"d": 1, "c": 2}\n}', 'jsonc')
  await vscode.commands.executeCommand('jsonery.sortKeys')
  assert.equal(editor.document.getText(), '{\n  "a": {"c": 2, "d": 1},\n  // about b\n  "b": 1\n}')
  await closeAll()
})

test('invalid JSON is never modified', async () => {
  const content = '{"a": 1 "b": 2}'
  const editor = await open(content)
  // The error message is shown non-modally; don't await the command's dialog.
  void vscode.commands.executeCommand('jsonery.sortKeys')
  void vscode.commands.executeCommand('jsonery.format')
  await pause(300)
  assert.equal(editor.document.getText(), content)
  await closeAll()
})

test('fold to level 1 hides nested containers', async () => {
  const lines = ['{', '  "a": {', '    "x": 1,', '    "y": 2', '  },', '  "b": [', '    1,', '    2', '  ]', '}']
  const editor = await open(lines.join('\n'))
  await pause(500) // let the JSON language server compute folding ranges
  await vscode.commands.executeCommand('jsonery.foldToLevel', 1)
  await pause(200)
  const visible = new Set<number>()
  for (const range of editor.visibleRanges) for (let l = range.start.line; l <= range.end.line; l++) visible.add(l)
  // VS Code reports visible ranges around folded regions; folded lines 2-3 and 6-7 must be hidden.
  assert.ok(editor.visibleRanges.length >= 2, `expected folded regions, got ${JSON.stringify(editor.visibleRanges)}`)
  assert.ok(!visible.has(2) && !visible.has(6), 'nested lines are folded')
  await vscode.commands.executeCommand('jsonery.unfoldAll')
  await closeAll()
})

test('copy JSON path', async () => {
  const editor = await open('{"users": [{"name": "Ann"}]}')
  const offset = editor.document.getText().indexOf('Ann')
  const position = editor.document.positionAt(offset)
  editor.selection = new vscode.Selection(position, position)
  await vscode.commands.executeCommand('jsonery.copyPath')
  assert.equal(await vscode.env.clipboard.readText(), '$.users[0].name')
  await closeAll()
})

test('unescape a stringified value in place', async () => {
  const editor = await open('{\n  "body": "{\\"id\\":1,\\"tags\\":[\\"x\\"]}"\n}')
  const position = editor.document.positionAt(editor.document.getText().indexOf('id'))
  editor.selection = new vscode.Selection(position, position)
  await vscode.commands.executeCommand('jsonery.unescape')
  assert.equal(editor.document.getText(), '{\n  "body": {\n    "id": 1,\n    "tags": [\n      "x"\n    ]\n  }\n}')
  await closeAll()
})

test('escape selection round-trips with unescape', async () => {
  const editor = await open('{"a": "q\\"uote"}', 'plaintext')
  editor.selection = new vscode.Selection(0, 0, 0, editor.document.lineAt(0).text.length)
  await vscode.commands.executeCommand('jsonery.escape')
  assert.equal(editor.document.getText(), '"{\\"a\\":\\"q\\\\\\"uote\\"}"')
  editor.selection = new vscode.Selection(0, 0, 0, editor.document.lineAt(0).text.length)
  await vscode.commands.executeCommand('jsonery.unescape')
  assert.equal(editor.document.getText(), '{\n  "a": "q\\"uote"\n}')
  await closeAll()
})

test('format on paste', async () => {
  await vscode.workspace.getConfiguration('jsonery').update('formatOnPaste', true, vscode.ConfigurationTarget.Global)
  try {
    const editor = await open('{\n  "data": \n}')
    const position = new vscode.Position(1, 10)
    editor.selection = new vscode.Selection(position, position)
    await vscode.env.clipboard.writeText('{"a":1,"b":[true]}')
    await vscode.commands.executeCommand('editor.action.clipboardPasteAction')
    await pause(500)
    assert.equal(editor.document.getText(), '{\n  "data": {\n    "a": 1,\n    "b": [\n      true\n    ]\n  }\n}')
    await closeAll()
  } finally {
    await vscode.workspace.getConfiguration('jsonery').update('formatOnPaste', undefined, vscode.ConfigurationTarget.Global)
  }
})

export async function run(): Promise<void> {
  const failures: string[] = []
  for (const [name, fn] of cases) {
    try {
      await fn()
      console.log(`  ✔ ${name}`)
    } catch (error) {
      console.log(`  ✘ ${name}\n${String((error as Error).stack ?? error).replace(/^/gm, '      ')}`)
      failures.push(name)
      await vscode.commands.executeCommand('workbench.action.closeAllEditors')
    }
  }
  console.log(`\n${cases.length - failures.length} passed, ${failures.length} failed`)
  if (failures.length > 0) throw new Error(`${failures.length} integration test(s) failed`)
}
