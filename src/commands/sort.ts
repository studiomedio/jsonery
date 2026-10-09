import { mapLines } from '../core/jsonl'
import { sortKeys } from '../core/sort'
import { activeEditor, isJsonLines, notify, replaceTarget, reportIssue, settingsFor, targetOf, withProgress } from '../editor'
import type { SortScope } from '../types/json'

/** Sort object keys in the selection, or the whole document (JSON Lines: each record). */
export async function sort(scope: SortScope): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const settings = await settingsFor(editor)
  await withProgress(editor.document, 'Sorting keys', async () => {
    const result = isJsonLines(editor.document)
      ? mapLines(target.text, (line) => sortKeys(line, scope, settings))
      : sortKeys(target.text, scope, settings)
    if (!result.ok) return reportIssue(editor, result.issue, target)
    if (result.text === target.text) return notify('keys already sorted')
    await replaceTarget(editor, target, result.text)
  })
}
