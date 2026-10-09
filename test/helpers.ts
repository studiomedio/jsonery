import type { FormatSettings } from '../src/types/json'

export const TWO: FormatSettings = { tabSize: 2, insertSpaces: true, eol: '\n', insertFinalNewline: false }
export const FOUR: FormatSettings = { ...TWO, tabSize: 4 }
export const TABS: FormatSettings = { ...TWO, insertSpaces: false }

/** Strip a common leading indent so fixtures can be written inline. */
export function dedent(text: string): string {
  const lines = text.replace(/^\n/, '').replace(/\n[ \t]*$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^ */.exec(l)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}
