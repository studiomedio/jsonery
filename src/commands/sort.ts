import { sortKeys } from '../core/sort'
import { activeEditor, notify, replaceTarget, reportIssue, settingsFor, targetOf } from '../editor'
import type { SortScope } from '../types/json'

/** Sort object keys in the selection, or the whole document. */
export async function sort(scope: SortScope): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const result = sortKeys(target.text, scope, settingsFor(editor))
  if (!result.ok) return reportIssue(editor, result.issue, target)
  if (result.text === target.text) return notify('keys already sorted')
  await replaceTarget(editor, target, result.text)
}
