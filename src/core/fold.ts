import type { Node } from 'jsonc-parser'
import type { FoldTarget } from '../types/json'
import { parseLenient } from './parse'

/** Every object and array in the document with its nesting depth (root = 0). */
export function foldTargets(text: string): FoldTarget[] {
  const root = parseLenient(text)
  const targets: FoldTarget[] = []
  const visit = (node: Node, depth: number) => {
    if (node.type === 'object' || node.type === 'array') {
      targets.push({ kind: node.type, depth, start: node.offset, end: node.offset + node.length })
    }
    const childDepth = node.type === 'object' || node.type === 'array' ? depth + 1 : depth
    for (const child of node.children ?? []) visit(child, childDepth)
  }
  if (root) visit(root, 0)
  return targets
}
