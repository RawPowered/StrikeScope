import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'

export interface TerritoryMapsConfig {
  apiKey?: string
  enableAddressAutocomplete?: boolean
  enableDirections?: boolean
  enableMapEmbed?: boolean
}

export interface TerritoryConfig {
  enabledStates: string[]
  splitByState: boolean
  directoryContactsEnabled: boolean
  maps?: TerritoryMapsConfig
}

export const DEFAULT_TERRITORY: TerritoryConfig = {
  enabledStates: [],
  splitByState: true,
  directoryContactsEnabled: true,
  maps: {
    enableAddressAutocomplete: false,
    enableDirections: false,
    enableMapEmbed: false,
  },
}

export function parseTerritoryJson(raw: string | null | undefined): TerritoryConfig {
  if (!raw) return { ...DEFAULT_TERRITORY, maps: { ...DEFAULT_TERRITORY.maps } }
  try {
    const parsed = JSON.parse(raw)
    const maps = parsed.maps || {}
    return {
      enabledStates: Array.isArray(parsed.enabledStates) ? parsed.enabledStates : [],
      splitByState: parsed.splitByState !== false,
      directoryContactsEnabled: parsed.directoryContactsEnabled !== false,
      maps: {
        apiKey: typeof maps.apiKey === 'string' ? maps.apiKey : undefined,
        enableAddressAutocomplete: !!maps.enableAddressAutocomplete,
        enableDirections: !!maps.enableDirections,
        enableMapEmbed: !!maps.enableMapEmbed,
      },
    }
  } catch {
    return { ...DEFAULT_TERRITORY, maps: { ...DEFAULT_TERRITORY.maps } }
  }
}

export function maskApiKey(key?: string): string | undefined {
  if (!key) return undefined
  if (key.length <= 4) return '••••'
  return `••••${key.slice(-4)}`
}

const territoryCache = new Map<string, { config: TerritoryConfig; at: number }>()
const TERRITORY_CACHE_TTL_MS = 60_000
let stmtTerritoryJson: import('better-sqlite3').Statement | null = null

function territoryStmt(db: Database.Database) {
  if (!stmtTerritoryJson) stmtTerritoryJson = db.prepare('SELECT territory_json FROM companies WHERE id=?')
  return stmtTerritoryJson
}

export function invalidateTerritoryCache(companyId: string) {
  territoryCache.delete(companyId)
}

export function getTerritoryConfigForCompany(db: Database.Database, companyId: string): TerritoryConfig {
  const hit = territoryCache.get(companyId)
  if (hit && Date.now() - hit.at < TERRITORY_CACHE_TTL_MS) return hit.config
  const row = territoryStmt(db).get(companyId) as { territory_json?: string } | undefined
  const config = parseTerritoryJson(row?.territory_json)
  territoryCache.set(companyId, { config, at: Date.now() })
  return config
}

export function getEnabledStatesForCompany(db: Database.Database, companyId: string): string[] {
  return getTerritoryConfigForCompany(db, companyId).enabledStates
}

export function getMapsApiKey(config: TerritoryConfig): string | undefined {
  return config.maps?.apiKey?.trim() || undefined
}

/** Merge incoming territory update; preserve apiKey when client sends masked placeholder */
export function mergeTerritoryUpdate(existing: TerritoryConfig, incoming: TerritoryConfig): TerritoryConfig {
  const next = { ...existing, ...incoming, maps: { ...existing.maps, ...incoming.maps } }
  const incomingKey = incoming.maps?.apiKey
  if (!incomingKey || incomingKey.startsWith('••••')) {
    next.maps = { ...next.maps, apiKey: existing.maps?.apiKey }
  }
  return next
}

export function territoryForClient(config: TerritoryConfig): TerritoryConfig {
  const maps = config.maps || {}
  return {
    ...config,
    maps: {
      ...maps,
      apiKey: maps.apiKey ? maskApiKey(maps.apiKey) : undefined,
    },
  }
}

export function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category'
}

const SYSTEM_CATEGORIES = [
  { name: 'County / State', slug: 'county-state', sortOrder: 0 },
  { name: 'Bank', slug: 'bank', sortOrder: 1 },
]

export function seedContactCategories(db: Database.Database, companyId: string) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO contact_categories (id, company_id, name, slug, is_enabled, is_system, sort_order)
    VALUES (?, ?, ?, ?, 1, 1, ?)
  `)
  for (const cat of SYSTEM_CATEGORIES) {
    const existing = db.prepare('SELECT id FROM contact_categories WHERE company_id=? AND slug=?').get(companyId, cat.slug)
    if (!existing) {
      insert.run(uuid(), companyId, cat.name, cat.slug, cat.sortOrder)
    }
  }
}

export function isDirectoryContactsEnabled(db: Database.Database, companyId: string): boolean {
  const row = db.prepare('SELECT territory_json FROM companies WHERE id=?').get(companyId) as { territory_json?: string } | undefined
  return parseTerritoryJson(row?.territory_json).directoryContactsEnabled
}

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS',
  'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY',
  'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
] as const
