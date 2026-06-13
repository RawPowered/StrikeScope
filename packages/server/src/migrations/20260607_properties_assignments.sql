-- 2026-06-07: Properties, assignments, duplicates, finance

CREATE TABLE IF NOT EXISTS customer_properties (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  label TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  county TEXT,
  zip TEXT,
  is_primary INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS property_contacts (
  property_id TEXT NOT NULL REFERENCES customer_properties(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  PRIMARY KEY (property_id, contact_id)
);

CREATE TABLE IF NOT EXISTS project_contacts (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'owner',
  PRIMARY KEY (project_id, contact_id)
);

CREATE TABLE IF NOT EXISTS duplicate_override_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  attempted_payload_json TEXT NOT NULL,
  matched_entity_ids_json TEXT,
  override_reason TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_assignments (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('sales_agent','project_manager','sales_manager')),
  assigned_at TEXT DEFAULT (datetime('now')),
  assigned_by TEXT REFERENCES users(id),
  UNIQUE(project_id, user_id, role)
);

CREATE TABLE IF NOT EXISTS finance_field_definitions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('number','currency','calculated')),
  formula_json TEXT,
  visibility TEXT DEFAULT 'finance_admin',
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, field_key)
);

CREATE TABLE IF NOT EXISTS project_cost_lines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  category TEXT,
  amount REAL NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_finance_values (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  field_definition_id TEXT NOT NULL REFERENCES finance_field_definitions(id) ON DELETE CASCADE,
  value TEXT,
  computed_value REAL,
  updated_at TEXT,
  UNIQUE(project_id, field_definition_id)
);

CREATE TABLE IF NOT EXISTS commission_formulas (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  formula_json TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_reports (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  formula_id TEXT REFERENCES commission_formulas(id),
  snapshot_json TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commission_report_lines (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES commission_reports(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  project_id TEXT REFERENCES projects(id),
  payout_amount REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_customer_properties_customer ON customer_properties(customer_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_user ON project_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_project_cost_lines_project ON project_cost_lines(project_id);
