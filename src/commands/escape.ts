import { findNodeAtOffset } from 'jsonc-parser'
import * as vscode from 'vscode'
import { escapeToString, unescapeString } from '../core/escape'
import { indentFollowingLines, lineIndentAt, minify } from '../core/format'
import { parseLenient } from '../core/parse'
import { activeEditor, isJsonDocument, notify, replaceRange, replaceTarget, settingsFor, targetOf } from '../editor'

/** Selection (or document) → JSON string literal, e.g. for embedding a payload in another document. */
export async function escape(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  await replaceTarget(editor, target, escapeToString(target.text))
}

/**
 * JSON string literal → its content. With no selection inside a JSON document, the string value under
 * the cursor is expanded in place: `"body": "{\"id\":1}"` becomes a nested, formatted object.
 */
export async function unescape(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const { document } = editor
  const settings = settingsFor(editor)

  if (editor.selection.isEmpty && (isJsonDocument(document) || document.languageId === 'jsonl')) {
    const node = stringValueAtCursor(editor)
    if (node) {
      const result = unescapeString(document.getText(node), settings)
      if (!result.ok) return void vscode.window.showErrorMessage(`Jsonery: ${result.message}`)
      if (!result.isJson) return notify('this string does not contain JSON')
      const replacement =
        document.languageId === 'jsonl'
          ? minifiedOr(result.text)
          : indentFollowingLines(result.text, lineIndentAt(document.getText(), document.offsetAt(node.start)))
      await replaceRange(editor, node, replacement)
      return
    }
  }

  const target = targetOf(editor)
  const result = unescapeString(target.text, settings)
  if (!result.ok) {
    const hint = target.isSelection ? '' : ' Put the cursor on a string value, or select a string literal.'
    return void vscode.window.showErrorMessage(`Jsonery: ${result.message}${hint}`)
  }
  const replacement = result.isJson
    ? indentFollowingLines(result.text, lineIndentAt(document.getText(), document.offsetAt(target.range.start)))
    : result.text
  await replaceTarget(editor, target, replacement)
}

/** Range of the string *value* (not a property key) under the cursor, if any. */
function stringValueAtCursor(editor: vscode.TextEditor): vscode.Range | undefined {
  const { document } = editor
  const cursor = editor.selection.active
  // JSON Lines: every line is its own document.
  const base = document.languageId === 'jsonl' ? document.offsetAt(new vscode.Position(cursor.line, 0)) : 0
  const text = document.languageId === 'jsonl' ? document.lineAt(cursor.line).text : document.getText()
  const root = parseLenient(text)
  if (!root) return undefined
  const node = findNodeAtOffset(root, document.offsetAt(cursor) - base, true)
  if (node?.type !== 'string') return undefined
  const isKey = node.parent?.type === 'property' && node.parent.children?.[0] === node
  if (isKey) return undefined
  return new vscode.Range(document.positionAt(base + node.offset), document.positionAt(base + node.offset + node.length))
}

function minifiedOr(text: string): string {
  const result = minify(text)
  return result.ok ? result.text : text
}
