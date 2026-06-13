-- 2026-06-06: Financing type, company banks, project type financing flag

CREATE TABLE IF NOT EXISTS company_banks (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(company_id, name)
);

CREATE INDEX IF NOT EXISTS idx_company_banks_company ON company_banks(company_id);
CREATE INDEX IF NOT EXISTS idx_projects_bank ON projects(bank_id);
