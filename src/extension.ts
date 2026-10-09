import * as vscode from 'vscode'
import { registerCommands } from './commands'
import { SINGLE_VALUE_SELECTOR } from './editor'
import { applyEditorConfig, editorConfig } from './editorconfig'
import { JsonFormatter } from './providers/formatter'
import { JsonPasteProvider } from './providers/paste'
import { StatusBar } from './statusBar'

export function activate(context: vscode.ExtensionContext): void {
  registerCommands(context)

  const formatter = new JsonFormatter()
  context.subscriptions.push(
    editorConfig.watch(),
    vscode.languages.registerDocumentFormattingEditProvider([...SINGLE_VALUE_SELECTOR, { language: 'jsonl' }], formatter),
    vscode.languages.registerDocumentRangeFormattingEditProvider(SINGLE_VALUE_SELECTOR, formatter),
    vscode.languages.registerDocumentPasteEditProvider(SINGLE_VALUE_SELECTOR, new JsonPasteProvider(), {
      providedPasteEditKinds: [JsonPasteProvider.kind],
      pasteMimeTypes: ['text/plain'],
    }),
    new StatusBar(),
    vscode.window.onDidChangeActiveTextEditor((editor) => applyEditorConfig(editor)),
  )
  void applyEditorConfig(vscode.window.activeTextEditor)
}

export function deactivate(): void {}
