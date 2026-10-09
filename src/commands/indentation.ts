import * as vscode from 'vscode'
import { formatEdits } from '../core/format'
import { activeEditor, applyEdits, notify, reportIssue, settingsFor, targetOf, toTextEdits } from '../editor'
import type { IndentationArg, IndentationChoice } from '../types/editor'
import type { Indentation } from '../types/json'

/** Re-indent the whole document (line breaks are kept) and switch the editor to the new indentation. */
export async function changeIndentation(arg?: IndentationArg): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const current = settingsFor(editor)
  const indentation = arg === undefined ? await pick(current) : fromArg(arg, current)
  if (!indentation) return

  const target = { ...targetOf(editor), isSelection: false }
  // A one-line (minified) document has no lines to keep — expand it instead.
  const keepLines = /\n/.test(target.text.trim())
  const result = formatEdits(target.text, { ...current, ...indentation }, { keepLines })
  if (!result.ok) return reportIssue(editor, result.issue, target)

  editor.options = {
    tabSize: indentation.tabSize,
    insertSpaces: indentation.insertSpaces,
    indentSize: indentation.insertSpaces ? indentation.tabSize : 'tabSize',
  }
  if (result.edits.length > 0) await applyEdits(editor, toTextEdits(editor.document, result.edits))
  notify(`indented with ${describe(indentation)}`)
}

export function describe({ tabSize, insertSpaces }: Indentation): string {
  return insertSpaces ? `${tabSize} space${tabSize === 1 ? '' : 's'}` : 'tabs'
}

async function pick(current: Indentation): Promise<Indentation | undefined> {
  const choices: IndentationChoice[] = [
    { label: '2 spaces', tabSize: 2, insertSpaces: true },
    { label: '4 spaces', tabSize: 4, insertSpaces: true },
    { label: 'Tabs', tabSize: current.tabSize, insertSpaces: false },
  ]
  for (const choice of choices) {
    if (choice.insertSpaces === current.insertSpaces && (!choice.insertSpaces || choice.tabSize === current.tabSize)) {
      choice.description = 'current'
    }
  }
  return vscode.window.showQuickPick(choices, { title: 'Jsonery: Change Indentation', placeHolder: 'Re-indent the document with…' })
}

function fromArg(arg: IndentationArg, current: Indentation): Indentation | undefined {
  if (typeof arg === 'number' && arg > 0) return { tabSize: arg, insertSpaces: true }
  if (arg === 'tab' || arg === 'tabs') return { tabSize: current.tabSize, insertSpaces: false }
  if (typeof arg === 'object' && arg !== null) {
    return { tabSize: arg.tabSize ?? current.tabSize, insertSpaces: arg.insertSpaces ?? current.insertSpaces }
  }
  vscode.window.showErrorMessage(`Jsonery: unsupported indentation argument ${JSON.stringify(arg)}.`)
  return undefined
}
