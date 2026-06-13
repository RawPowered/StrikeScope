-- 2026-06-06: Territory fields, permit fields, co-signer, directory contacts

CREATE TABLE IF NOT EXISTS contact_categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_enabled INTEGER DEFAULT 1,
  is_system INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(company_id, slug)
);

CREATE TABLE IF NOT EXISTS directory_contacts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES contact_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  organization TEXT,
  title TEXT,
  email TEXT,
  phone TEXT,
  state TEXT,
  county TEXT,
  address TEXT,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_directory_contacts_company_category ON directory_contacts(company_id, category_id);
CREATE INDEX IF NOT EXISTS idx_directory_contacts_state ON directory_contacts(company_id, state);
CREATE INDEX IF NOT EXISTS idx_leads_company_state ON leads(company_id, state);
CREATE INDEX IF NOT EXISTS idx_leads_company_state_city ON leads(company_id, state, city);
CREATE INDEX IF NOT EXISTS idx_customers_company_state ON customers(company_id, state);
CREATE INDEX IF NOT EXISTS idx_customers_company_state_city ON customers(company_id, state, city);
CREATE INDEX IF NOT EXISTS idx_projects_company_state ON projects(company_id, state);
CREATE INDEX IF NOT EXISTS idx_projects_company_state_city ON projects(company_id, state, city);
