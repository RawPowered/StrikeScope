-- 2026-06-07: Field governance

CREATE TABLE IF NOT EXISTS entity_field_settings (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  field_key TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  is_required_override INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(company_id, entity, field_key)
);

CREATE INDEX IF NOT EXISTS idx_entity_field_settings_company_entity ON entity_field_settings(company_id, entity);
