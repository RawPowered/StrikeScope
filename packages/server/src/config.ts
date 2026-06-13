import { readFileSync, existsSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export interface DevStudioConfig {
  ollamaHost: string
  defaultModel: string
  embedModel: string
  platformModel?: string
  selectedModel?: string
  workspaceRoot: string
  knowledgeAutoSync: boolean
  learnFromApprovals: boolean
  contextWindow?: number
  historyLimit?: number
  ragTopK?: number
  maxContextChars?: number
}

export interface ServerConfig {
  port: number
  devMode: boolean
  keys: {
    apiKey: string
    nodeKey: string
  }
  storageDir: string
  devStudio?: DevStudioConfig
}

const DEV_DEFAULTS: ServerConfig = {
  port: 3001,
  devMode: true,
  keys: { apiKey: 'dev-api-key', nodeKey: 'dev-node-key' },
  storageDir: join(__dirname, '..', 'data', 'uploads'),
}

let config: ServerConfig | null = null

const CONFIG_PATH = join(__dirname, '..', 'server.config.json')

export function loadConfig(): ServerConfig {
  if (config) return config

  // 1. Load from config file if it exists
  let fileConfig: Partial<ServerConfig> = {}
  if (existsSync(CONFIG_PATH)) {
    try {
      const raw = readFileSync(CONFIG_PATH, 'utf-8')
      fileConfig = JSON.parse(raw)
    } catch (e) {
      logger.warn({ err: e }, 'Failed to parse server.config.json, using defaults')
    }
  }

  // 2. Environment variables override everything
  const envDevMode = process.env.DEV_MODE !== undefined
    ? process.env.DEV_MODE === 'true' || process.env.DEV_MODE === '1'
    : undefined

  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : undefined
  const envApiKey = process.env.SERVER_API_KEY || undefined
  const envNodeKey = process.env.SERVER_NODE_KEY || undefined

  const isDev = envDevMode ?? fileConfig.devMode ?? DEV_DEFAULTS.devMode

  config = {
    port: envPort ?? fileConfig.port ?? DEV_DEFAULTS.port,
    devMode: isDev,
    keys: {
      apiKey: envApiKey ?? (fileConfig as any)?.keys?.apiKey ?? DEV_DEFAULTS.keys.apiKey,
      nodeKey: envNodeKey ?? (fileConfig as any)?.keys?.nodeKey ?? DEV_DEFAULTS.keys.nodeKey,
    },
    storageDir: fileConfig.storageDir ?? DEV_DEFAULTS.storageDir,
    devStudio: (fileConfig as Partial<ServerConfig>).devStudio,
  }

  // In production, fail if keys are still defaults
  if (!isDev) {
    if (config.keys.apiKey === DEV_DEFAULTS.keys.apiKey) {
      throw new Error('SERVER_API_KEY environment variable is required in production mode')
    }
    if (config.keys.nodeKey === DEV_DEFAULTS.keys.nodeKey) {
      throw new Error('SERVER_NODE_KEY environment variable is required in production mode')
    }
  }

  // Persist config file for reference
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
  }

  return config
}

export function getConfig(): ServerConfig {
  if (!config) return loadConfig()
  return config
}
