import * as vscode from 'vscode'
import type { Target } from './types/editor'
import type { FormatSettings, Indentation, JsonIssue, OffsetEdit } from './types/json'

export const JSON_LANGUAGES = ['json', 'jsonc', 'jsonl']

/** Documents holding a single JSON value (JSON Lines holds one per line). */
export const SINGLE_VALUE_SELECTOR: vscode.DocumentSelector = [{ language: 'json' }, { language: 'jsonc' }]

export function isJsonDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'json' || document.languageId === 'jsonc'
}

export function config(scope?: vscode.TextDocument): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('jsonery', scope)
}

export function activeEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor
  if (!editor) vscode.window.showInformationMessage('Jsonery: open a JSON file first.')
  return editor
}

/** Indentation the editor currently uses (VS Code auto-detects it from the content). */
export function settingsFor(editor: vscode.TextEditor): FormatSettings {
  const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 2
  const insertSpaces = typeof editor.options.insertSpaces === 'boolean' ? editor.options.insertSpaces : true
  return documentSettings(editor.document, { tabSize, insertSpaces })
}

export function documentSettings(
  document: vscode.TextDocument,
  indentation: Indentation,
): FormatSettings {
  const lastLine = document.lineAt(document.lineCount - 1)
  const endsWithNewline = document.lineCount > 1 && lastLine.text === ''
  return {
    ...indentation,
    eol: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
    // Never strip a final newline that is already there.
    insertFinalNewline: endsWithNewline || vscode.workspace.getConfiguration('files', document).get('insertFinalNewline', false),
  }
}

export function targetOf(editor: vscode.TextEditor): Target {
  const { document, selection } = editor
  if (!selection.isEmpty) return { range: selection, text: document.getText(selection), isSelection: true }
  const range = new vscode.Range(document.positionAt(0), document.lineAt(document.lineCount - 1).range.end)
  return { range, text: document.getText(), isSelection: false }
}

export function toTextEdits(document: vscode.TextDocument, edits: OffsetEdit[], base = 0): vscode.TextEdit[] {
  return edits.map(
    (e) =>
      new vscode.TextEdit(
        new vscode.Range(document.positionAt(base + e.offset), document.positionAt(base + e.offset + e.length)),
        e.content,
      ),
  )
}

export async function applyEdits(editor: vscode.TextEditor, edits: vscode.TextEdit[]): Promise<boolean> {
  return editor.edit((builder) => {
    for (const edit of edits) builder.replace(edit.range, edit.newText)
  })
}

/**
 * Replace the target's text. A replaced selection stays selected; for whole-document edits the
 * cursor is kept where it was instead of jumping to the end.
 */
export async function replaceTarget(editor: vscode.TextEditor, target: Target, text: string): Promise<boolean> {
  const { anchor, active } = editor.selection
  const applied = await editor.edit((builder) => builder.replace(target.range, text))
  if (applied && !target.isSelection) {
    const { document } = editor
    editor.selection = new vscode.Selection(document.validatePosition(anchor), document.validatePosition(active))
  }
  return applied
}

/** Replace an arbitrary range (e.g. a single JSON node). */
export async function replaceRange(editor: vscode.TextEditor, range: vscode.Range, text: string): Promise<boolean> {
  return editor.edit((builder) => builder.replace(range, text))
}

export function notify(message: string): void {
  vscode.window.setStatusBarMessage(`Jsonery: ${message}`, 3000)
}

/** Explain why an operation was refused, with a jump to the offending position. */
export async function reportIssue(editor: vscode.TextEditor, issue: JsonIssue, target: Target): Promise<void> {
  const where = target.isSelection ? 'Selection' : 'Document'
  const choice = await vscode.window.showErrorMessage(
    `Jsonery: ${where} is not valid JSON — ${issue.message} at line ${issue.line}, column ${issue.column}.`,
    'Go to Error',
  )
  if (choice !== 'Go to Error') return
  const position = editor.document.positionAt(editor.document.offsetAt(target.range.start) + issue.offset)
  editor.selection = new vscode.Selection(position, position)
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  await vscode.window.showTextDocument(editor.document, editor.viewColumn)
}
