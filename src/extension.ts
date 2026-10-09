import * as vscode from 'vscode'
import { registerCommands } from './commands'
import { SINGLE_VALUE_SELECTOR } from './editor'
import { JsonFormatter } from './providers/formatter'
import { JsonPasteProvider } from './providers/paste'
import { StatusBar } from './statusBar'

export function activate(context: vscode.ExtensionContext): void {
  registerCommands(context)

  const formatter = new JsonFormatter()
  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(SINGLE_VALUE_SELECTOR, formatter),
    vscode.languages.registerDocumentRangeFormattingEditProvider(SINGLE_VALUE_SELECTOR, formatter),
    vscode.languages.registerDocumentPasteEditProvider(SINGLE_VALUE_SELECTOR, new JsonPasteProvider(), {
      providedPasteEditKinds: [JsonPasteProvider.kind],
      pasteMimeTypes: ['text/plain'],
    }),
    new StatusBar(),
  )
}

export function deactivate(): void {}
