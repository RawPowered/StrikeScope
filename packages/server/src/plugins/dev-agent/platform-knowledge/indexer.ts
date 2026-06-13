import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, relative, extname } from 'path'
import { createHash } from 'crypto'
import { getWorkspaceRoot } from '../workspace.js'
import { getFeatureForPath } from '../module-guard.js'
import { getSchemaOverview } from '../sql-tools.js'
import { buildPlatformBrief } from './platform-brief.js'
import { upsertChunk, deleteChunksForPath, setMeta, clearKnowledgeChunks } from './store.js'
import { embedWithFallback } from './embeddings.js'

const INDEX_EXT = new Set(['.ts', '.tsx', '.sql', '.xml', '.json'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'data'])

function chunkText(content: string, maxLen = 3000): string[] {
  if (content.length <= maxLen) return [content]
  const chunks: string[] = []
  const lines = content.split('\n')
  let buf = ''
  for (const line of lines) {
    if (buf.length + line.length > maxLen && buf) {
      chunks.push(buf)
      buf = ''
    }
    buf += line + '\n'
  }
  if (buf) chunks.push(buf)
  return chunks
}

function hashChunk(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 12)
}

function walkFiles(dir: string, root: string, out: string[]): void {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.cursor') continue
    if (SKIP_DIRS.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      walkFiles(full, root, out)
    } else {
      const ext = extname(e.name).toLowerCase()
      if (!INDEX_EXT.has(ext)) continue
      out.push(relative(root, full).replace(/\\/g, '/'))
    }
  }
}

export interface SyncProgress {
  phase: string
  current: number
  total: number
  path?: string
}

export async function syncKnowledge(opts: {
  full?: boolean
  paths?: string[]
  onProgress?: (p: SyncProgress) => void
}): Promise<{ indexed: number; errors: number }> {
  const root = getWorkspaceRoot()
  if (opts.full) clearKnowledgeChunks()

  let paths = opts.paths
  if (!paths?.length) {
    paths = []
    walkFiles(join(root, 'EnVars'), root, paths)
    walkFiles(join(root, 'packages', 'server', 'src'), root, paths)
    walkFiles(join(root, 'packages', 'admin', 'src'), root, paths)
    walkFiles(join(root, 'shared'), root, paths)
  }

  const staticSources = [
    { path: 'EnVars/platform-brief.md', content: buildPlatformBrief() },
  ]

  try {
    const schema = getSchemaOverview()
    staticSources.push({
      path: 'db/schema-overview.json',
      content: JSON.stringify(schema, null, 2),
    })
  } catch { /* db may not exist in tests */ }

  let indexed = 0
  let errors = 0
  const total = paths.length + staticSources.length

  for (let i = 0; i < staticSources.length; i++) {
    const s = staticSources[i]
    opts.onProgress?.({ phase: 'static', current: i, total, path: s.path })
    try {
      const chunks = chunkText(s.content)
      for (const c of chunks) {
        const h = hashChunk(c)
        const emb = await embedWithFallback(c.slice(0, 2000))
        upsertChunk({ path: s.path, featureId: 'platform', chunkHash: h, content: c, embedding: emb })
        indexed++
      }
    } catch { errors++ }
  }

  for (let i = 0; i < paths.length; i++) {
    const rel = paths[i]
    opts.onProgress?.({ phase: 'files', current: i + staticSources.length, total, path: rel })
    const abs = join(root, rel)
    if (!existsSync(abs)) continue
    try {
      deleteChunksForPath(rel)
      const content = readFileSync(abs, 'utf-8')
      const feature = getFeatureForPath(rel)
      const chunks = chunkText(content)
      for (const c of chunks) {
        const h = hashChunk(c)
        const emb = await embedWithFallback(c.slice(0, 2000))
        upsertChunk({
          path: rel,
          featureId: feature?.id || null,
          chunkHash: h,
          content: c,
          embedding: emb,
        })
        indexed++
      }
    } catch {
      errors++
    }
  }

  setMeta('last_sync', new Date().toISOString())
  return { indexed, errors }
}

export async function syncPaths(paths: string[]): Promise<void> {
  await syncKnowledge({ paths })
}
