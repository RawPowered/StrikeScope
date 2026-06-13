import { existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { DevStudioConfig } from '../../config.js'

let cachedDevStudio: DevStudioConfig | null = null

const __dirname = dirname(fileURLToPath(import.meta.url))

function resolveWorkspaceRoot(): string {
  if (process.env.DEV_STUDIO_ROOT) return process.env.DEV_STUDIO_ROOT
  let dir = join(__dirname, '..', '..', '..', '..', '..')
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, 'package.json')) && existsSync(join(dir, 'EnVars', 'SysMap.xml'))) {
      return dir
    }
    dir = join(dir, '..')
  }
  return join(__dirname, '..', '..', '..', '..', '..')
}

const DEFAULTS: DevStudioConfig = {
  ollamaHost: process.env.OLLAMA_HOST || 'http://127.0.0.1:11434',
  defaultModel: process.env.DEV_STUDIO_MODEL || 'qwen2.5-coder:7b',
  embedModel: process.env.DEV_STUDIO_EMBED_MODEL || 'nomic-embed-text',
  platformModel: process.env.DEV_STUDIO_PLATFORM_MODEL || 'strikescope-dev',
  selectedModel: process.env.DEV_STUDIO_SELECTED_MODEL || undefined,
  workspaceRoot: resolveWorkspaceRoot(),
  knowledgeAutoSync: true,
  learnFromApprovals: true,
  contextWindow: Number(process.env.DEV_STUDIO_NUM_CTX) || 16384,
  historyLimit: Number(process.env.DEV_STUDIO_HISTORY_LIMIT) || 4,
  ragTopK: Number(process.env.DEV_STUDIO_RAG_TOP_K) || 6,
  maxContextChars: Number(process.env.DEV_STUDIO_MAX_CONTEXT_CHARS) || 24000,
}

export function setDevStudioConfigOverride(cfg?: Partial<DevStudioConfig>): void {
  cachedDevStudio = cfg ? { ...DEFAULTS, ...cachedDevStudio, ...cfg } : null
}

export function setSelectedModel(model: string | undefined): void {
  cachedDevStudio = { ...DEFAULTS, ...cachedDevStudio, selectedModel: model }
}

export function getDevStudioConfig(override?: Partial<DevStudioConfig>): DevStudioConfig {
  if (override) return { ...DEFAULTS, ...cachedDevStudio, ...override }
  if (cachedDevStudio) return cachedDevStudio
  return DEFAULTS
}

export function initDevStudioFromServerConfig(cfg?: DevStudioConfig): void {
  if (cfg) cachedDevStudio = { ...DEFAULTS, ...cfg }
}
