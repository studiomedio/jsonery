import * as vscode from 'vscode'
import { indentationFrom, parseEditorConfig, resolveEditorConfig } from './core/editorconfig'
import type { EditorConfigFile, EditorConfigProps } from './types/json'

const MAX_DEPTH = 32

/**
 * Finds and caches the .editorconfig files that apply to a document. Uses `workspace.fs`, so it
 * works for local, remote and virtual (vscode.dev) workspaces alike.
 */
class EditorConfigService implements vscode.Disposable {
  private readonly cache = new Map<string, Promise<EditorConfigFile | undefined>>()
  private watcher: vscode.FileSystemWatcher | undefined

  /** Start watching for changes; call once on activation. */
  watch(): vscode.Disposable {
    this.watcher = vscode.workspace.createFileSystemWatcher('**/.editorconfig')
    const clear = () => this.cache.clear()
    this.watcher.onDidChange(clear)
    this.watcher.onDidCreate(clear)
    this.watcher.onDidDelete(clear)
    return this
  }

  async propsFor(document: vscode.TextDocument): Promise<EditorConfigProps> {
    if (document.isUntitled || !vscode.workspace.getConfiguration('jsonery', document).get('editorconfig', true)) return {}
    const files: { file: EditorConfigFile; relativePath: string }[] = []
    const filePath = document.uri.path
    let dir = parentPath(filePath)
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const file = await this.read(document.uri.with({ path: dir === '/' ? '/.editorconfig' : `${dir}/.editorconfig` }))
      if (file) {
        files.unshift({ file, relativePath: filePath.slice(dir === '/' ? 1 : dir.length + 1) })
        if (file.root) break
      }
      const parent = parentPath(dir)
      if (parent === dir) break
      dir = parent
    }
    return resolveEditorConfig(files)
  }

  private read(uri: vscode.Uri): Promise<EditorConfigFile | undefined> {
    const key = uri.toString()
    let pending = this.cache.get(key)
    if (!pending) {
      pending = Promise.resolve(vscode.workspace.fs.readFile(uri)).then(
        (bytes) => parseEditorConfig(new TextDecoder().decode(bytes)),
        () => undefined,
      )
      this.cache.set(key, pending)
    }
    return pending
  }

  dispose(): void {
    this.watcher?.dispose()
    this.cache.clear()
  }
}

function parentPath(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash <= 0 ? '/' : path.slice(0, slash)
}

export const editorConfig = new EditorConfigService()

const applied = new WeakSet<vscode.TextDocument>()

/**
 * Give a JSON editor the indentation .editorconfig asks for, so typing matches what Jsonery
 * formats to (the same thing the EditorConfig extension does — harmless if both run). Applied once per
 * document, so a later "Change Indentation" isn't undone when switching back to the tab.
 */
export async function applyEditorConfig(editor: vscode.TextEditor | undefined): Promise<void> {
  if (!editor || !['json', 'jsonc'].includes(editor.document.languageId) || applied.has(editor.document)) return
  applied.add(editor.document)
  const props = await editorConfig.propsFor(editor.document)
  if (props.indentStyle === undefined && props.indentSize === undefined && props.tabWidth === undefined) return
  const current = {
    tabSize: typeof editor.options.tabSize === 'number' ? editor.options.tabSize : 4,
    insertSpaces: editor.options.insertSpaces !== false,
  }
  const wanted = indentationFrom(props, current)
  if (wanted.tabSize === current.tabSize && wanted.insertSpaces === current.insertSpaces) return
  editor.options = {
    tabSize: wanted.tabSize,
    insertSpaces: wanted.insertSpaces,
    indentSize: wanted.insertSpaces ? wanted.tabSize : 'tabSize',
  }
}
