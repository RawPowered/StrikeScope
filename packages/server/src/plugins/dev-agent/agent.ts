import type { ChatMessage } from './ollama-client.js'
import { chatOnce, streamChat } from './ollama-client.js'
import { retrieveContext, formatContextForPrompt } from './platform-knowledge/index.js'
import {
  TOOL_DEFINITIONS, executeTool, getPendingPatches, clearPendingPatches, getPendingMigration, addPendingPatch,
} from './tools.js'
import { extractPatchesFromText, isImplementationRequest } from './code-patch-parser.js'
import { parseEmbeddedToolCalls, stripEmbeddedToolCalls } from './tool-parse.js'
import { buildPreflightContext } from './preflight.js'
import { getDevStudioConfig } from './config.js'

function trimHistoryContent(text: string, max = 1800): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n…[truncated ${text.length - max} chars]`
}

export interface AgentEvent {
  type: 'token' | 'tool_start' | 'tool_result' | 'patches' | 'migration' | 'error' | 'done' | 'phase'
  phase?: 'investigating' | 'proposing' | 'ready' | 'advisory_only'
  content?: string
  tool?: string
  result?: string
  patches?: ReturnType<typeof getPendingPatches>
  migration?: { filename: string; sql: string } | null
}

const SYSTEM_PROMPT = `You are the StrikeScope Dev Studio coding agent for this CRM monorepo.

STACK (never hallucinate other stacks):
- Backend: Express + better-sqlite3 (NOT Mongoose/MongoDB)
- Frontend: React + Vite in packages/admin
- Data: SQLite tables (leads, companies, contacts, etc.)

AGENTIC BUILD WORKFLOW (mandatory for implement/fix/add requests):
1. INVESTIGATE: search_platform, search_code, get_schema, read_file, sql_inspect — use tools, do not guess
2. PROPOSE: call propose_patch with FULL file content for each file you change
3. NEVER end with "here is code you can use" or paste-only snippets — if you wrote code, you MUST call propose_patch
4. User ships via Dev Studio: Continue Build → Confirm Update (you do not run builds yourself)

TOOL USE:
- Call tools through the tool API. Do NOT paste raw tool JSON in chat.
- After investigation, call propose_patch before your final summary.

