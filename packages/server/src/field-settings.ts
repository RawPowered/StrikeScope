import type Database from 'better-sqlite3'
import { v4 as uuid } from 'uuid'

export const VALID_FIELD_ENTITIES = ['leads', 'customers', 'contacts', 'agreements', 'projects', 'submissions', 'activities'] as const
export type FieldEntity = typeof VALID_FIELD_ENTITIES[number]

export const LOCKED_FIELD_KEYS: Record<string, string[]> = {
  leads: ['name', 'email'],
  customers: ['name', 'email'],
  contacts: ['firstName', 'email'],
  agreements: ['name'],
  projects: ['name'],
  submissions: ['id'],
  activities: ['action'],
}

export const BUILTIN_FIELDS: Record<string, { key: string; label: string }[]> = {
  leads: [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
    { key: 'source', label: 'Source' }, { key: 'value', label: 'Value' }, { key: 'notes', label: 'Notes' },
    { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' },
    { key: 'county', label: 'County' }, { key: 'zip', label: 'ZIP' },
    { key: 'co_signer_name', label: 'Co-Signer Name' }, { key: 'co_signer_email', label: 'Co-Signer Email' },
    { key: 'co_signer_phone', label: 'Co-Signer Phone' },
  ],
  customers: [
    { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
    { key: 'address', label: 'Address' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' },
    { key: 'county', label: 'County' }, { key: 'zip', label: 'ZIP' }, { key: 'notes', label: 'Notes' },
    { key: 'type', label: 'Type' }, { key: 'source', label: 'Source' },
  ],
  contacts: [
    { key: 'firstName', label: 'First Name' }, { key: 'lastName', label: 'Last Name' },
    { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' }, { key: 'role', label: 'Role' },
    { key: 'notes', label: 'Notes' }, { key: 'ssn_last_four', label: 'SSN Last 4' }, { key: 'date_of_birth', label: 'DOB' },
  ],
  agreements: [
    { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'terms', label: 'Terms' },
  ],
  projects: [
    { key: 'name', label: 'Name' }, { key: 'status', label: 'Status' }, { key: 'address', label: 'Address' },
    { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'county', label: 'County' },
    { key: 'zip', label: 'ZIP' }, { key: 'notes', label: 'Notes' },
    { key: 'financingType', label: 'Financing Type' }, { key: 'bankId', label: 'Bank' },
    { key: 'permitNumber', label: 'Permit Number' }, { key: 'propertyLegalDescription', label: 'Legal Description' },
  ],
  submissions: [
    { key: 'status', label: 'Status' }, { key: 'installerName', label: 'Installer' },
  ],
  activities: [
    { key: 'action', label: 'Action' }, { key: 'description', label: 'Description' },
  ],
}

export function isLockedField(entity: string, fieldKey: string): boolean {
  return LOCKED_FIELD_KEYS[entity]?.includes(fieldKey) ?? false
}

export function getFieldSettings(db: Database.Database, companyId: string, entity: string) {
  const rows = db.prepare(`SELECT field_key as fieldKey, is_enabled as isEnabled, is_required_override as isRequiredOverride
    FROM entity_field_settings WHERE company_id=? AND entity=?`).all(companyId, entity) as any[]
  const map = new Map(rows.map(r => [r.fieldKey, r]))
  const builtins = BUILTIN_FIELDS[entity] || []
  return builtins.map(b => ({
    fieldKey: b.key,
    label: b.label,
    isBuiltin: true,
    isLocked: isLockedField(entity, b.key),
    isEnabled: isLockedField(entity, b.key) ? true : (map.get(b.key)?.isEnabled !== 0),
    isRequiredOverride: map.get(b.key)?.isRequiredOverride ?? null,
  }))
}

export function getEnabledCustomDefinitions(db: Database.Database, companyId: string, entity: string, includeDisabled = false) {
  const sql = includeDisabled
    ? `SELECT id, company_id as companyId, entity, field_name as fieldName, label, field_type as fieldType,
        options_json as optionsJson, is_required as isRequired, carry_over as carryOver, is_enabled as isEnabled,
        sort_order as sortOrder, created_at as createdAt
        FROM custom_field_definitions WHERE company_id=? AND entity=? ORDER BY sort_order ASC, created_at ASC`
    : `SELECT id, company_id as companyId, entity, field_name as fieldName, label, field_type as fieldType,
        options_json as optionsJson, is_required as isRequired, carry_over as carryOver, is_enabled as isEnabled,
        sort_order as sortOrder, created_at as createdAt
        FROM custom_field_definitions WHERE company_id=? AND entity=? AND is_enabled=1 ORDER BY sort_order ASC, created_at ASC`
  return db.prepare(sql).all(companyId, entity)
}

export function upsertFieldSettings(db: Database.Database, companyId: string, entity: string, settings: { fieldKey: string; isEnabled?: boolean; isRequiredOverride?: boolean | null }[]) {
  const upsert = db.prepare(`INSERT INTO entity_field_settings (id, company_id, entity, field_key, is_enabled, is_required_override, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(company_id, entity, field_key) DO UPDATE SET
      is_enabled=excluded.is_enabled, is_required_override=excluded.is_required_override, updated_at=datetime('now')`)
  for (const s of settings) {
    if (isLockedField(entity, s.fieldKey) && s.isEnabled === false) continue
    upsert.run(uuid(), companyId, entity, s.fieldKey, s.isEnabled === false ? 0 : 1, s.isRequiredOverride == null ? null : (s.isRequiredOverride ? 1 : 0))
  }
}

export function isBuiltinFieldEnabled(db: Database.Database, companyId: string, entity: string, fieldKey: string): boolean {
  if (isLockedField(entity, fieldKey)) return true
  const row = db.prepare('SELECT is_enabled FROM entity_field_settings WHERE company_id=? AND entity=? AND field_key=?').get(companyId, entity, fieldKey) as any
  return row ? row.is_enabled !== 0 : true
}

export function validateRequiredCustomValues(db: Database.Database, companyId: string, entity: string, values: { fieldDefinitionId: string; value: string | null }[]) {
  const defs = db.prepare(`SELECT id, label, is_required as isRequired FROM custom_field_definitions
    WHERE company_id=? AND entity=? AND is_enabled=1 AND is_required=1`).all(companyId, entity) as any[]
  const valMap = new Map(values.map(v => [v.fieldDefinitionId, v.value]))
  const missing: string[] = []
  for (const d of defs) {
    const v = valMap.get(d.id)
    if (v == null || String(v).trim() === '') missing.push(d.label)
  }
  return missing.length ? `Required custom fields missing: ${missing.join(', ')}` : null
}

export function copyCarryOverCustomFields(db: Database.Database, fromEntity: string, fromId: string, toEntity: string, toId: string, companyId: string) {
  const rows = db.prepare(`SELECT v.field_definition_id, v.value, d.field_name
    FROM custom_field_values v
    JOIN custom_field_definitions d ON d.id=v.field_definition_id
    WHERE v.entity=? AND v.entity_id=? AND d.company_id=? AND d.carry_over=1 AND d.is_enabled=1`).all(fromEntity, fromId, companyId) as any[]
  if (!rows.length) return
  const insert = db.prepare('INSERT OR REPLACE INTO custom_field_values (id, entity, entity_id, field_definition_id, value) VALUES (?, ?, ?, ?, ?)')
  for (const r of rows) {
    const targetDef = db.prepare(`SELECT id FROM custom_field_definitions WHERE company_id=? AND entity=? AND field_name=? AND is_enabled=1`).get(companyId, toEntity, r.field_name) as any
    if (targetDef) insert.run(uuid(), toEntity, toId, targetDef.id, r.value)
  }
}
