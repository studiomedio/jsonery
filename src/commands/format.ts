import { formatEdits, formatText, indentFollowingLines, lineIndentAt, minify } from '../core/format'
import { activeEditor, applyEdits, isJsonDocument, notify, replaceTarget, reportIssue, settingsFor, targetOf, toTextEdits } from '../editor'

/** Format the selection, or the whole document. Works on JSON pasted into any kind of file. */
export async function format(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const { document } = editor
  const target = targetOf(editor)
  const settings = settingsFor(editor)

  if (!target.isSelection) {
    const result = formatEdits(target.text, settings)
    if (!result.ok) return reportIssue(editor, result.issue, target)
    if (result.edits.length === 0) return notify('already formatted')
    await applyEdits(editor, toTextEdits(document, result.edits))
    return
  }

  // Inside a valid JSON document, format the region in context so it lines up with its surroundings.
  if (isJsonDocument(document)) {
    const start = document.offsetAt(target.range.start)
    const ranged = formatEdits(document.getText(), settings, {
      range: { offset: start, length: document.offsetAt(target.range.end) - start },
    })
    if (ranged.ok) {
      if (ranged.edits.length === 0) return notify('already formatted')
      await applyEdits(editor, toTextEdits(document, ranged.edits))
      return
    }
  }

  // Otherwise treat the selection as a standalone value (e.g. a payload inside a log or a string).
  const result = formatText(target.text, { ...settings, insertFinalNewline: false })
  if (!result.ok) return reportIssue(editor, result.issue, target)
  const indent = lineIndentAt(document.getText(), document.offsetAt(target.range.start))
  const [, before, , after] = /^(\s*)([\s\S]*?)(\s*)$/.exec(target.text)!
  const formatted = before + indentFollowingLines(result.text, indent) + after
  if (formatted === target.text) return notify('already formatted')
  await replaceTarget(editor, target, formatted)
}

/** Strip whitespace and comments from the selection, or the whole document. */
export async function minifyCommand(): Promise<void> {
  const editor = activeEditor()
  if (!editor) return
  const target = targetOf(editor)
  const result = minify(target.text)
  if (!result.ok) return reportIssue(editor, result.issue, target)

  const settings = settingsFor(editor)
  const text = !target.isSelection && settings.insertFinalNewline ? result.text + settings.eol : result.text
  if (text === target.text) return notify('already minified')
  await replaceTarget(editor, target, text)
}
