/**
 * Fast read-only DB snapshot — no migrate(), no tsx, no geo warmup.
 * Usage: npm run db:status -w packages/server
 */
import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '..', 'data', 'strikescope.db')

if (!existsSync(dbPath)) {
  console.log(JSON.stringify({ ok: false, error: 'Database file not found', path: dbPath }, null, 2))
  process.exit(1)
}

const t0 = Date.now()
const db = new Database(dbPath, { readonly: true })

const table = (name) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name)
const count = (sql) => (db.prepare(sql).get()).n ?? (db.prepare(sql).get()).c ?? 0

const snapshot = {
  ok: true,
  path: dbPath,
  elapsedMs: 0,
  companies: table('companies') ? db.prepare('SELECT id, name FROM companies').all() : [],
  leads: table('leads') ? count('SELECT COUNT(*) as n FROM leads') : 0,
  leadRows: table('leads') ? db.prepare('SELECT id, name, company_id, state, stage_id FROM leads LIMIT 10').all() : [],
  stages: table('lead_stages') ? count('SELECT COUNT(*) as n FROM lead_stages') : 0,
  geoZips: table('geo_zip_lookup') ? count('SELECT COUNT(*) as n FROM geo_zip_lookup') : 0,
  legacySites: table('sites') ? count('SELECT COUNT(*) as n FROM sites') : 0,
  migrations: table('schema_migrations')
    ? db.prepare('SELECT id FROM schema_migrations ORDER BY id').all().map(r => r.id)
    : [],
}

snapshot.elapsedMs = Date.now() - t0
console.log(JSON.stringify(snapshot, null, 2))
