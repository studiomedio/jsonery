import * as vscode from 'vscode'
import { formatPath, pathAt, pathAtJsonLines } from '../core/path'
import { activeEditor, config } from '../editor'
import type { PathStyle } from '../types/json'

/** JSON path of the value under the cursor, in the configured style. */
export function currentPath(editor: vscode.TextEditor): string {
  const { document } = editor
  const offset = document.offsetAt(editor.selection.active)
  const path = document.languageId === 'jsonl'
    ? pathAtJsonLines(document.getText(), offset)
    : pathAt(document.getText(), offset)
  return formatPath(path, config(document).get<PathStyle>('path.style', 'jsonpath'))
}

export async function copyPath(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const path = currentPath(editor)
  await vscode.env.clipboard.writeText(path)
  vscode.window.setStatusBarMessage(`Jsonery: copied ${path}`, 3000)
}
