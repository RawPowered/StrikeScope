import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, renameSync, unlinkSync } from 'fs'
import { join, relative, resolve, normalize, extname, basename } from 'path'
import { createHash } from 'crypto'
import { getDevStudioConfig } from './config.js'

const BLOCKED_SEGMENTS = new Set(['node_modules', '.git', 'dist', 'coverage'])
const BLOCKED_FILES = new Set([
  '.env', '.env.local', 'server.config.json', 'credentials.json',
])
const ALLOWED_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.sql', '.xml', '.css', '.html', '.md', '.mjs', '.cjs', '.ps1'])

export function getWorkspaceRoot(): string {
  return getDevStudioConfig().workspaceRoot
}

export function resolveSafePath(relPath: string): string {
  const root = getWorkspaceRoot()
  const normalized = normalize(relPath.replace(/\\/g, '/'))
  if (normalized.includes('..')) throw new Error('Path traversal denied')
  const abs = resolve(root, normalized)
  const rel = relative(root, abs)
  if (rel.startsWith('..') || rel.includes('..')) throw new Error('Path outside workspace')
  for (const seg of rel.split(/[/\\]/)) {
    if (BLOCKED_SEGMENTS.has(seg)) throw new Error(`Blocked path segment: ${seg}`)
  }
  const base = basename(abs)
  if (BLOCKED_FILES.has(base)) throw new Error(`Blocked file: ${base}`)
  return abs
}

export function isWritablePath(relPath: string): boolean {
  const ext = extname(relPath).toLowerCase()
  if (ext && !ALLOWED_EXT.has(ext)) return false
  resolveSafePath(relPath)
  return true
}

export function fileHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export function listDirectory(relPath = ''): FileEntry[] {
  const abs = relPath ? resolveSafePath(relPath) : getWorkspaceRoot()
  if (!existsSync(abs)) return []
  const entries = readdirSync(abs, { withFileTypes: true })
  const root = getWorkspaceRoot()
  return entries
    .filter(e => !e.name.startsWith('.') || e.name === '.cursor')
    .filter(e => !BLOCKED_SEGMENTS.has(e.name))
    .map(e => ({
      name: e.name,
      path: relative(root, join(abs, e.name)).replace(/\\/g, '/'),
      type: e.isDirectory() ? 'dir' as const : 'file' as const,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
}

export function readWorkspaceFile(relPath: string): { path: string; content: string; hash: string } {
  const abs = resolveSafePath(relPath)
  if (!existsSync(abs)) throw new Error('File not found')
  const content = readFileSync(abs, 'utf-8')
  return { path: relPath.replace(/\\/g, '/'), content, hash: fileHash(content) }
}

export function writeWorkspaceFile(relPath: string, content: string): void {
  if (!isWritablePath(relPath)) throw new Error('File type not allowed for write')
  const abs = resolveSafePath(relPath)
  const dir = join(abs, '..')
  mkdirSync(dir, { recursive: true })
  const tmp = `${abs}.devstudio.tmp`
  writeFileSync(tmp, content, 'utf-8')
  if (existsSync(abs)) unlinkSync(abs)
  renameSync(tmp, abs)
}

export function searchCode(query: string, maxResults = 30): { path: string; line: number; text: string }[] {
  const root = getWorkspaceRoot()
  const results: { path: string; line: number; text: string }[] = []
  const q = query.toLowerCase()
  const walk = (dir: string) => {
    if (results.length >= maxResults) return
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      if (results.length >= maxResults) return
      if (e.name.startsWith('.') && e.name !== '.cursor') continue
      if (BLOCKED_SEGMENTS.has(e.name)) continue
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else {
        const ext = extname(e.name).toLowerCase()
        if (!ALLOWED_EXT.has(ext)) continue
        try {
          const lines = readFileSync(full, 'utf-8').split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(q)) {
              results.push({
                path: relative(root, full).replace(/\\/g, '/'),
                line: i + 1,
                text: lines[i].trim().slice(0, 200),
              })
              if (results.length >= maxResults) return
            }
          }
        } catch { /* skip */ }
      }
    }
  }
  walk(root)
  return results
}

export function applyPatches(patches: { path: string; content: string }[]): string[] {
  const written: string[] = []
  for (const p of patches) {
    writeWorkspaceFile(p.path, p.content)
    written.push(p.path)
  }
  return written
}
