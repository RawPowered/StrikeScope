import { TOOL_DEFINITIONS } from './tools.js'

const KNOWN_TOOLS = new Set(TOOL_DEFINITIONS.map(t => t.function.name))

export interface ParsedToolCall {
  function: { name: string; arguments: Record<string, unknown> }
}

function normalizeArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) as Record<string, unknown> } catch { return {} }
  }
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>
  return {}
}

function addCall(calls: ParsedToolCall[], seen: Set<string>, name: string, args: unknown): void {
  if (!name || !KNOWN_TOOLS.has(name)) return
  const arguments_ = normalizeArgs(args)
  const key = `${name}:${JSON.stringify(arguments_)}`
  if (seen.has(key)) return
  seen.add(key)
  calls.push({ function: { name, arguments: arguments_ } })
}

function ingestObject(obj: unknown, calls: ParsedToolCall[], seen: Set<string>): void {
  if (!obj || typeof obj !== 'object') return
  const o = obj as Record<string, unknown>
  if (typeof o.name === 'string') {
    addCall(calls, seen, o.name, o.arguments ?? o.parameters ?? {})
    return
  }
  if (Array.isArray(o)) {
    for (const item of o) ingestObject(item, calls, seen)
    return
  }
  if (Array.isArray(o.tool_calls)) {
    for (const tc of o.tool_calls) {
      const fn = (tc as { function?: { name?: string; arguments?: unknown } }).function
      if (fn?.name) addCall(calls, seen, fn.name, fn.arguments)
    }
    return
  }
  const fn = o.function as { name?: string; arguments?: unknown } | undefined
  if (fn?.name) addCall(calls, seen, fn.name, fn.arguments)
}

function jsonCandidates(text: string): string[] {
  const out: string[] = []
  const trimmed = text.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) out.push(trimmed)

  const fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi
  let m: RegExpExecArray | null
  while ((m = fenceRe.exec(text)) !== null) {
    out.push(m[1].trim())
  }

  const toolNameAlt = [...KNOWN_TOOLS].join('|')
  const inlineRe = new RegExp(`\\{[\\s\\S]*?"name"\\s*:\\s*"(?:${toolNameAlt})"[\\s\\S]*?\\}`, 'gi')
  while ((m = inlineRe.exec(text)) !== null) {
    out.push(m[0])
  }
  return out
}

export function parseEmbeddedToolCalls(text: string): ParsedToolCall[] | undefined {
  const calls: ParsedToolCall[] = []
  const seen = new Set<string>()
  for (const cand of jsonCandidates(text)) {
    try {
      ingestObject(JSON.parse(cand), calls, seen)
    } catch { /* not valid json */ }
  }
  return calls.length ? calls : undefined
}

export function stripEmbeddedToolCalls(text: string): string {
  const toolNameAlt = [...KNOWN_TOOLS].join('|')
  let out = text
  out = out.replace(
    new RegExp(`\`\`\`(?:json)?\\s*\\{[\\s\\S]*?"name"\\s*:\\s*"(?:${toolNameAlt})"[\\s\\S]*?\`\`\``, 'gi'),
    '',
  )
  out = out.replace(
    new RegExp(`\\{\\s*"name"\\s*:\\s*"(?:${toolNameAlt})"[\\s\\S]*?\\}`, 'gi'),
    '',
  )
  return out.trim()
}
