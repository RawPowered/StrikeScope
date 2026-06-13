-- 2026-06-10: Activepieces automation bridge tables

CREATE TABLE IF NOT EXISTS automation_projects (
  id TEXT PRIMARY KEY,
  company_id TEXT REFERENCES companies(id) ON DELETE CASCADE,
  external_project_id TEXT NOT NULL UNIQUE,
  activepieces_project_id TEXT,
  is_platform INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_projects_company
  ON automation_projects(company_id) WHERE company_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS automation_service_keys (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  rotated_at TEXT
);

CREATE TABLE IF NOT EXISTS automation_webhook_subscriptions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  flow_id TEXT,
  label TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_webhooks_company_trigger_url
  ON automation_webhook_subscriptions(company_id, trigger_type, webhook_url);

CREATE INDEX IF NOT EXISTS idx_automation_webhooks_company_trigger
  ON automation_webhook_subscriptions(company_id, trigger_type) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS automation_event_log (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  action TEXT,
  webhook_url TEXT,
  status TEXT NOT NULL,
  response_code INTEGER,
  error_message TEXT,
  payload_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_automation_event_log_company_created
  ON automation_event_log(company_id, created_at);
