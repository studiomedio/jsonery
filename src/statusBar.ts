import * as vscode from 'vscode'
import { currentPath } from './commands/path'
import { describe } from './commands/indentation'
import { indentationFrom } from './core/editorconfig'
import { JSON_LANGUAGES, config, editorIndentation, isJsonLines } from './editor'
import { editorConfig } from './editorconfig'

// Live path tracking re-scans the document up to the cursor; skip it on very large files.
const MAX_LIVE_LENGTH = 5_000_000
const MAX_PATH_DISPLAY = 60
const DEBOUNCE_MS = 120

/** JSON path of the cursor and the document's indentation, for JSON editors. */
export class StatusBar implements vscode.Disposable {
  private readonly path = vscode.window.createStatusBarItem('jsonery.path', vscode.StatusBarAlignment.Right, 101)
  private readonly indent = vscode.window.createStatusBarItem('jsonery.indentation', vscode.StatusBarAlignment.Right, 100)
  private readonly disposables: vscode.Disposable[] = []
  private timer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    this.path.name = 'Jsonery: JSON Path'
    this.path.command = 'jsonery.copyPath'
    this.indent.name = 'Jsonery: Indentation'
    this.indent.command = 'jsonery.changeIndentation'

    const isActive = (editor: vscode.TextEditor) => editor === vscode.window.activeTextEditor
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.update()),
      vscode.window.onDidChangeTextEditorSelection((e) => isActive(e.textEditor) && this.schedulePath()),
      vscode.window.onDidChangeTextEditorOptions((e) => isActive(e.textEditor) && this.updateIndentation()),
      vscode.workspace.onDidChangeTextDocument((e) => e.document === vscode.window.activeTextEditor?.document && this.schedulePath()),
      vscode.workspace.onDidOpenTextDocument(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('jsonery') && this.update()),
    )
    this.update()
  }

  update(): void {
    this.updatePath()
    void this.updateIndentation()
  }

  private schedulePath(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.updatePath(), DEBOUNCE_MS)
  }

  private jsonEditor(): vscode.TextEditor | undefined {
    const editor = vscode.window.activeTextEditor
    return editor && JSON_LANGUAGES.includes(editor.document.languageId) ? editor : undefined
  }

  private updatePath(): void {
    const editor = this.jsonEditor()
    if (!editor || !config(editor.document).get('statusBar.path', true)) return this.path.hide()
    const { document } = editor
    const length = document.offsetAt(document.lineAt(document.lineCount - 1).range.end)
    if (length > MAX_LIVE_LENGTH) {
      this.path.text = '$(list-tree) …'
      this.path.tooltip = 'File too large for a live path — click to copy the path at the cursor'
    } else {
      const path = currentPath(editor)
      this.path.text = `$(list-tree) ${truncate(path)}`
      this.path.tooltip = `${path}\nClick to copy`
    }
    this.path.show()
  }

  private async updateIndentation(): Promise<void> {
    const editor = this.jsonEditor()
    // JSON Lines records are single-line: no indentation to show.
    if (!editor || isJsonLines(editor.document) || !config(editor.document).get('statusBar.indentation', true)) {
      return this.indent.hide()
    }
    const props = await editorConfig.propsFor(editor.document)
    if (editor !== vscode.window.activeTextEditor) return
    const fromEditorConfig = props.indentStyle !== undefined || props.indentSize !== undefined
    this.indent.text = `$(symbol-namespace) ${describe(indentationFrom(props, editorIndentation(editor)))}`
    this.indent.tooltip = `Jsonery: change indentation and re-indent the document${fromEditorConfig ? '\n(set by .editorconfig)' : ''}`
    this.indent.show()
  }

  dispose(): void {
    clearTimeout(this.timer)
    this.path.dispose()
    this.indent.dispose()
    for (const d of this.disposables) d.dispose()
  }
}

/** Keep the root and the tail — the end of a path is the informative part. */
function truncate(path: string): string {
  if (path.length <= MAX_PATH_DISPLAY) return path
  return path.slice(0, 1) + '…' + path.slice(path.length - MAX_PATH_DISPLAY + 2)
}
