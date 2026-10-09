import type { EditorConfigFile, EditorConfigProps, Indentation } from '../types/json'

// Minimal EditorConfig (https://spec.editorconfig.org) support: INI parsing, glob matching and the
// properties that matter for JSON formatting. File discovery lives in src/editorconfig.ts.

export function parseEditorConfig(content: string): EditorConfigFile {
  const file: EditorConfigFile = { root: false, sections: [] }
  let current: EditorConfigFile['sections'][number] | undefined
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith(';')) continue
    const section = /^\[(.*)\]$/.exec(line)
    if (section) {
      current = { glob: section[1], props: {} }
      file.sections.push(current)
      continue
    }
    const pair = /^([^=:]+?)\s*[=:]\s*(.*)$/.exec(line)
    if (!pair) continue
    const key = pair[1].toLowerCase()
    const value = pair[2].trim().toLowerCase()
    if (current) current.props[key] = value
    else if (key === 'root') file.root = value === 'true'
  }
  return file
}

/**
 * Properties for `relativePath` (POSIX, relative to the directory of each file). `files` are ordered
 * from the outermost directory to the file's own directory, so closer files win.
 */
export function resolveEditorConfig(files: { file: EditorConfigFile; relativePath: string }[]): EditorConfigProps {
  const merged: Record<string, string> = {}
  for (const { file, relativePath } of files) {
    for (const section of file.sections) {
      if (matchesGlob(section.glob, relativePath)) Object.assign(merged, section.props)
    }
  }
  const props: EditorConfigProps = {}
  if (merged.indent_style === 'tab' || merged.indent_style === 'space') props.indentStyle = merged.indent_style
  const size = positiveInt(merged.indent_size)
  if (size) props.indentSize = size
  else if (merged.indent_size === 'tab') props.indentSize = 'tab'
  const width = positiveInt(merged.tab_width)
  if (width) props.tabWidth = width
  if (merged.insert_final_newline === 'true' || merged.insert_final_newline === 'false') {
    props.insertFinalNewline = merged.insert_final_newline === 'true'
  }
  const max = positiveInt(merged.max_line_length)
  if (max) props.maxLineLength = max
  return props
}

/** Indentation implied by .editorconfig, falling back to `fallback` for anything unspecified. */
export function indentationFrom(props: EditorConfigProps, fallback: Indentation): Indentation {
  const insertSpaces = props.indentStyle ? props.indentStyle === 'space' : fallback.insertSpaces
  const size = props.indentSize === 'tab' ? props.tabWidth : props.indentSize
  const tabSize = insertSpaces ? (size ?? props.tabWidth ?? fallback.tabSize) : (props.tabWidth ?? size ?? fallback.tabSize)
  return { tabSize, insertSpaces }
}

/** EditorConfig glob semantics: `*`, `**`, `?`, `[set]`, `[!set]`, `{a,b}`, `{1..10}`. */
export function matchesGlob(glob: string, relativePath: string): boolean {
  // A glob without a slash matches the file name in any directory.
  const pattern = glob.includes('/') ? glob.replace(/^\//, '') : `**/${glob}`
  return globToRegExp(pattern).test(relativePath)
}

function globToRegExp(glob: string): RegExp {
  let re = ''
  let braceDepth = 0
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (c === '\\' && i + 1 < glob.length) {
      re += escapeRegExp(glob[++i])
    } else if (c === '*') {
      if (glob[i + 1] === '*') {
        i++
        // `**/` also matches zero directories.
        if (glob[i + 1] === '/') {
          i++
          re += '(?:.*/)?'
        } else {
          re += '.*'
        }
      } else {
        re += '[^/]*'
      }
    } else if (c === '?') {
      re += '[^/]'
    } else if (c === '[') {
      const end = glob.indexOf(']', i + 1)
      if (end === -1) {
        re += '\\['
      } else {
        const body = glob.slice(i + 1, end)
        re += body.startsWith('!') ? `[^/${escapeClass(body.slice(1))}]` : `[${escapeClass(body)}]`
        i = end
      }
    } else if (c === '{') {
      const end = matchingBrace(glob, i)
      const range = end === -1 ? null : /^(-?\d+)\.\.(-?\d+)$/.exec(glob.slice(i + 1, end))
      if (range) {
        const [low, high] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b)
        re += `(?:${Array.from({ length: Math.min(high - low + 1, 1000) }, (_, k) => low + k).join('|')})`
        i = end
      } else if (end === -1 || !glob.slice(i + 1, end).includes(',')) {
        re += '\\{'
      } else {
        re += '(?:'
        braceDepth++
      }
    } else if (c === ',' && braceDepth > 0) {
      re += '|'
    } else if (c === '}' && braceDepth > 0) {
      re += ')'
      braceDepth--
    } else {
      re += escapeRegExp(c)
    }
  }
  return new RegExp(`^${re}$`)
}

function matchingBrace(glob: string, open: number): number {
  let depth = 0
  for (let i = open; i < glob.length; i++) {
    if (glob[i] === '\\') i++
    else if (glob[i] === '{') depth++
    else if (glob[i] === '}' && --depth === 0) return i
  }
  return -1
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
}

function escapeClass(body: string): string {
  return body.replace(/[\\\]^]/g, '\\$&')
}

function positiveInt(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return n > 0 ? n : undefined
}
