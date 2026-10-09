import type { Range } from 'vscode'

/** What a command acts on: the primary selection, or the whole document when nothing is selected. */
export interface Target {
  range: Range
  text: string
  isSelection: boolean
}

/** Argument accepted by `jsonery.changeIndentation` (handy for keybindings): 2, 4, "tab" or an object. */
export type IndentationArg = number | 'tab' | 'tabs' | { tabSize?: number; insertSpaces?: boolean }

/** A pickable indentation preset. */
export interface IndentationChoice {
  label: string
  description?: string
  tabSize: number
  insertSpaces: boolean
}
