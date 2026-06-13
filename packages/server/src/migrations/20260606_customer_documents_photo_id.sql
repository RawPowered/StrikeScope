-- 2026-06-06: Add photo_id kind to customer_documents
CREATE TABLE IF NOT EXISTS customer_documents_new (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  project_id TEXT REFERENCES projects(id),
  kind TEXT NOT NULL CHECK(kind IN ('agreement','contract','permit','photo','photo_id','other')),
  agreement_id TEXT REFERENCES agreements(id),
  name TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

INSERT OR IGNORE INTO customer_documents_new
  SELECT id, company_id, customer_id, project_id, kind, agreement_id, name, storage_key, mime_type, size_bytes, uploaded_by, created_at, updated_at
  FROM customer_documents;

DROP TABLE IF EXISTS customer_documents;
ALTER TABLE customer_documents_new RENAME TO customer_documents;

CREATE INDEX IF NOT EXISTS idx_customer_documents_customer ON customer_documents(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_documents_agreement ON customer_documents(agreement_id);
