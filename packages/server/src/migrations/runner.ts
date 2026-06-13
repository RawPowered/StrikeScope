import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type Database from 'better-sqlite3'

const __dirname = dirname(fileURLToPath(import.meta.url))

const MIGRATIONS = [
  '20260605_customer_documents.sql',
  '20260606_territory_contacts.sql',
  '20260606_customer_documents_photo_id.sql',
  '20260607_field_governance.sql',
  '20260607_properties_assignments.sql',
  '20260607_forms.sql',
  '20260608_field_sessions_time.sql',
  '20260609_geo_territory.sql',
]

export function runSqlMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT DEFAULT (datetime('now'))
    )
  `)

  const applied = new Set(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: string }[]).map(r => r.id),
  )

  for (const file of MIGRATIONS) {
    if (applied.has(file)) continue
    const path = join(__dirname, file)
    if (!existsSync(path)) continue
    const sql = readFileSync(path, 'utf-8')
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(file)
  }
}
