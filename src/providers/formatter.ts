import * as vscode from 'vscode'
import { formatEdits } from '../core/format'
import { documentSettings, toTextEdits } from '../editor'

/**
 * Lets Jsonery be the default JSON formatter (Format Document, format on save, `editor.formatOnPaste`).
 * Invalid JSON is left untouched rather than half-formatted.
 */
export class JsonFormatter implements vscode.DocumentFormattingEditProvider, vscode.DocumentRangeFormattingEditProvider {
  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const result = formatEdits(document.getText(), documentSettings(document, options))
    return result.ok ? toTextEdits(document, result.edits) : []
  }

  provideDocumentRangeFormattingEdits(
    document: vscode.TextDocument,
    range: vscode.Range,
    options: vscode.FormattingOptions,
  ): vscode.TextEdit[] {
    const offset = document.offsetAt(range.start)
    const result = formatEdits(document.getText(), documentSettings(document, options), {
      range: { offset, length: document.offsetAt(range.end) - offset },
    })
    return result.ok ? toTextEdits(document, result.edits) : []
  }
}
