import { createHash, randomBytes } from 'crypto'
import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

const KEY_PREFIX = 'ssap_'

function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function generateServiceKey(): string {
  return `${KEY_PREFIX}${randomBytes(24).toString('hex')}`
}

export function rotateServiceKey(db: Database.Database, companyId: string): { key: string; prefix: string } {
  const raw = generateServiceKey()
  const keyHash = hashKey(raw)
  const prefix = raw.slice(0, 12)
  const existing = db.prepare('SELECT id FROM automation_service_keys WHERE company_id = ?').get(companyId) as { id: string } | undefined

  if (existing) {
    db.prepare(`UPDATE automation_service_keys SET key_hash = ?, key_prefix = ?, rotated_at = datetime('now')
      WHERE company_id = ?`).run(keyHash, prefix, companyId)
  } else {
    db.prepare(`INSERT INTO automation_service_keys (id, company_id, key_hash, key_prefix)
      VALUES (?, ?, ?, ?)`).run(uuid(), companyId, keyHash, prefix)
  }

  return { key: raw, prefix }
}

export function getServiceKeyMeta(db: Database.Database, companyId: string) {
  const row = db.prepare(
    'SELECT key_prefix as keyPrefix, created_at as createdAt, rotated_at as rotatedAt FROM automation_service_keys WHERE company_id = ?',
  ).get(companyId) as { keyPrefix: string; createdAt: string; rotatedAt: string | null } | undefined
  return row || null
}

export function resolveCompanyFromServiceKey(db: Database.Database, rawKey: string): string | null {
  if (!rawKey.startsWith(KEY_PREFIX)) return null
  const keyHash = hashKey(rawKey)
  const row = db.prepare('SELECT company_id as companyId FROM automation_service_keys WHERE key_hash = ?').get(keyHash) as { companyId: string } | undefined
  return row?.companyId || null
}

export function ensureServiceKey(db: Database.Database, companyId: string): { key: string; prefix: string; created: boolean } {
  const existing = getServiceKeyMeta(db, companyId)
  if (existing) {
    return { key: '', prefix: existing.keyPrefix, created: false }
  }
  const rotated = rotateServiceKey(db, companyId)
  return { ...rotated, created: true }
}
