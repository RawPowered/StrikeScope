import { getDevStudioConfig, setSelectedModel } from './config.js'
import { parseModelfile } from './modelfile-parse.js'

export interface OllamaModel {
  name: string
  size?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  tool_name?: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}

export interface OllamaTool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

let cachedModelNames: string[] | null = null
let cacheAt = 0
const CACHE_MS = 30_000

async function listModelNames(): Promise<string[]> {
  if (cachedModelNames && Date.now() - cacheAt < CACHE_MS) return cachedModelNames
  const health = await checkOllamaHealth()
  if (!health.ok) throw new Error(health.error || 'Ollama is not reachable')
  cachedModelNames = health.models.map(m => m.name)
  cacheAt = Date.now()
  return cachedModelNames
}

export function invalidateModelCache(): void {
  cachedModelNames = null
}

function modelExists(installed: string[], candidate: string): string | null {
  if (!candidate) return null
  if (installed.includes(candidate)) return candidate
  const base = candidate.split(':')[0]
  const match = installed.find(n => n === candidate || n.startsWith(`${base}:`) || n.split(':')[0] === base)
  return match || null
}

export async function resolveChatModel(explicit?: string): Promise<string> {
  const cfg = getDevStudioConfig()
  const installed = await listModelNames()
  const candidates = [
    explicit,
    cfg.selectedModel,
    cfg.platformModel,
    cfg.defaultModel,
    'qwen2.5-coder:7b',
    'deepseek-coder-v2',
    'codellama',
  ].filter(Boolean) as string[]

  for (const c of candidates) {
    const hit = modelExists(installed, c)
    if (hit) return hit
  }

  const coder = installed.find(n => /coder|codellama|deepseek/i.test(n))
  if (coder) return coder

  throw new Error(`No coding model found. Run: ollama pull ${cfg.defaultModel}`)
}

export async function resolveEmbedModel(): Promise<string> {
  const cfg = getDevStudioConfig()
  const installed = await listModelNames()
  const candidates = [cfg.embedModel, 'nomic-embed-text', 'mxbai-embed-large']
  for (const c of candidates) {
    const hit = modelExists(installed, c)
    if (hit) return hit
  }
  const embed = installed.find(n => /embed/i.test(n))
  if (embed) return embed
  throw new Error(`No embed model found. Run: ollama pull ${cfg.embedModel}`)
}

async function ollamaFetch(path: string, init?: RequestInit) {
  const { ollamaHost } = getDevStudioConfig()
  const res = await fetch(`${ollamaHost}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    signal: AbortSignal.timeout(120_000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Ollama ${path} failed (${res.status}): ${text.slice(0, 200)}`)
  }
  return res
}

export async function checkOllamaHealth(): Promise<{ ok: boolean; models: OllamaModel[]; error?: string }> {
  try {
    const { ollamaHost } = getDevStudioConfig()
    const res = await fetch(`${ollamaHost}/api/tags`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return { ok: false, models: [], error: `Ollama tags failed (${res.status}): ${text.slice(0, 120)}` }
    }
    const data = await res.json() as { models?: { name: string; size?: number }[] }
    return {
      ok: true,
      models: (data.models || []).map(m => ({ name: m.name, size: m.size })),
    }
  } catch (e) {
    return { ok: false, models: [], error: e instanceof Error ? e.message : String(e) }
  }
}

export async function embedText(text: string): Promise<number[]> {
  const model = await resolveEmbedModel()
  const res = await ollamaFetch('/api/embeddings', {
    method: 'POST',
    body: JSON.stringify({ model, prompt: text.slice(0, 8000) }),
  })
  const data = await res.json() as { embedding?: number[] }
  if (!data.embedding?.length) throw new Error('Empty embedding from Ollama')
  return data.embedding
}

export async function chatCompletion(opts: {
  messages: ChatMessage[]
  tools?: OllamaTool[]
  stream?: boolean
  model?: string
}): Promise<Response> {
  const cfg = getDevStudioConfig()
  const model = opts.model || await resolveChatModel()
  return ollamaFetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      model,
      messages: opts.messages,
      tools: opts.tools,
      stream: opts.stream ?? false,
      options: {
        temperature: 0.2,
        num_ctx: cfg.contextWindow ?? 16384,
      },
    }),
  })
}

export async function chatOnce(messages: ChatMessage[], tools?: OllamaTool[]): Promise<{
  content: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}> {
  const res = await chatCompletion({ messages, tools, stream: false })
  const data = await res.json() as {
    message?: {
      content?: string
      tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
    }
  }
  return {
    content: data.message?.content || '',
    tool_calls: data.message?.tool_calls,
  }
}

export async function* streamChat(messages: ChatMessage[], tools?: OllamaTool[]): AsyncGenerator<{
  type: 'token' | 'tool_calls' | 'done'
  content?: string
  tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
}> {
  const res = await chatCompletion({ messages, tools, stream: true })
  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let toolCalls: { function: { name: string; arguments: Record<string, unknown> } }[] | undefined

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const chunk = JSON.parse(line) as {
          message?: {
            content?: string
            tool_calls?: { function: { name: string; arguments: Record<string, unknown> } }[]
          }
          done?: boolean
        }
        if (chunk.message?.content) {
          yield { type: 'token', content: chunk.message.content }
        }
        if (chunk.message?.tool_calls?.length) {
          toolCalls = chunk.message.tool_calls
        }
        if (chunk.done) {
          if (toolCalls?.length) yield { type: 'tool_calls', tool_calls: toolCalls }
          yield { type: 'done' }
        }
      } catch {
        // skip malformed line
      }
    }
  }
  yield { type: 'done' }
}

export async function createPlatformModel(): Promise<{ ok: boolean; model?: string; error?: string }> {
  const cfg = getDevStudioConfig()
  const { readFileSync } = await import('fs')
  const { join } = await import('path')
  const { DEV_AGENT_DIR } = await import('../../paths.js')
  const modelfilePath = join(DEV_AGENT_DIR, 'Modelfile')
  const modelName = cfg.platformModel || 'strikescope-dev'
  try {
    const raw = readFileSync(modelfilePath, 'utf-8')
    const parsed = parseModelfile(raw)
    const baseModel = modelExists(await listModelNames(), parsed.from)
    if (!baseModel) {
      return {
        ok: false,
        error: `Base model "${parsed.from}" not installed. Run: ollama pull ${parsed.from}`,
      }
    }

    const res = await fetch(`${cfg.ollamaHost}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelName,
        from: baseModel,
        system: parsed.system || undefined,
        parameters: parsed.parameters,
        stream: false,
      }),
      signal: AbortSignal.timeout(300_000),
    })
    const text = await res.text().catch(() => '')
    if (!res.ok) {
      let err = text
      try {
        const j = JSON.parse(text) as { error?: string }
        if (j.error) err = j.error
      } catch { /* raw text */ }
      return {
        ok: false,
        error: err || `ollama create failed. CLI fallback: ollama create ${modelName} -f ${modelfilePath}`,
      }
    }

    let status = ''
    try {
      const j = JSON.parse(text) as { status?: string; error?: string }
      status = j.status || ''
      if (j.error) return { ok: false, error: j.error }
    } catch {
      if (!text.includes('success')) {
        return { ok: false, error: text.slice(0, 300) || 'Unknown create response' }
      }
    }
    if (status && status !== 'success') {
      return { ok: false, error: `Create status: ${status}` }
    }

    setSelectedModel(modelName)
    invalidateModelCache()
    return { ok: true, model: modelName }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    }
  }
}
