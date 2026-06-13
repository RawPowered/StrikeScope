import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import Database from 'better-sqlite3'
import { DB_PATH } from '../../paths.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', '..', 'migrations')

const MIGRATIONS = [
  '20260605_customer_documents.sql',
  '20260606_territory_contacts.sql',
  '20260606_customer_documents_photo_id.sql',
  '20260607_field_governance.sql',
  '20260607_properties_assignments.sql',
  '20260608_field_sessions_time.sql',
  '20260609_geo_territory.sql',
]

const WRITE_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|ATTACH|DETACH|PRAGMA\s+(?!table_info|index_list|foreign_key_check|integrity_check))\b/i

export function isReadonlySql(sql: string): boolean {
  const trimmed = sql.trim()
  if (!trimmed) return false
  const statements = trimmed.split(';').map(s => s.trim()).filter(Boolean)
  for (const stmt of statements) {
    if (WRITE_KEYWORDS.test(stmt)) return false
    const upper = stmt.toUpperCase()
    if (!upper.startsWith('SELECT') && !upper.startsWith('EXPLAIN') && !upper.startsWith('PRAGMA')) {
      return false
    }
  }
  return true
}

function readonlyDb(): Database.Database {
  return new Database(DB_PATH, { readonly: true, fileMustExist: true })
}

export function runReadonlyQuery(sql: string): { columns: string[]; rows: Record<string, unknown>[] } {
  if (!isReadonlySql(sql)) throw new Error('Only SELECT, EXPLAIN, and safe PRAGMA queries allowed')
  const db = readonlyDb()
  try {
    const stmt = db.prepare(sql)
    const rows = stmt.all() as Record<string, unknown>[]
    const columns = rows.length ? Object.keys(rows[0]) : (stmt.columns().map(c => c.name))
    return { columns, rows: rows.slice(0, 500) }
  } finally {
    db.close()
  }
}

export function getSchemaOverview(): {
  tables: { name: string; sql: string }[]
  migrations: { id: string; applied_at: string }[]
  drift: string[]
} {
  const db = readonlyDb()
  try {
    const tables = db.prepare(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).all() as { name: string; sql: string }[]

    const migrations = db.prepare('SELECT id, applied_at FROM schema_migrations ORDER BY applied_at').all() as {
      id: string
      applied_at: string
    }[]

    const applied = new Set(migrations.map(m => m.id))
    const drift = MIGRATIONS.filter(f => !applied.has(f))

    return { tables, migrations, drift }
  } finally {
    db.close()
  }
}

export function getTableInfo(table: string): { columns: { name: string; type: string; notnull: number; pk: number }[] } {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(table)) throw new Error('Invalid table name')
  const db = readonlyDb()
  try {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all() as {
      name: string; type: string; notnull: number; pk: number
    }[]
    return { columns }
  } finally {
    db.close()
  }
}

export function proposeMigrationFilename(description: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const slug = description.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40)
  return `${date}_${slug || 'migration'}.sql`
}

export function writeMigrationFile(filename: string, sql: string): string {
  if (!/^\d{8}_[a-z0-9_]+\.sql$/.test(filename)) {
    throw new Error('Migration filename must be YYYYMMDD_description.sql')
  }
  const path = join(MIGRATIONS_DIR, filename)
  if (existsSync(path)) throw new Error('Migration file already exists')
  writeFileSync(path, sql, 'utf-8')
  return filename
}

export function registerMigrationInRunner(filename: string): void {
  const runnerPath = join(MIGRATIONS_DIR, 'runner.ts')
  const content = readFileSync(runnerPath, 'utf-8')
  if (content.includes(`'${filename}'`)) return
  const insertBefore = '\n]\n\nexport function runSqlMigrations'
  const idx = content.indexOf(insertBefore)
  if (idx === -1) throw new Error('Could not find MIGRATIONS array in runner.ts')
  const updated = content.slice(0, idx) + `,\n  '${filename}'` + content.slice(idx)
  writeFileSync(runnerPath, updated, 'utf-8')
}

export function applyMigrationFile(filename: string): void {
  const path = join(MIGRATIONS_DIR, filename)
  if (!existsSync(path)) throw new Error('Migration file not found')
  const sql = readFileSync(path, 'utf-8')
  const db = new Database(DB_PATH)
  try {
    const applied = db.prepare('SELECT id FROM schema_migrations WHERE id=?').get(filename)
    if (applied) return
    db.exec(sql)
    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(filename)
  } finally {
    db.close()
  }
}

export function getMigrationsList(): string[] {
  return [...MIGRATIONS]
}
