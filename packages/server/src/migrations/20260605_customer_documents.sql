-- 2026-06-05: Customer document vault + agreement file links
CREATE TABLE IF NOT EXISTS customer_documents (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  project_id TEXT REFERENCES projects(id),
  kind TEXT NOT NULL CHECK(kind IN ('agreement','contract','permit','photo','other')),
  agreement_id TEXT REFERENCES agreements(id),
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_agreement ON customer_documents(agreement_id);
