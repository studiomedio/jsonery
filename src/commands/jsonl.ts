import * as vscode from 'vscode'
import { formatText } from '../core/format'
import { arrayToLines, linesToArray } from '../core/jsonl'
import { activeEditor, isJsonLines, reportIssue, settingsFor, targetOf, withProgress } from '../editor'

/** JSON Lines → a JSON array, opened in a new editor (the source file is left alone). */
export async function linesToArrayCommand(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const settings = await settingsFor(editor)
  const result = await withProgress(editor.document, 'Converting to a JSON array', async () =>
    linesToArray(target.text, { ...settings, insertFinalNewline: true }),
  )
  if (!result.ok) return reportIssue(editor, result.issue, target)
  await openBeside(result.text, 'json')
}

/** A JSON array → JSON Lines, opened in a new editor. */
export async function arrayToLinesCommand(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const settings = await settingsFor(editor)
  const result = await withProgress(editor.document, 'Converting to JSON Lines', async () => arrayToLines(target.text, settings.eol))
  if (!result.ok) return reportIssue(editor, result.issue, target)
  await openBeside(result.text, 'jsonl')
}

/** Pretty-print the record on the cursor's line in a side editor. */
export async function openLineAsJson(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const line = editor.document.lineAt(editor.selection.active.line)
  const target = { range: line.range, text: line.text, isSelection: true }
  if (!isJsonLines(editor.document) && !line.text.trim()) return
  const result = formatText(line.text, { ...(await settingsFor(editor)), insertFinalNewline: true })
  if (!result.ok) return reportIssue(editor, result.issue, target)
  await openBeside(result.text, 'json')
}

async function openBeside(content: string, language: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({ content, language })
  await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: false })
}
