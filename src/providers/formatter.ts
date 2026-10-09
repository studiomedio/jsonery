import * as vscode from 'vscode'
import { minimalEdit } from '../core/edits'
import { formatEdits, minify } from '../core/format'
import { mapLines } from '../core/jsonl'
import { documentSettings, isJsonLines, toTextEdits } from '../editor'

/**
 * Lets Jsonery be the default JSON formatter (Format Document, format on save, `editor.formatOnPaste`).
 * Invalid JSON is left untouched rather than half-formatted.
 */
export class JsonFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  async provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): Promise<vscode.TextEdit[]> {
    const text = document.getText()
    if (isJsonLines(document)) {
      const result = mapLines(text, minify)
      return result.ok ? toTextEdits(document, minimalEdit(text, result.text)) : []
    }
    const result = formatEdits(text, await documentSettings(document, options))
    return result.ok ? toTextEdits(document, result.edits) : []
  }

  async provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions,
  ): Promise<vscode.TextEdit[]> {
    const offset = document.offsetAt(range.start)
    const result = formatEdits(document.getText(), await documentSettings(document, options), {
      range: { offset, length: document.offsetAt(range.end) - offset },
    })
    return result.ok ? toTextEdits(document, result.edits) : []
  }
}
