import * as vscode from 'vscode'
import { indentationFrom } from './core/editorconfig'
import { applyOffsetEdits, minimalEdit } from './core/edits'
import { editorConfig } from './editorconfig'
import type { Target } from './types/editor'
import type { EditorConfigProps, FormatSettings, FormatStyle, Indentation, JsonIssue, OffsetEdit } from './types/json'

/** Above this many edits, apply one merged replacement — the editor is slow with millions of edits. */
const MAX_SEPARATE_EDITS = 2000
/** Documents above this size get a progress notification while Jsonery works. */
const PROGRESS_THRESHOLD = 2_000_000

export const JSON_LANGUAGES = ['json', 'jsonc', 'jsonl']

/** Documents holding a single JSON value (JSON Lines holds one per line). */
export const SINGLE_VALUE_SELECTOR: vscode.DocumentFilter[] = [{ language: 'json' }, { language: 'jsonc' }]

export function isJsonDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'json' || document.languageId === 'jsonc'
}

export function config(scope?: vscode.TextDocument): vscode.WorkspaceConfiguration {
  return vscode.workspace.getConfiguration('jsonery', scope)
}

export function isJsonLines(document: vscode.TextDocument): boolean {
  return document.languageId === 'jsonl'
}

export function activeEditor(): vscode.TextEditor | undefined {
  const editor = vscode.window.activeTextEditor
  if (editor) return editor
  // VS Code does not hand files over 50 MB to extensions at all.
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab
  if (tab?.input instanceof vscode.TabInputText) {
    vscode.window.showWarningMessage('Jsonery: this file is too large for VS Code to share with extensions (over 50 MB).')
  } else {
    vscode.window.showInformationMessage('Jsonery: open a JSON file first.')
  }
  return undefined
}

/** The editor's indentation (VS Code detects it from the content), unless .editorconfig says otherwise. */
export async function settingsFor(editor: vscode.TextEditor): Promise<FormatSettings> {
  return documentSettings(editor.document, editorIndentation(editor))
}

export function editorIndentation(editor: vscode.TextEditor): Indentation {
  const tabSize = typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 2
  const insertSpaces = typeof editor.options.insertSpaces === 'boolean' ? editor.options.insertSpaces : true
  return { tabSize, insertSpaces }
}

/** Format settings for a document: .editorconfig first, then Jsonery / VS Code settings. */
export async function documentSettings(document: vscode.TextDocument, indentation: Indentation): Promise<FormatSettings> {
  return settingsWith(document, indentation, await editorConfig.propsFor(document))
}

function settingsWith(document: vscode.TextDocument, indentation: Indentation, props: EditorConfigProps): FormatSettings {
  const lastLine = document.lineAt(document.lineCount - 1)
  const endsWithNewline = document.lineCount > 1 && lastLine.text === ''
  const jsonery = config(document)
  return {
    ...indentationFrom(props, indentation),
    style: jsonery.get<FormatStyle>('format.style', 'expanded'),
    maxLineWidth: props.maxLineLength ?? jsonery.get<number>('format.maxLineWidth', 80),
    eol: document.eol === vscode.EndOfLine.CRLF ? '\r\n' : '\n',
    // Never strip a final newline that is already there.
    insertFinalNewline:
      endsWithNewline ||
      (props.insertFinalNewline ?? vscode.workspace.getConfiguration('files', document).get('insertFinalNewline', false)),
  }
}

/** Run `task` with a progress notification when the document is large enough to take a while. */
export async function withProgress<T>(document: vscode.TextDocument, title: string, task: () => Promise<T>): Promise<T> {
  if (document.offsetAt(document.lineAt(document.lineCount - 1).range.end) < PROGRESS_THRESHOLD) return task()
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: `Jsonery: ${title}…` }, async () => {
    // Let the notification render before the (synchronous) work blocks the extension host.
    await new Promise((resolve) => setTimeout(resolve, 50))
    return task()
  })
}

export function targetOf(editor: vscode.TextEditor): Target {
  const { document, selection } = editor
  if (!selection.isEmpty) return { range: selection, text: document.getText(selection), isSelection: true }
  const range = new vscode.Range(document.positionAt(0), document.lineAt(document.lineCount - 1).range.end)
  return { range, text: document.getText(), isSelection: false }
}

/** Offset edits against the whole document → TextEdits (merged into one when there are very many). */
export function toTextEdits(document: vscode.TextDocument, edits: OffsetEdit[], base = 0): vscode.TextEdit[] {
  if (edits.length > MAX_SEPARATE_EDITS && base === 0) {
    const text = document.getText()
    edits = minimalEdit(text, applyOffsetEdits(text, edits))
  }
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

/**
 * Explain why an operation was refused, with a jump to the offending position — and, unless this
 * *is* the repair, an offer to repair it. Doesn't wait for the user, so the command finishes (and
 * any progress notification closes) right away.
 */
export function reportIssue(editor: vscode.TextEditor, issue: JsonIssue, target: Target, headline?: string): void {
  const actions = headline ? ['Go to Error'] : ['Go to Error', 'Repair JSON']
  const message = `Jsonery: ${headline ?? `${target.isSelection ? 'Selection' : 'Document'} is not valid JSON`} — ${issue.message} at line ${issue.line}, column ${issue.column}.`
  void vscode.window.showErrorMessage(message, ...actions).then((choice) => onIssueAction(editor, issue, target, choice))
}

async function onIssueAction(editor: vscode.TextEditor, issue: JsonIssue, target: Target, choice: string | undefined): Promise<void> {
  if (choice === 'Repair JSON') {
    await vscode.window.showTextDocument(editor.document, editor.viewColumn)
    await vscode.commands.executeCommand('jsonery.repair')
    return
  }
  if (choice !== 'Go to Error') return
  const position = editor.document.positionAt(editor.document.offsetAt(target.range.start) + issue.offset)
  editor.selection = new vscode.Selection(position, position)
  editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenterIfOutsideViewport)
  await vscode.window.showTextDocument(editor.document, editor.viewColumn)
}
