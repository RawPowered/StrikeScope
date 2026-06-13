import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import Database from 'better-sqlite3'
import { DEV_SNAPSHOTS_DIR, DB_PATH } from '../../paths.js'
import { DB_FILENAME } from '@strikescope/shared/src/brand.js'
import { readWorkspaceFile, writeWorkspaceFile } from './workspace.js'

export interface SnapshotDeployMeta {
  modules: string[]
  buildOk: boolean
  shippedAt?: string
  buildLog?: string
}

export interface SnapshotManifest {
  id: string
  createdAt: string
  userId?: string
  prompt?: string
  files: { path: string; hash: string }[]
  hasDbBackup: boolean
  migrationFile?: string
  deploy?: SnapshotDeployMeta
}

function snapshotDir(id: string) {
  return join(DEV_SNAPSHOTS_DIR, id)
}

export function listSnapshots(): SnapshotManifest[] {
  if (!existsSync(DEV_SNAPSHOTS_DIR)) return []
  const dirs = readdirSync(DEV_SNAPSHOTS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
  const out: SnapshotManifest[] = []
  for (const id of dirs) {
    const manifestPath = join(DEV_SNAPSHOTS_DIR, id, 'manifest.json')
    if (!existsSync(manifestPath)) continue
    try {
      out.push(JSON.parse(readFileSync(manifestPath, 'utf-8')) as SnapshotManifest)
    } catch { /* skip */ }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function createSnapshot(opts: {
  paths: string[]
  userId?: string
  prompt?: string
  includeDb?: boolean
  migrationFile?: string
}): SnapshotManifest {
  const id = uuid()
  const dir = snapshotDir(id)
  const filesDir = join(dir, 'files')
  mkdirSync(filesDir, { recursive: true })

  const manifest: SnapshotManifest = {
    id,
    createdAt: new Date().toISOString(),
    userId: opts.userId,
    prompt: opts.prompt,
    files: [],
    hasDbBackup: false,
    migrationFile: opts.migrationFile,
  }

  for (const relPath of opts.paths) {
    try {
      const { path, content, hash } = readWorkspaceFile(relPath)
      const dest = join(filesDir, path.replace(/\//g, '__'))
      mkdirSync(join(dest, '..'), { recursive: true })
      writeFileSync(dest, content, 'utf-8')
      manifest.files.push({ path, hash })
    } catch {
      // file may be new — snapshot empty marker
      manifest.files.push({ path: relPath, hash: 'new' })
    }
  }

  if (opts.includeDb !== false && existsSync(DB_PATH)) {
    const dbDest = join(dir, DB_FILENAME)
    const src = new Database(DB_PATH, { readonly: true })
    src.backup(dbDest)
    src.close()
    manifest.hasDbBackup = true
  }

  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2))
  return manifest
}

export function rollbackSnapshot(id: string): { restoredFiles: string[]; dbRestored: boolean } {
  const dir = snapshotDir(id)
  const manifestPath = join(dir, 'manifest.json')
  if (!existsSync(manifestPath)) throw new Error('Snapshot not found')

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as SnapshotManifest
  const filesDir = join(dir, 'files')
  const restoredFiles: string[] = []

  for (const f of manifest.files) {
    const backupPath = join(filesDir, f.path.replace(/\//g, '__'))
    if (existsSync(backupPath)) {
      const content = readFileSync(backupPath, 'utf-8')
      writeWorkspaceFile(f.path, content)
      restoredFiles.push(f.path)
    }
  }

  let dbRestored = false
  const dbBackup = join(dir, DB_FILENAME)
  if (manifest.hasDbBackup && existsSync(dbBackup)) {
    const tmp = `${DB_PATH}.rollback.tmp`
    copyFileSync(dbBackup, tmp)
    try {
      const hot = new Database(DB_PATH)
      hot.close()
      copyFileSync(tmp, DB_PATH)
      dbRestored = true
    } finally {
      if (existsSync(tmp)) rmSync(tmp, { force: true })
    }
  }

  return { restoredFiles, dbRestored }
}

export function getSnapshot(id: string): SnapshotManifest | null {
  const manifestPath = join(DEV_SNAPSHOTS_DIR, id, 'manifest.json')
  if (!existsSync(manifestPath)) return null
  return JSON.parse(readFileSync(manifestPath, 'utf-8')) as SnapshotManifest
}

export function updateSnapshotDeployMeta(snapshotId: string, deploy: SnapshotDeployMeta): void {
  const snap = getSnapshot(snapshotId)
  if (!snap) return
  snap.deploy = deploy
  writeFileSync(join(DEV_SNAPSHOTS_DIR, snapshotId, 'manifest.json'), JSON.stringify(snap, null, 2))
}
