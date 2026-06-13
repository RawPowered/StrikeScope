import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { DEV_KNOWLEDGE_DB_PATH } from '../../../paths.js'

let db: Database.Database | null = null

export function getKnowledgeDb(): Database.Database {
  if (db) return db
  mkdirSync(dirname(DEV_KNOWLEDGE_DB_PATH), { recursive: true })
  db = new Database(DEV_KNOWLEDGE_DB_PATH)
  db.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL,
      feature_id TEXT,
      chunk_hash TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding_blob BLOB,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(path, chunk_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_knowledge_path ON knowledge_chunks(path);
    CREATE INDEX IF NOT EXISTS idx_knowledge_feature ON knowledge_chunks(feature_id);

    CREATE TABLE IF NOT EXISTS knowledge_meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS knowledge_golden (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      feature_id TEXT,
      files TEXT,
      diff_summary TEXT,
      migration_sql TEXT,
      outcome TEXT DEFAULT 'approved',
      embedding_blob BLOB,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `)
  return db
}

export interface KnowledgeChunk {
  id: number
  path: string
  feature_id: string | null
  content: string
  embedding?: number[]
}

export function upsertChunk(chunk: {
  path: string
  featureId: string | null
  chunkHash: string
  content: string
  embedding?: number[]
}): void {
  const d = getKnowledgeDb()
  const blob = chunk.embedding ? Buffer.from(new Float32Array(chunk.embedding).buffer) : null
  d.prepare(`
    INSERT INTO knowledge_chunks (path, feature_id, chunk_hash, content, embedding_blob, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(path, chunk_hash) DO UPDATE SET
      content=excluded.content,
      embedding_blob=excluded.embedding_blob,
      updated_at=datetime('now')
  `).run(chunk.path, chunk.featureId, chunk.chunkHash, chunk.content, blob)
}

export function deleteChunksForPath(path: string): void {
  getKnowledgeDb().prepare('DELETE FROM knowledge_chunks WHERE path=?').run(path)
}

export function getAllChunks(): KnowledgeChunk[] {
  const rows = getKnowledgeDb().prepare('SELECT id, path, feature_id, content, embedding_blob FROM knowledge_chunks').all() as {
    id: number; path: string; feature_id: string | null; content: string; embedding_blob: Buffer | null
  }[]
  return rows.map(r => ({
    id: r.id,
    path: r.path,
    feature_id: r.feature_id,
    content: r.content,
    embedding: r.embedding_blob ? blobToEmbedding(r.embedding_blob) : undefined,
  }))
}

export function blobToEmbedding(blob: Buffer): number[] {
  const floats = new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4)
  return Array.from(floats)
}

export function setMeta(key: string, value: string): void {
  getKnowledgeDb().prepare('INSERT INTO knowledge_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value)
}

export function getMeta(key: string): string | null {
  const row = getKnowledgeDb().prepare('SELECT value FROM knowledge_meta WHERE key=?').get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function getKnowledgeStats(): {
  chunkCount: number
  goldenCount: number
  lastSync: string | null
} {
  const d = getKnowledgeDb()
  const chunkCount = (d.prepare('SELECT COUNT(*) as c FROM knowledge_chunks').get() as { c: number }).c
  const goldenCount = (d.prepare('SELECT COUNT(*) as c FROM knowledge_golden').get() as { c: number }).c
  return { chunkCount, goldenCount, lastSync: getMeta('last_sync') }
}

export function insertGolden(entry: {
  prompt: string
  featureId: string | null
  files: string[]
  diffSummary: string
  migrationSql?: string
  embedding?: number[]
}): void {
  const blob = entry.embedding ? Buffer.from(new Float32Array(entry.embedding).buffer) : null
  getKnowledgeDb().prepare(`
    INSERT INTO knowledge_golden (prompt, feature_id, files, diff_summary, migration_sql, embedding_blob)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    entry.prompt,
    entry.featureId,
    JSON.stringify(entry.files),
    entry.diffSummary,
    entry.migrationSql || null,
    blob,
  )
}

export function getGoldenExamples(): {
  id: number
  prompt: string
  feature_id: string | null
  files: string[]
  diff_summary: string
  created_at: string
}[] {
  const rows = getKnowledgeDb().prepare(
    'SELECT id, prompt, feature_id, files, diff_summary, created_at FROM knowledge_golden ORDER BY id DESC LIMIT 50',
  ).all() as { id: number; prompt: string; feature_id: string | null; files: string; diff_summary: string; created_at: string }[]
  return rows.map(r => ({ ...r, files: JSON.parse(r.files) as string[] }))
}

export function clearKnowledgeChunks(): void {
  getKnowledgeDb().exec('DELETE FROM knowledge_chunks')
}
