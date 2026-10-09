import * as vscode from 'vscode'
import { escape, unescape } from './escape'
import { foldAll, foldToLevel, unfoldAll } from './fold'
import { format, minifyCommand } from './format'
import { changeIndentation } from './indentation'
import { arrayToLinesCommand, linesToArrayCommand, openLineAsJson } from './jsonl'
import { copyPath } from './path'
import { repairCommand } from './repair'
import { sort } from './sort'

export function registerCommands(context: vscode.ExtensionContext): void {
  const commands: Record<string, (...args: any[]) => unknown> = {
    'jsonery.format': format,
    'jsonery.minify': minifyCommand,
    'jsonery.repair': repairCommand,
    'jsonery.changeIndentation': changeIndentation,
    'jsonery.sortKeys': () => sort('recursive'),
    'jsonery.sortKeysTopLevel': () => sort('topLevel'),
    'jsonery.foldToLevel': foldToLevel,
    'jsonery.foldArrays': () => foldAll('array'),
    'jsonery.foldObjects': () => foldAll('object'),
    'jsonery.unfoldAll': unfoldAll,
    'jsonery.copyPath': copyPath,
    'jsonery.escape': escape,
    'jsonery.unescape': unescape,
    'jsonery.linesToArray': linesToArrayCommand,
    'jsonery.arrayToLines': arrayToLinesCommand,
    'jsonery.openLineAsJson': openLineAsJson,
  }
  for (const [id, handler] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, handler))
  }
}
