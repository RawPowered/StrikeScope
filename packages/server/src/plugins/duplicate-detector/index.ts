import { compareTwoStrings } from 'string-similarity'
import { parsePhoneNumberFromString } from 'libphonenumber-js'
import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'

export interface DuplicateCandidate {
  entityType: string
  entityId: string
  score: number
  matchedFields: string[]
  record: Record<string, unknown>
}

const DEFAULT_THRESHOLD = 0.72

function norm(s: string | null | undefined): string {
  return (s || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

function normPhone(s: string | null | undefined): string {
  if (!s) return ''
  const p = parsePhoneNumberFromString(s, 'US')
  return p?.number || s.replace(/\D/g, '')
}

function normEmail(s: string | null | undefined): string {
  return norm(s)
}

function fieldScore(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  return compareTwoStrings(a, b)
}

function scoreRecord(payload: Record<string, any>, candidate: Record<string, any>, fields: { key: string; weight: number; norm?: (v: string) => string }[]): { score: number; matched: string[] } {
  let totalW = 0
  let weighted = 0
  const matched: string[] = []
  for (const f of fields) {
    const pv = f.norm ? f.norm(String(payload[f.key] || '')) : norm(String(payload[f.key] || ''))
    const cv = f.norm ? f.norm(String(candidate[f.key] || candidate[f.key.replace(/([A-Z])/g, '_$1').toLowerCase()] || '')) : norm(String(candidate[f.key] || ''))
    if (!pv && !cv) continue
    totalW += f.weight
    const s = fieldScore(pv, cv)
    if (s >= 0.85) matched.push(f.key)
    weighted += s * f.weight
  }
  return { score: totalW ? weighted / totalW : 0, matched }
}

const ENTITY_FIELDS: Record<string, { key: string; weight: number; norm?: (v: string) => string }[]> = {
  customers: [
    { key: 'name', weight: 0.35 }, { key: 'email', weight: 0.25, norm: normEmail },
    { key: 'phone', weight: 0.2, norm: normPhone }, { key: 'address', weight: 0.2 },
  ],
  contacts: [
    { key: 'firstName', weight: 0.25 }, { key: 'lastName', weight: 0.15 },
    { key: 'email', weight: 0.3, norm: normEmail }, { key: 'phone', weight: 0.3, norm: normPhone },
  ],
  leads: [
    { key: 'name', weight: 0.35 }, { key: 'email', weight: 0.25, norm: normEmail },
    { key: 'phone', weight: 0.2, norm: normPhone }, { key: 'address', weight: 0.2 },
  ],
}

export function findDuplicates(db: Database.Database, companyId: string, entityType: string, payload: Record<string, any>, threshold = DEFAULT_THRESHOLD): DuplicateCandidate[] {
  const fields = ENTITY_FIELDS[entityType]
  if (!fields) return []

  let rows: any[] = []
  if (entityType === 'customers') {
    rows = db.prepare(`SELECT id, name, email, phone, address, city, state FROM customers WHERE company_id=? AND deleted_at IS NULL`).all(companyId)
  } else if (entityType === 'contacts') {
    rows = db.prepare(`SELECT id, first_name as firstName, last_name as lastName, email, phone FROM contacts WHERE company_id=? AND is_active=1`).all(companyId)
  } else if (entityType === 'leads') {
    rows = db.prepare(`SELECT id, name, email, phone, address FROM leads WHERE company_id=? AND is_active=1 AND converted_account_id IS NULL`).all(companyId)
  }

  const results: DuplicateCandidate[] = []
  for (const row of rows) {
    const { score, matched } = scoreRecord(payload, row, fields)
    if (score >= threshold) {
      results.push({ entityType, entityId: row.id, score: Math.round(score * 100) / 100, matchedFields: matched, record: row })
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 10)
}

export function logDuplicateOverride(db: Database.Database, companyId: string, entityType: string, payload: unknown, matches: DuplicateCandidate[], overrideReason: string, userId: string | undefined) {
  db.prepare(`INSERT INTO duplicate_override_log (id, company_id, entity_type, attempted_payload_json, matched_entity_ids_json, override_reason, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    uuid(), companyId, entityType, JSON.stringify(payload),
    JSON.stringify(matches.map(m => ({ id: m.entityId, score: m.score }))),
    overrideReason, userId || null,
  )
}
