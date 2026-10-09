import * as vscode from 'vscode'
import { foldTargets } from '../core/fold'
import { activeEditor } from '../editor'
import type { FoldTarget } from '../types/json'

const MAX_LEVEL = 7

/** Collapse everything nested `level` deep — level 1 leaves only the top-level keys visible. */
export async function foldToLevel(arg?: number): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const level = typeof arg === 'number' ? arg : await pickLevel()
  if (!level) return
  await vscode.commands.executeCommand('editor.unfoldAll')
  await fold(editor, (t) => t.depth === level)
}

export async function foldAll(kind: FoldTarget['kind']): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  // Never fold the root — that would hide the whole document.
  await fold(editor, (t) => t.kind === kind && t.depth > 0)
}

export async function unfoldAll(): Promise<void> {
  await vscode.commands.executeCommand('editor.unfoldAll')
}

async function fold(editor: vscode.TextEditor, include: (target: FoldTarget) => boolean): Promise<void> {
  const { document } = editor
  const lines = new Set<number>()
  for (const target of foldTargets(document.getText())) {
    if (!include(target)) continue
    const start = document.positionAt(target.start).line
    // Single-line containers have no folding region; folding their line would collapse the parent.
    if (document.positionAt(target.end - 1).line > start) lines.add(start)
  }
  if (lines.size === 0) return
  await vscode.commands.executeCommand('editor.fold', { levels: 1, direction: 'down', selectionLines: [...lines] })
}

async function pickLevel(): Promise<number | undefined> {
  const items = Array.from({ length: MAX_LEVEL }, (_, i) => ({
    label: `Level ${i + 1}`,
    description: i === 0 ? 'top-level keys only' : `${i + 1} levels of keys visible`,
    level: i + 1,
  }))
  const choice = await vscode.window.showQuickPick(items, { title: 'Jsonery: Fold to Level' })
  return choice?.level
}
