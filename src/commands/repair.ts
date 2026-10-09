import * as vscode from 'vscode'
import { mapLines } from '../core/jsonl'
import { repair } from '../core/repair'
import { activeEditor, isJsonLines, notify, replaceTarget, reportIssue, targetOf, withProgress } from '../editor'
import type { RepairFix, RepairResult } from '../types/json'
import { format } from './format'

const LABELS: Record<RepairFix, [string, string]> = {
  trailingComma: ['trailing comma', 'trailing commas'],
  missingComma: ['missing comma', 'missing commas'],
  extraComma: ['extra comma', 'extra commas'],
  comment: ['comment removed', 'comments removed'],
  singleQuotes: ['single-quoted string', 'single-quoted strings'],
  smartQuotes: ['smart-quoted string', 'smart-quoted strings'],
  unquotedKey: ['unquoted key', 'unquoted keys'],
  unquotedValue: ['unquoted value', 'unquoted values'],
  literal: ['non-JSON literal (True, None, NaN…)', 'non-JSON literals (True, None, NaN…)'],
  number: ['non-JSON number', 'non-JSON numbers'],
  escape: ['invalid escape', 'invalid escapes'],
  controlCharacter: ['raw control character', 'raw control characters'],
  missingColon: ['missing colon', 'missing colons'],
  missingValue: ['missing value (set to null)', 'missing values (set to null)'],
  bracket: ['missing or extra bracket', 'missing or extra brackets'],
  multipleValues: ['top-level value wrapped into an array', 'top-level values wrapped into an array'],
  stray: ['stray character or wrapper', 'stray characters or wrappers'],
}

/** Turn almost-JSON (JS literals, Python reprs, JSON5, chat-app quotes…) into valid JSON. */
export async function repairCommand(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const keepComments = editor.document.languageId === 'jsonc'
  const result = await withProgress(editor.document, 'Repairing', async () =>
    isJsonLines(editor.document) ? repairLines(target.text) : repair(target.text, { keepComments }),
  )
  if (!result.ok) return reportIssue(editor, result.issue, target, 'could not repair this automatically, nothing was changed')
  const summary = summarize(result.fixes)
  if (!summary || result.text === target.text) return notify('nothing to repair')

  await replaceTarget(editor, target, result.text)
  void vscode.window.showInformationMessage(`Jsonery: repaired ${summary}.`, 'Format').then((choice) => {
    if (choice === 'Format') return format()
  })
}

/** JSON Lines: repair each record on its own (comments can't survive on a one-line record). */
function repairLines(text: string): RepairResult {
  const fixes: RepairResult['fixes'] = {}
  const result = mapLines(text, (line) => {
    const repaired = repair(line, { keepComments: false })
    for (const [kind, n] of Object.entries(repaired.fixes) as [RepairFix, number][]) fixes[kind] = (fixes[kind] ?? 0) + n
    return repaired
  })
  return { ...result, fixes }
}

export function summarize(fixes: Partial<Record<RepairFix, number>>): string {
  const entries = (Object.entries(fixes) as [RepairFix, number][]).filter(([, n]) => n > 0)
  const total = entries.reduce((sum, [, n]) => sum + n, 0)
  if (total === 0) return ''
  const details = entries.map(([kind, n]) => `${n} ${LABELS[kind][n === 1 ? 0 : 1]}`).join(', ')
  return `${total} problem${total === 1 ? '' : 's'}: ${details}`
}
