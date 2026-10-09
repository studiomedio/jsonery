import * as vscode from 'vscode'
import { formatText, isContainer } from '../core/format'
import { config, documentSettings, settingsFor } from '../editor'

const MAX_PASTE_LENGTH = 5_000_000

/**
 * Pasting a JSON object or array inserts it formatted (VS Code indents it to fit where it lands).
 * Automatic when `jsonery.formatOnPaste` is on; always offered under "Paste As…". The paste widget
 * can switch back to plain text.
 */
export class JsonPasteProvider implements vscode.DocumentPasteEditProvider {
  static readonly kind = vscode.DocumentDropOrPasteEditKind.Text.append('jsonery', 'formatted')

  async provideDocumentPasteEdits(
    document: vscode.TextDocument,
    ranges: readonly vscode.Range[],
    dataTransfer: vscode.DataTransfer,
    context: vscode.DocumentPasteEditContext,
    token: vscode.CancellationToken,
  ): Promise<vscode.DocumentPasteEdit[] | undefined> {
    const explicit = context.triggerKind === vscode.DocumentPasteTriggerKind.PasteAs
    if (!explicit && !config(document).get('formatOnPaste', false)) return undefined
    if (ranges.length !== 1) return undefined

    const pasted = await dataTransfer.get('text/plain')?.asString()
    if (!pasted || token.isCancellationRequested || pasted.length > MAX_PASTE_LENGTH) return undefined
    if (!isContainer(pasted)) return undefined

    const editor = vscode.window.visibleTextEditors.find((e) => e.document === document)
    const settings = editor ? settingsFor(editor) : documentSettings(document, { tabSize: 2, insertSpaces: true })
    const formatted = formatText(pasted.trim(), { ...settings, insertFinalNewline: false })
    if (!formatted.ok) return undefined

    if (formatted.text === pasted) return undefined

    // VS Code re-indents the inserted lines to the cursor's line itself — insert at column-zero indentation.
    return [new vscode.DocumentPasteEdit(formatted.text, 'Insert formatted JSON', JsonPasteProvider.kind)]
  }
}
