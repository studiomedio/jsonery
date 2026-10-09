import * as vscode from 'vscode'
import { currentPath } from './commands/path'
import { describe } from './commands/indentation'
import { JSON_LANGUAGES, config, settingsFor } from './editor'

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
    this.indent.tooltip = 'Jsonery: change indentation and re-indent the document'

    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => this.update()),
      vscode.window.onDidChangeTextEditorSelection((e) => e.textEditor === vscode.window.activeTextEditor && this.schedule()),
      vscode.window.onDidChangeTextEditorOptions((e) => e.textEditor === vscode.window.activeTextEditor && this.update()),
      vscode.workspace.onDidChangeTextDocument((e) => e.document === vscode.window.activeTextEditor?.document && this.schedule()),
      vscode.workspace.onDidOpenTextDocument(() => this.update()),
      vscode.workspace.onDidChangeConfiguration((e) => e.affectsConfiguration('jsonery') && this.update()),
    )
    this.update()
  }

  private schedule(): void {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.update(), DEBOUNCE_MS)
  }

  update(): void {
    const editor = vscode.window.activeTextEditor
    if (!editor || !JSON_LANGUAGES.includes(editor.document.languageId)) {
      this.path.hide()
      this.indent.hide()
      return
    }
    const settings = config(editor.document)

    if (settings.get('statusBar.indentation', true)) {
      this.indent.text = `$(symbol-namespace) ${describe(settingsFor(editor))}`
      this.indent.show()
    } else {
      this.indent.hide()
    }

    if (settings.get('statusBar.path', true)) {
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
    } else {
      this.path.hide()
    }
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