RULES:
- Minimal focused diffs; read_file before propose_patch
- Respect plugin boundaries in EnVars/SysMap.xml
- Migrations: propose_migration + dated YYYYMMDD_*.sql, idempotent`

const DEBUG_PROMPT = `DEBUG MODE: A build or deploy failed. Fix the errors using propose_patch only.
- Read failing files before editing
- Do not ship or assume writes are live until user runs Continue Build
- Explain the root cause briefly after proposing fixes`

export async function* runAgent(opts: {
  prompt: string
  activePath?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  historyLimit?: number
  maxSteps?: number
  stream?: boolean
  debugContext?: { buildLog?: string; healthError?: string }
}): AsyncGenerator<AgentEvent> {
  const cfg = getDevStudioConfig()
  const wantsImplementation = isImplementationRequest(opts.prompt)
  const maxSteps = opts.maxSteps ?? (wantsImplementation ? 16 : 10)
  const historyLimit = opts.historyLimit ?? cfg.historyLimit ?? 4
  clearPendingPatches()

  const ctx = await retrieveContext({
    query: opts.prompt,
    activePath: opts.activePath,
    topK: cfg.ragTopK ?? 6,
    maxChars: cfg.maxContextChars ?? 24000,
  })
  const preflight = buildPreflightContext(opts.prompt)
  const contextBlock = formatContextForPrompt(ctx, cfg.maxContextChars ?? 24000)
  const systemParts = [SYSTEM_PROMPT, '', contextBlock]
  if (opts.debugContext) {
    systemParts.push('', DEBUG_PROMPT)
    if (opts.debugContext.buildLog) {
      systemParts.push('', '## Build log', '```', opts.debugContext.buildLog.slice(0, 8000), '```')
    }
    if (opts.debugContext.healthError) {
      systemParts.push('', '## Deploy health error', opts.debugContext.healthError)
    }
  }
  if (preflight) systemParts.push('', preflight)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemParts.join('\n') },
  ]

  if (historyLimit > 0 && opts.history?.length) {
    for (const h of opts.history.slice(-historyLimit)) {
      messages.push({ role: h.role, content: trimHistoryContent(h.content) })
    }
  }

  let userContent = opts.prompt
  if (opts.activePath) userContent += `\n\nActive file: ${opts.activePath}`
  messages.push({ role: 'user', content: userContent })

  for (let step = 0; step < maxSteps; step++) {
    let content = ''
    let toolCalls: { function: { name: string; arguments: Record<string, unknown> } }[] | undefined

    yield { type: 'phase', phase: getPendingPatches().length ? 'proposing' : 'investigating' }

    if (opts.stream) {
      for await (const ev of streamChat(messages, TOOL_DEFINITIONS)) {
        if (ev.type === 'token' && ev.content) content += ev.content
        if (ev.type === 'tool_calls' && ev.tool_calls) toolCalls = ev.tool_calls
      }
    } else {
      const res = await chatOnce(messages, TOOL_DEFINITIONS)
      content = res.content
      toolCalls = res.tool_calls
    }

    if (!toolCalls?.length) {
      const embedded = parseEmbeddedToolCalls(content)
      if (embedded?.length) {
        toolCalls = embedded
        content = stripEmbeddedToolCalls(content)
      }
    }

    if (content && !toolCalls?.length) {
      yield { type: 'token', content }
    }

    if (!toolCalls?.length) {
      const pending = getPendingPatches()
      if (!pending.length && wantsImplementation && content) {
        const extracted = extractPatchesFromText(content, opts.activePath)
        for (const p of extracted) addPendingPatch(p)
      }

      const afterExtract = getPendingPatches()
      if (!afterExtract.length && wantsImplementation && step < maxSteps - 1) {
        const hasCodeFence = /```/.test(content)
        const nudge = hasCodeFence
          ? 'You pasted code in chat but did not call propose_patch. Read the target file(s), then call propose_patch with full file content for each change. This repo uses Express+SQLite, not Mongoose.'
          : 'Implementation request: use tools to investigate, then call propose_patch for each file you change. Do not give manual instructions.'
        messages.push({ role: 'assistant', content })
        messages.push({ role: 'user', content: nudge })
        yield { type: 'phase', phase: 'proposing' }
        continue
      }

      yield {
        type: 'phase',
        phase: afterExtract.length ? 'ready' : (wantsImplementation ? 'advisory_only' : 'investigating'),
      }
      yield { type: 'patches', patches: afterExtract }
      yield { type: 'migration', migration: getPendingMigration() }
      yield { type: 'done' }
      return
    }

    messages.push({ role: 'assistant', content, tool_calls: toolCalls } as ChatMessage)

    for (const tc of toolCalls) {
      const name = tc.function.name
      let args = tc.function.arguments
      if (typeof args === 'string') {
        try { args = JSON.parse(args) } catch { args = {} }
      }
      yield { type: 'tool_start', tool: name, content: JSON.stringify(args) }
      try {
        const result = await executeTool(name, args as Record<string, unknown>, { activePath: opts.activePath })
        yield { type: 'tool_result', tool: name, result: result.slice(0, 2000) }
        messages.push({ role: 'tool', content: result, tool_name: name } as ChatMessage)
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e)
        yield { type: 'tool_result', tool: name, result: err }
        messages.push({ role: 'tool', content: err, tool_name: name } as ChatMessage)
      }
    }
  }

  yield { type: 'patches', patches: getPendingPatches() }
  yield { type: 'migration', migration: getPendingMigration() }
  yield { type: 'done' }
}
