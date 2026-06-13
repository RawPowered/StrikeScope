import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getWorkspaceRoot } from './workspace.js'

export interface FeatureMap {
  id: string
  owner: string
  routes: string[]
  plugins: string[]
  tables: string[]
}

let cachedFeatures: FeatureMap[] | null = null

function parseSysMap(): FeatureMap[] {
  if (cachedFeatures) return cachedFeatures
  const path = join(getWorkspaceRoot(), 'EnVars', 'SysMap.xml')
  if (!existsSync(path)) return []
  const xml = readFileSync(path, 'utf-8')
  const features: FeatureMap[] = []
  const featureBlocks = xml.match(/<Feature[^>]*>[\s\S]*?<\/Feature>/g) || []
  for (const block of featureBlocks) {
    const idMatch = block.match(/id="([^"]+)"/)
    const ownerMatch = block.match(/owner="([^"]+)"/)
    if (!idMatch) continue
    const routes = [...block.matchAll(/<(?:Route|AdminRoute|ServerRoute)>([^<]+)<\//g)].map(m => m[1])
    const plugins = [...block.matchAll(/<Plugin path="([^"]+)"/g)].map(m => m[1])
    const tables = [...block.matchAll(/<Table>([^<]+)<\/Table>/g)].map(m => m[1])
    features.push({
      id: idMatch[1],
      owner: ownerMatch?.[1] || '',
      routes,
      plugins,
      tables,
    })
  }
  cachedFeatures = features
  return features
}

export function getFeatureMaps(): FeatureMap[] {
  return parseSysMap()
}

export function getFeatureForPath(filePath: string): FeatureMap | null {
  const normalized = filePath.replace(/\\/g, '/')
  for (const f of parseSysMap()) {
    if (f.owner && normalized.startsWith(f.owner.replace(/\\/g, '/'))) return f
    for (const p of f.plugins) {
      if (normalized.startsWith(p.replace(/\\/g, '/'))) return f
    }
  }
  return null
}

export function checkCrossModuleEdits(paths: string[], allowCrossModule: boolean): {
  warnings: string[]
  blocked: boolean
} {
  if (allowCrossModule) return { warnings: [], blocked: false }
  const features = new Set<string>()
  for (const p of paths) {
    const f = getFeatureForPath(p)
    if (f) features.add(f.id)
  }
  if (features.size <= 1) return { warnings: [], blocked: false }
  const warnings = [`Cross-module edit spans features: ${[...features].join(', ')}`]
  return { warnings, blocked: false }
}

export function getFeatureMap(featureId: string): FeatureMap | null {
  return parseSysMap().find(f => f.id === featureId) || null
}

export function invalidateSysMapCache(): void {
  cachedFeatures = null
}
