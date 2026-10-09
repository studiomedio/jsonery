import type { Node } from 'jsonc-parser'

/** How a document or block of JSON is indented. */
export interface Indentation {
  tabSize: number
  insertSpaces: boolean
}

/**
 * Layout of formatted JSON:
 * - `expanded` — every non-empty array and object over several lines (VS Code's own style)
 * - `smart` — arrays and objects that fit within `maxLineWidth` stay on one line
 * - `preserve` — keep existing line breaks, fix only indentation and spacing
 */
export type FormatStyle = 'expanded' | 'smart' | 'preserve'

/** Options shared by every text-producing operation. */
export interface FormatSettings extends Indentation {
  style: FormatStyle
  /** Line width the `smart` style fits containers into. */
  maxLineWidth: number
  /** Line ending used for generated line breaks. */
  eol: '\n' | '\r\n'
  /** Ensure the output ends with a line break (whole-document operations only). */
  insertFinalNewline: boolean
}

/** A syntax error, reported with 1-based line/column for humans. */
export interface JsonIssue {
  message: string
  offset: number
  line: number
  column: number
}

/** Outcome of an operation that may refuse to touch invalid input. */
export type JsonResult = { ok: true; text: string } | { ok: false; issue: JsonIssue }

/** One step of a JSON path — a property name or an array index. */
export type PathSegment = string | number

/** Display style for JSON paths in the status bar and "Copy JSON Path". */
export type PathStyle = 'jsonpath' | 'jq' | 'js'

/** Which objects "Sort Keys" reorders. */
export type SortScope = 'recursive' | 'topLevel'

/** A collapsible container, as character offsets into the source text. */
export interface FoldTarget {
  kind: 'object' | 'array'
  /** Nesting depth; the root value is depth 0. */
  depth: number
  start: number
  end: number
}

/** A text replacement expressed in character offsets (same shape as jsonc-parser's `Edit`). */
export interface OffsetEdit {
  offset: number
  length: number
  content: string
}

/** Outcome of an operation that produces edits against the original text. */
export type EditsResult = { ok: true; edits: OffsetEdit[] } | { ok: false; issue: JsonIssue }

/** Outcome of unescaping a JSON string literal. */
export type UnescapeResult =
  | { ok: true; text: string; /** The unescaped content is itself valid JSON (and was formatted). */ isJson: boolean }
  | { ok: false; message: string }

/** Restricts formatting to part of the text, or to indentation only. */
export interface FormatScope {
  /** Format only this region (the rest of the text supplies the indentation context). */
  range?: { offset: number; length: number }
  /** Keep existing line breaks and only fix indentation and spacing. */
  keepLines?: boolean
}

/** A half-open range of character offsets. */
export interface Span {
  start: number
  end: number
}

/** Comments found between two tokens of an object, classified for sorting. */
export interface GapComments {
  /** Comments that belong to the property (or brace) before the gap. */
  trailing?: Span
  /** Comments that belong to the property after the gap — up to that property's start. */
  leading?: Span
  hasComma: boolean
}

/** A syntax tree for valid input, or the first syntax error. */
export type ParseResult = { tree: Node; issue?: undefined } | { tree?: undefined; issue: JsonIssue }

/** Kinds of problems "Repair JSON" fixes, used to summarise what changed. */
export type RepairFix =
  | 'trailingComma'
  | 'missingComma'
  | 'extraComma'
  | 'comment'
  | 'singleQuotes'
  | 'smartQuotes'
  | 'unquotedKey'
  | 'unquotedValue'
  | 'literal'
  | 'number'
  | 'escape'
  | 'controlCharacter'
  | 'missingColon'
  | 'missingValue'
  | 'bracket'
  | 'multipleValues'
  | 'stray'

export interface RepairOptions {
  /** Keep comments (JSONC) instead of removing them. */
  keepComments: boolean
}

/** Repaired text plus how many of each fix were applied. */
export type RepairResult =
  | { ok: true; text: string; fixes: Partial<Record<RepairFix, number>> }
  | { ok: false; issue: JsonIssue; fixes: Partial<Record<RepairFix, number>> }

/** A token of the tolerant lexer used by "Repair JSON". */
export interface RepairToken {
  kind: 'punct' | 'string' | 'number' | 'word' | 'comment' | 'space' | 'other'
  /** Text as written in the source. */
  raw: string
  /** Text to emit (after normalisation). */
  text: string
  offset: number
}

/** An open object or array while "Repair JSON" walks the tokens. */
export interface RepairFrame {
  kind: 'object' | 'array'
  /** What the next significant token should be. */
  state: 'key' | 'colon' | 'value' | 'comma'
  /** The last token emitted in this container was a comma (at `commaPiece`). */
  afterComma: boolean
  commaPiece: number
}

/** The .editorconfig properties Jsonery honours (already lower-cased and typed). */
export interface EditorConfigProps {
  indentStyle?: 'tab' | 'space'
  indentSize?: number | 'tab'
  tabWidth?: number
  insertFinalNewline?: boolean
  maxLineLength?: number
}

/** One parsed .editorconfig file. */
export interface EditorConfigFile {
  root: boolean
  sections: { glob: string; props: Record<string, string> }[]
}
