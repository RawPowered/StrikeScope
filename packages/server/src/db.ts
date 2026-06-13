import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync, renameSync } from 'fs'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import logger from './logger.js'
import { runSqlMigrations } from './migrations/runner.js'
import { seedContactCategories } from './territory.js'
import { seedGeoReference } from './plugins/geo-reference/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
import { SERVER_DATA_DIR, DB_PATH as CONFIGURED_DB_PATH } from './paths.js'
import { DB_FILENAME, DEV_ADMIN_EMAIL, PLATFORM_NAME } from '@strikescope/shared/src/brand.js'

const DATA_DIR = SERVER_DATA_DIR

if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })

function ensureDbFile(): string {
  const newPath = join(DATA_DIR, DB_FILENAME)
  const oldPath = join(DATA_DIR, 'strikescope.db')
  if (existsSync(oldPath) && !existsSync(newPath)) {
    for (const suffix of ['', '-wal', '-shm']) {
      const from = oldPath + suffix
      const to = newPath + suffix
      if (existsSync(from)) renameSync(from, to)
    }
  }
  return CONFIGURED_DB_PATH
}

const DB_PATH = ensureDbFile()
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

const DEFAULT_BRANDING = JSON.stringify({
  primary: '#F57C00', secondary: '#4FC3F7', accent: '#FFD54F',
  grey: '#9E9E9E', gunmetal: '#2C3439', white: '#FFFFFF', appName: PLATFORM_NAME,
})

export function migrate() {
  const bootstrapped = !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='companies'").get()
  if (!bootstrapped) console.log('[migrate] First-time schema bootstrap...')
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT,
      phone TEXT, email TEXT, branding_json TEXT,
      is_active INTEGER DEFAULT 1, deleted_at TEXT,
      mfa_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id),
      email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      password_hash TEXT NOT NULL,
      role_id TEXT REFERENCES roles(id),
      is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS user_company_memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'user',
      role_id TEXT REFERENCES roles(id),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(user_id, company_id)
    );

    CREATE TABLE IF NOT EXISTS project_types (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE,
      description TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS company_project_types (
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      project_type_id TEXT NOT NULL REFERENCES project_types(id) ON DELETE CASCADE,
      is_enabled INTEGER DEFAULT 1,
      PRIMARY KEY (company_id, project_type_id)
    );

    CREATE TABLE IF NOT EXISTS task_templates (
      id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id),
      project_type_id TEXT REFERENCES project_types(id),
      name TEXT NOT NULL, description TEXT,
      is_global INTEGER DEFAULT 0, is_default INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0, source_template_id TEXT,
      is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS template_items (
      id TEXT PRIMARY KEY, template_id TEXT NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
      label TEXT NOT NULL, sort_order INTEGER NOT NULL,
      title_en TEXT NOT NULL, title_es TEXT NOT NULL DEFAULT '',
      desc_en TEXT NOT NULL DEFAULT '', desc_es TEXT NOT NULL DEFAULT '',
      required_count INTEGER DEFAULT 1, example_image TEXT
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL, email TEXT, phone TEXT, address TEXT, notes TEXT,
      source TEXT DEFAULT 'manual', source_lead_id TEXT REFERENCES leads(id),
      type TEXT DEFAULT 'residential',
      is_active INTEGER DEFAULT 1, deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      project_type_id TEXT REFERENCES project_types(id),
      name TEXT NOT NULL, address TEXT,
      status TEXT NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','active','completed','cancelled')),
      assigned_to TEXT REFERENCES users(id), notes TEXT,
      is_active INTEGER DEFAULT 1, deleted_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS project_task_items (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      template_item_id TEXT REFERENCES template_items(id),
      label TEXT NOT NULL, sort_order INTEGER NOT NULL,
      title_en TEXT NOT NULL, title_es TEXT NOT NULL DEFAULT '',
      desc_en TEXT NOT NULL DEFAULT '', desc_es TEXT NOT NULL DEFAULT '',
      required_count INTEGER DEFAULT 1, example_image TEXT
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      project_task_item_id TEXT REFERENCES project_task_items(id),
      installer_id TEXT REFERENCES users(id),
      installer_name TEXT, gps_lat REAL, gps_lng REAL,
      captured_at TEXT, submitted_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS submission_images (
      id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      project_task_item_id TEXT REFERENCES project_task_items(id),
      filename TEXT NOT NULL, filepath TEXT NOT NULL,
      gps_lat REAL, gps_lng REAL, captured_at TEXT
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      type TEXT NOT NULL, label TEXT, config_json TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS deleted_companies (
      id TEXT PRIMARY KEY, original_id TEXT NOT NULL,
      name TEXT NOT NULL, data_json TEXT NOT NULL,
      deleted_at TEXT DEFAULT (datetime('now')),
      restore_by TEXT NOT NULL, restored_at TEXT,
      permanently_deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS lead_stages (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL, sort_order INTEGER NOT NULL,
      color TEXT DEFAULT '#888', is_default INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      name TEXT NOT NULL, email TEXT, phone TEXT, source TEXT,
      stage_id TEXT REFERENCES lead_stages(id),
      assigned_to TEXT, notes TEXT, value REAL,
      co_signer_name TEXT, co_signer_email TEXT, co_signer_phone TEXT,
      converted_account_id TEXT REFERENCES customers(id),
      converted_project_id TEXT REFERENCES projects(id),
      converted_at TEXT, is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      first_name TEXT NOT NULL, last_name TEXT,
      email TEXT, phone TEXT, role TEXT,
      ssn_last_four TEXT, date_of_birth TEXT,
      is_primary INTEGER DEFAULT 0, notes TEXT,
      is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
      action TEXT NOT NULL, description TEXT,
      user_id TEXT, user_name TEXT, metadata_json TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS company_domains (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      domain TEXT NOT NULL UNIQUE, is_primary INTEGER DEFAULT 0,
      is_sandbox INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      name TEXT NOT NULL, description TEXT,
      is_system INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY, role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      can_view INTEGER DEFAULT 0, can_create INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0, can_delete INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS role_field_permissions (
      id TEXT PRIMARY KEY,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      entity TEXT NOT NULL,
      field TEXT NOT NULL,
      can_view INTEGER DEFAULT 0,
      can_edit INTEGER DEFAULT 0,
      updated_at TEXT,
      UNIQUE(role_id, entity, field)
    );

    CREATE TABLE IF NOT EXISTS agreements (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id),
      customer_id TEXT NOT NULL REFERENCES customers(id),
      project_id TEXT REFERENCES projects(id),
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','signed','cancelled')),
      terms TEXT, document_url TEXT, signed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS company_email_config (
      company_id TEXT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
      smtp_host TEXT, smtp_port INTEGER DEFAULT 587,
      smtp_user TEXT, smtp_pass TEXT,
      from_email TEXT, from_name TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS customer_setup_tokens (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
      token TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL,
      consumed_at TEXT, created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS enabled_roles (
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
      is_enabled INTEGER DEFAULT 1,
      updated_at TEXT,
      PRIMARY KEY (company_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS custom_field_definitions (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      entity TEXT NOT NULL CHECK(entity IN ('leads','customers','contacts','agreements','projects','submissions','activities','forms')),
      field_name TEXT NOT NULL, label TEXT NOT NULL,
      field_type TEXT NOT NULL CHECK(field_type IN ('text','textarea','number','currency','phone','email','url','boolean','date','select','multiselect')),
      options_json TEXT, is_required INTEGER DEFAULT 0,
      carry_over INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(company_id, entity, field_name)
    );

    CREATE TABLE IF NOT EXISTS custom_field_values (
      id TEXT PRIMARY KEY, entity TEXT NOT NULL,
      entity_id TEXT NOT NULL, field_definition_id TEXT NOT NULL REFERENCES custom_field_definitions(id) ON DELETE CASCADE,
      value TEXT,
      updated_at TEXT,
      UNIQUE(entity, entity_id, field_definition_id)
    );

    CREATE TABLE IF NOT EXISTS user_column_preferences (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      entity TEXT NOT NULL, columns_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT,
      PRIMARY KEY (user_id, entity)
    );
  `)

  // ── MIGRATE from old schema ──
  const hasOldSites = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sites'").get()
  if (hasOldSites) {
    const siteCount = (db.prepare('SELECT COUNT(*) as c FROM sites').get() as any).c
    if (siteCount > 0) {
      // Migrate sites → companies
      const oldSites = db.prepare('SELECT * FROM sites').all() as any[]
      for (const s of oldSites) {
        const existing = db.prepare('SELECT id FROM companies WHERE id = ?').get(s.id)
        if (!existing) {
          db.prepare('INSERT INTO companies (id, name, address, branding_json, created_at) VALUES (?, ?, ?, ?, ?)').run(
            s.id, s.name, s.address || null, s.branding_json || DEFAULT_BRANDING, s.created_at
          )
        }
      }

      // Migrate guide_items → default template + items
      const hasGuide = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guide_items'").get()
      if (hasGuide) {
        const guideCount = (db.prepare('SELECT COUNT(*) as c FROM guide_items').get() as any).c
        if (guideCount > 0 && !db.prepare('SELECT id FROM task_templates WHERE name = ?').get('Legacy Guide Items')) {
          const tid = uuid()
          db.prepare('INSERT INTO task_templates (id, company_id, name, is_global, is_default) VALUES (?, ?, ?, ?, ?)').run(
            tid, 'default', 'Legacy Guide Items', 1, 0
          )
          const items = db.prepare('SELECT * FROM guide_items ORDER BY sort_order ASC').all() as any[]
          const insert = db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          for (const item of items) {
            insert.run(uuid(), tid, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
          }
          // Insert as project_task_items too so legacy guide items show up
          const legacyProject = db.prepare('SELECT id FROM projects WHERE name = ?').get('Legacy Project')
          if (legacyProject) {
            const insertPti = db.prepare('INSERT INTO project_task_items (id, project_id, template_item_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
            for (const item of items) {
              insertPti.run(uuid(), (legacyProject as any).id, null, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
            }
          }
        }
      }

      // Create legacy project for existing submissions
      const hasSubs = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'").get()
      if (hasSubs) {
        const subCount = (db.prepare('SELECT COUNT(*) as c FROM submissions').get() as any).c
        if (subCount > 0 && !db.prepare('SELECT id FROM projects WHERE name = ?').get('Legacy Project')) {
          const defaultCustomer = uuid()
          db.prepare('INSERT INTO customers (id, company_id, name) VALUES (?, ?, ?)').run(defaultCustomer, 'default', 'Legacy Customer')
          const legacyProject = uuid()
          db.prepare('INSERT INTO projects (id, company_id, customer_id, name, status) VALUES (?, ?, ?, ?, ?)').run(
            legacyProject, 'default', defaultCustomer, 'Legacy Project', 'completed'
          )
          // Update old submissions to link to legacy project
          const oldSubs = db.prepare('SELECT * FROM submissions').all() as any[]
          // submissions need project_id and optionally project_task_item_id
          // The old submissions table doesn't have project_id column
          // We need to add it - but let's check if the column exists
          const hasProjectId = db.prepare("PRAGMA table_info('submissions')").all().find((c: any) => c.name === 'project_id')
          // Actually, the new submissions table was just created above with project_id.
          // But the old submissions table with the same name might conflict.
          // Actually, CREATE TABLE IF NOT EXISTS won't re-create it if it exists.
          // The old table already exists with different columns!
          // This is a problem - the old submissions table has site_id, not project_id.
          // Let me handle this by detecting the old structure.
        }
      }

      logger.info('Migrated old schema to new CRM schema')
    }
    db.exec('DROP TABLE IF EXISTS sites')
  }

  // Handle old submissions table structure specifically - add project_id if needed
  const subColumns = db.prepare("PRAGMA table_info('submissions')").all() as any[]
  const hasProjectIdCol = subColumns.some(c => c.name === 'project_id')
  if (!hasProjectIdCol && subColumns.some(c => c.name === 'site_id')) {
    // Old submissions table exists. Create a new table and migrate.
    db.exec(`
      ALTER TABLE submissions RENAME TO submissions_old;
      CREATE TABLE submissions (
        id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
        project_task_item_id TEXT REFERENCES project_task_items(id),
        installer_id TEXT REFERENCES users(id),
        installer_name TEXT, gps_lat REAL, gps_lng REAL,
        captured_at TEXT, submitted_at TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'))
      );
    `)
    // Create legacy project + customer
    if (!db.prepare('SELECT id FROM customers WHERE name = ?').get('Legacy Customer')) {
      const cid = uuid()
      db.prepare('INSERT INTO customers (id, company_id, name) VALUES (?, ?, ?)').run(cid, 'default', 'Legacy Customer')
      const pid = uuid()
      db.prepare('INSERT INTO projects (id, company_id, customer_id, name, status) VALUES (?, ?, ?, ?, ?)').run(pid, 'default', cid, 'Legacy Project', 'completed')
      // Migrate old submissions
      const oldSubs = db.prepare('SELECT * FROM submissions_old').all() as any[]
      const insertSub = db.prepare('INSERT INTO submissions (id, project_id, installer_name, gps_lat, gps_lng, captured_at, submitted_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      for (const s of oldSubs) {
        insertSub.run(s.id, pid, s.installer_name, s.gps_lat, s.gps_lng, s.captured_at, s.submitted_at, s.status)
      }
    }
    // Handle old submission_images
    const imgCols = db.prepare("PRAGMA table_info('submission_images')").all() as any[]
    if (imgCols.some(c => c.name === 'guide_item_id')) {
      db.exec(`ALTER TABLE submission_images RENAME TO submission_images_old`)
      db.exec(`
        CREATE TABLE submission_images (
          id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
          project_task_item_id TEXT REFERENCES project_task_items(id),
          filename TEXT NOT NULL, filepath TEXT NOT NULL,
          gps_lat REAL, gps_lng REAL, captured_at TEXT
        )
      `)
      const oldImgs = db.prepare('SELECT * FROM submission_images_old').all() as any[]
      const insertImg = db.prepare('INSERT INTO submission_images (id, submission_id, project_task_item_id, filename, filepath, gps_lat, gps_lng, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      for (const img of oldImgs) {
        insertImg.run(img.id, img.submission_id, null, img.filename, img.filepath, img.gps_lat, img.gps_lng, img.captured_at)
      }
    }
    // Handle old connections
    const connCols = db.prepare("PRAGMA table_info('connections')").all() as any[]
    if (connCols.some(c => c.name === 'site_id')) {
      db.exec(`ALTER TABLE connections RENAME TO connections_old`)
      db.exec(`
        CREATE TABLE connections (
          id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          type TEXT NOT NULL, label TEXT, config_json TEXT NOT NULL,
          is_active INTEGER DEFAULT 1
        )
      `)
      const oldConns = db.prepare('SELECT * FROM connections_old').all() as any[]
      const insertConn = db.prepare('INSERT INTO connections (id, company_id, type, label, config_json, is_active) VALUES (?, ?, ?, ?, ?, ?)')
      for (const c of oldConns) {
        insertConn.run(c.id, c.site_id === 'default' ? 'default' : c.site_id, c.type, c.label, c.config_json, c.is_active)
      }
    }
  }

  // ── MIGRATE users table: remove CHECK constraint, add role_id ──
  const userCols = db.prepare("PRAGMA table_info('users')").all() as any[]
  const hasRoleId = userCols.some(c => c.name === 'role_id')
  if (!hasRoleId) {
    db.exec(`
      ALTER TABLE users RENAME TO users_old;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, company_id TEXT REFERENCES companies(id),
        email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        password_hash TEXT NOT NULL,
        role_id TEXT REFERENCES roles(id),
        is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
      );
    `)
    const oldUsers = db.prepare('SELECT * FROM users_old').all() as any[]
    const insert = db.prepare('INSERT INTO users (id, company_id, email, name, role, password_hash, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    for (const u of oldUsers) {
      insert.run(u.id, u.company_id, u.email, u.name, u.role, u.password_hash, u.is_active, u.created_at)
    }
  }

  // ── Import sensitive fields config (inline to avoid circular deps) ──
  const SENSITIVE_FIELD_PAIRS: { entity: string; field: string }[] = [
    { entity: 'leads', field: 'co_signer_name' },
    { entity: 'leads', field: 'co_signer_email' },
    { entity: 'leads', field: 'co_signer_phone' },
    { entity: 'contacts', field: 'ssn_last_four' },
    { entity: 'contacts', field: 'date_of_birth' },
  ]

  // ── MIGRATE: add columns for field-level permissions + co-signer + PII ──
  const leadCols = db.prepare("PRAGMA table_info('leads')").all() as any[]
  if (!leadCols.some((c: any) => c.name === 'co_signer_name')) {
    db.exec(`ALTER TABLE leads ADD COLUMN co_signer_name TEXT;
      ALTER TABLE leads ADD COLUMN co_signer_email TEXT;
      ALTER TABLE leads ADD COLUMN co_signer_phone TEXT;`)
  }
  const custCols = db.prepare("PRAGMA table_info('customers')").all() as any[]
  if (!custCols.some((c: any) => c.name === 'source')) {
    db.exec(`ALTER TABLE customers ADD COLUMN source TEXT DEFAULT 'manual';
      ALTER TABLE customers ADD COLUMN source_lead_id TEXT REFERENCES leads(id);
      ALTER TABLE customers ADD COLUMN type TEXT DEFAULT 'residential';`)
  }
  const contactCols = db.prepare("PRAGMA table_info('contacts')").all() as any[]
  if (!contactCols.some((c: any) => c.name === 'ssn_last_four')) {
    db.exec(`ALTER TABLE contacts ADD COLUMN ssn_last_four TEXT;
      ALTER TABLE contacts ADD COLUMN date_of_birth TEXT;`)
  }

  // ── MIGRATE: add project_type_id + DNC columns to leads ──
  if (!leadCols.some((c: any) => c.name === 'project_type_id')) {
    db.exec(`ALTER TABLE leads ADD COLUMN project_type_id TEXT REFERENCES project_types(id);
      ALTER TABLE leads ADD COLUMN dnc_at TEXT;
      ALTER TABLE leads ADD COLUMN dnc_reason TEXT;`)
  }

  // ── MIGRATE: add access_key to projects, mfa_enabled to companies, totp to users ──
  const userColCheck = db.prepare("PRAGMA table_info('users')").all() as any[]
  if (!userColCheck.some((c: any) => c.name === 'totp_secret')) {
    db.exec(`ALTER TABLE users ADD COLUMN totp_secret TEXT;
      ALTER TABLE users ADD COLUMN totp_verified INTEGER DEFAULT 0;`)
  }
  
  const projCols = db.prepare("PRAGMA table_info('projects')").all() as any[]
  if (!projCols.some((c: any) => c.name === 'access_key')) {
    db.exec('ALTER TABLE projects ADD COLUMN access_key TEXT;')
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_access_key ON projects(access_key);')
  const compCols = db.prepare("PRAGMA table_info('companies')").all() as any[]
  if (!compCols.some((c: any) => c.name === 'mfa_enabled')) {
    db.exec(`ALTER TABLE companies ADD COLUMN mfa_enabled INTEGER DEFAULT 0;`)
  }
  if (!compCols.some((c: any) => c.name === 'is_sandbox')) {
    db.exec(`ALTER TABLE companies ADD COLUMN is_sandbox INTEGER DEFAULT 0;`)
  }
  const membershipNow = new Date().toISOString().replace('T', ' ').replace('Z', '')

  // ── MIGRATE: move company role assignment into memberships ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_company_memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'user',
      role_id TEXT REFERENCES roles(id),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT,
      UNIQUE(user_id, company_id)
    );
    CREATE INDEX IF NOT EXISTS idx_user_company_memberships_user ON user_company_memberships(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_company_memberships_company ON user_company_memberships(company_id);
  `)
  const usersWithCompany = db.prepare(`
    SELECT id, company_id, role, role_id, created_at, updated_at
    FROM users
    WHERE company_id IS NOT NULL
  `).all() as any[]
  const membershipInsert = db.prepare(`
    INSERT OR IGNORE INTO user_company_memberships
      (id, user_id, company_id, role, role_id, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `)
  for (const u of usersWithCompany) {
    membershipInsert.run(uuid(), u.id, u.company_id, u.role || 'user', u.role_id || null, u.created_at || membershipNow, u.updated_at || membershipNow)
  }

  // Generate access keys for existing projects that don't have one
  const projectsMissingKey = db.prepare('SELECT id FROM projects WHERE access_key IS NULL').all() as any[]
  if (projectsMissingKey.length > 0) {
    const usedKeys = new Set(db.prepare('SELECT access_key FROM projects WHERE access_key IS NOT NULL').all().map((r: any) => r.access_key))
    const generateKey = (): string => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
      let key: string
      do {
        key = ''
        for (let i = 0; i < 6; i++) key += chars[Math.floor(Math.random() * chars.length)]
      } while (usedKeys.has(key))
      usedKeys.add(key)
      return key
    }
    const update = db.prepare('UPDATE projects SET access_key = ? WHERE id = ?')
    for (const p of projectsMissingKey) {
      update.run(generateKey(), p.id)
    }
  }

  // ── MIGRATE: add updated_at columns to existing tables ──
  const tablesWithUpdatedAt = [
    'companies', 'users', 'project_types', 'task_templates',
    'customers', 'projects', 'submissions', 'connections',
    'lead_stages', 'leads', 'contacts',
    'agreements', 'company_email_config', 'customer_setup_tokens',
    'enabled_roles', 'custom_field_definitions', 'custom_field_values',
    'user_column_preferences', 'company_domains', 'roles',
    'role_permissions', 'role_field_permissions'
  ]
  const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
  for (const table of tablesWithUpdatedAt) {
    const cols = db.prepare(`PRAGMA table_info('${table}')`).all() as any[]
    if (!cols.some((c: any) => c.name === 'updated_at')) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT;`)
      // Backfill existing rows
      db.prepare(`UPDATE ${table} SET updated_at = ?`).run(now)
    }
  }

  // ── Create triggers to auto-update updated_at on UPDATE (SKIPPED FOR NOW) ──
  // const tablesWithIdPk = [...]
  // for (const table of tablesWithIdPk) { ... }

  // ── MIGRATE: territory, permit, co-signer, project type classification ──
  const addCol = (table: string, col: string, ddl: string) => {
    const cols = db.prepare(`PRAGMA table_info('${table}')`).all() as any[]
    if (!cols.some((c: any) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`)
  }
  addCol('leads', 'address', 'address TEXT')
  addCol('leads', 'city', 'city TEXT')
  addCol('leads', 'state', 'state TEXT')
  addCol('leads', 'county', 'county TEXT')
  addCol('leads', 'zip', 'zip TEXT')
  addCol('customers', 'city', 'city TEXT')
  addCol('customers', 'state', 'state TEXT')
  addCol('customers', 'county', 'county TEXT')
  addCol('customers', 'zip', 'zip TEXT')
  addCol('customers', 'co_signer_contact_id', 'co_signer_contact_id TEXT REFERENCES contacts(id)')
  addCol('projects', 'city', 'city TEXT')
  addCol('projects', 'state', 'state TEXT')
  addCol('projects', 'county', 'county TEXT')
  addCol('projects', 'zip', 'zip TEXT')
  addCol('projects', 'county_department', 'county_department TEXT')
  addCol('projects', 'permit_number', 'permit_number TEXT')
  addCol('projects', 'property_legal_description', 'property_legal_description TEXT')
  addCol('projects', 'co_signer_contact_id', 'co_signer_contact_id TEXT REFERENCES contacts(id)')
  addCol('companies', 'territory_json', 'territory_json TEXT')
  addCol('project_types', 'category', "category TEXT DEFAULT 'other'")
  addCol('project_types', 'is_construction', 'is_construction INTEGER DEFAULT 0')
  addCol('project_types', 'include_county_defaults', 'include_county_defaults INTEGER DEFAULT 0')
  addCol('project_types', 'requires_permit', 'requires_permit INTEGER DEFAULT 0')
  addCol('project_types', 'include_financing_fields', 'include_financing_fields INTEGER DEFAULT 0')
  db.exec(`CREATE TABLE IF NOT EXISTS company_banks (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    UNIQUE(company_id, name)
  )`)
  addCol('projects', 'financing_type', "financing_type TEXT CHECK(financing_type IS NULL OR financing_type IN ('cash','loan','lease','co_op','other'))")
  addCol('projects', 'bank_id', 'bank_id TEXT REFERENCES company_banks(id)')
  addCol('custom_field_definitions', 'is_enabled', 'is_enabled INTEGER DEFAULT 1')
  addCol('projects', 'property_id', 'property_id TEXT REFERENCES customer_properties(id)')
  db.exec(`CREATE TABLE IF NOT EXISTS customer_properties (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    label TEXT, address TEXT, city TEXT, state TEXT, county TEXT, zip TEXT,
    is_primary INTEGER DEFAULT 0, is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')), updated_at TEXT
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS property_contacts (
    property_id TEXT NOT NULL REFERENCES customer_properties(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner', PRIMARY KEY (property_id, contact_id)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS project_contacts (
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    contact_id TEXT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'owner', PRIMARY KEY (project_id, contact_id)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS duplicate_override_log (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, attempted_payload_json TEXT NOT NULL,
    matched_entity_ids_json TEXT, override_reason TEXT NOT NULL,
    user_id TEXT REFERENCES users(id), created_at TEXT DEFAULT (datetime('now'))
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS project_assignments (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('sales_agent','project_manager','sales_manager')),
    assigned_at TEXT DEFAULT (datetime('now')), assigned_by TEXT REFERENCES users(id),
    UNIQUE(project_id, user_id, role)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS finance_field_definitions (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    field_key TEXT NOT NULL, label TEXT NOT NULL,
    field_type TEXT NOT NULL CHECK(field_type IN ('number','currency','calculated')),
    formula_json TEXT, visibility TEXT DEFAULT 'finance_admin', sort_order INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(company_id, field_key)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS project_cost_lines (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL, category TEXT, amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER DEFAULT 0, created_by TEXT REFERENCES users(id),
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS project_finance_values (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    field_definition_id TEXT NOT NULL REFERENCES finance_field_definitions(id) ON DELETE CASCADE,
    value TEXT, computed_value REAL, updated_at TEXT,
    UNIQUE(project_id, field_definition_id)
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS commission_formulas (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, formula_json TEXT NOT NULL, is_default INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS commission_reports (
    id TEXT PRIMARY KEY, company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL, period_start TEXT, period_end TEXT,
    formula_id TEXT REFERENCES commission_formulas(id), snapshot_json TEXT,
    created_by TEXT REFERENCES users(id), created_at TEXT DEFAULT (datetime('now'))
  )`)
  db.exec(`CREATE TABLE IF NOT EXISTS commission_report_lines (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES commission_reports(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id), project_id TEXT REFERENCES projects(id),
    payout_amount REAL NOT NULL DEFAULT 0, breakdown_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  )`)
  // Backfill role permissions for CRM expansion
  db.exec(`UPDATE role_permissions SET can_view=1 WHERE entity='projects' AND role_id IN (SELECT id FROM roles WHERE name IN ('Sales Agent','Sales Manager'))`)
  db.exec(`UPDATE role_permissions SET can_view=1, can_edit=1, can_create=1 WHERE entity='settings' AND role_id IN (SELECT id FROM roles WHERE name='Sales Manager')`)

  // Backfill primary property per customer
  const customersNoProp = db.prepare(`SELECT c.id, c.company_id, c.address, c.city, c.state, c.county, c.zip
    FROM customers c WHERE NOT EXISTS (SELECT 1 FROM customer_properties p WHERE p.customer_id=c.id)`).all() as any[]
  const insertProp = db.prepare(`INSERT INTO customer_properties (id, company_id, customer_id, label, address, city, state, county, zip, is_primary)
    VALUES (?, ?, ?, 'Primary', ?, ?, ?, ?, ?, 1)`)
  for (const c of customersNoProp) {
    insertProp.run(uuid(), c.company_id, c.id, c.address, c.city, c.state, c.county, c.zip)
  }
  db.exec(`CREATE TABLE IF NOT EXISTS entity_field_settings (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    entity TEXT NOT NULL,
    field_key TEXT NOT NULL,
    is_enabled INTEGER DEFAULT 1,
    is_required_override INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    UNIQUE(company_id, entity, field_key)
  )`)
  addCol('contacts', 'contact_type', "contact_type TEXT DEFAULT 'standard'")
  addCol('contacts', 'photo_id_storage_key', 'photo_id_storage_key TEXT')
  addCol('contacts', 'photo_id_mime_type', 'photo_id_mime_type TEXT')
  addCol('contacts', 'photo_id_uploaded_at', 'photo_id_uploaded_at TEXT')

  // Backfill project type categories
  const ptCategoryMap: Record<string, { category: string; isConstruction: number; includeCounty: number; requiresPermit: number }> = {
    'Residential Solar Installation': { category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    'Commercial Solar Installation': { category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    'Solar Repair / Maintenance': { category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    'Battery Storage Installation': { category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    'EV Charger Installation': { category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    'Solar and Roof': { category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    'Roof Only': { category: 'construction', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    'Re-Roof': { category: 'construction', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    'Solar Takedown Only': { category: 'solar', isConstruction: 1, includeCounty: 0, requiresPermit: 0 },
    'Solar Re-Install Only': { category: 'solar', isConstruction: 1, includeCounty: 0, requiresPermit: 0 },
  }
  const updatePtCat = db.prepare('UPDATE project_types SET category=?, is_construction=?, include_county_defaults=?, requires_permit=? WHERE name=?')
  for (const [name, meta] of Object.entries(ptCategoryMap)) {
    updatePtCat.run(meta.category, meta.isConstruction, meta.includeCounty, meta.requiresPermit, name)
  }

  // Seed new field permissions
  const newSensitiveFields = [
    { entity: 'contacts', field: 'contact_type' },
    { entity: 'contacts', field: 'photo_id' },
    { entity: 'customers', field: 'co_signer_contact_id' },
    { entity: 'projects', field: 'co_signer_contact_id' },
    { entity: 'projects', field: 'county_department' },
    { entity: 'projects', field: 'permit_number' },
    { entity: 'projects', field: 'property_legal_description' },
    { entity: 'projects', field: 'financing_type' },
    { entity: 'projects', field: 'bank_id' },
  ]
  const insertFieldPerm = db.prepare(`
    INSERT OR IGNORE INTO role_field_permissions (id, role_id, entity, field, can_view, can_edit)
    SELECT ?, r.id, ?, ?, 1, 1 FROM roles r WHERE r.is_system = 1
  `)
  for (const f of newSensitiveFields) {
    insertFieldPerm.run(uuid(), f.entity, f.field)
  }

  // Migrate co-signer contacts from role string to contact_type
  db.exec(`UPDATE contacts SET contact_type='co_signer' WHERE role='co-signer' AND (contact_type IS NULL OR contact_type='standard')`)

  // ── Field sessions, time tracking, stale warnings ──
  addCol('task_templates', 'enable_time_tracking', 'enable_time_tracking INTEGER DEFAULT 0')
  addCol('task_templates', 'enable_stale_warnings', 'enable_stale_warnings INTEGER DEFAULT 0')
  addCol('task_templates', 'sla_days_not_started', 'sla_days_not_started INTEGER')
  addCol('task_templates', 'sla_days_incomplete', 'sla_days_incomplete INTEGER')
  addCol('task_templates', 'stale_days_idle', 'stale_days_idle INTEGER DEFAULT 3')
  addCol('task_templates', 'geofence_radius_m', 'geofence_radius_m INTEGER DEFAULT 150')
  addCol('projects', 'scheduled_install_at', 'scheduled_install_at TEXT')
  addCol('projects', 'sprint_started_at', 'sprint_started_at TEXT')
  addCol('projects', 'sprint_completed_at', 'sprint_completed_at TEXT')
  addCol('projects', 'last_field_activity_at', 'last_field_activity_at TEXT')
  addCol('projects', 'worksite_lat', 'worksite_lat REAL')
  addCol('projects', 'worksite_lng', 'worksite_lng REAL')
  addCol('projects', 'geofence_radius_m', 'geofence_radius_m INTEGER')
  addCol('project_task_items', 'status', "status TEXT DEFAULT 'pending'")
  addCol('project_task_items', 'actual_started_at', 'actual_started_at TEXT')
  addCol('project_task_items', 'actual_completed_at', 'actual_completed_at TEXT')
  addCol('project_task_items', 'scheduled_at', 'scheduled_at TEXT')
  addCol('companies', 'field_policy_json', "field_policy_json TEXT DEFAULT '{\"allowOffsiteEdits\":false,\"defaultGeofenceM\":150}'")

  // ── Indexes ──
  runSqlMigrations(db)
  seedGeoReference(db)

  db.exec(`CREATE INDEX IF NOT EXISTS idx_role_field_permissions_role ON role_field_permissions(role_id);
    CREATE INDEX IF NOT EXISTS idx_customers_source_lead ON customers(source_lead_id);
    CREATE INDEX IF NOT EXISTS idx_contacts_company_role ON contacts(company_id, role);
    CREATE INDEX IF NOT EXISTS idx_leads_company_stage ON leads(company_id, stage_id);
    CREATE INDEX IF NOT EXISTS idx_agreements_company_status ON agreements(company_id, status);
    CREATE INDEX IF NOT EXISTS idx_customer_setup_tokens_token ON customer_setup_tokens(token);`)

  // ── SEED default data ──
  const companyExists = db.prepare('SELECT id FROM companies WHERE id = ?').get('default')
  if (!companyExists) {
    db.prepare('INSERT INTO companies (id, name, branding_json, is_sandbox) VALUES (?, ?, ?, 1)').run('default', 'Default Workspace', DEFAULT_BRANDING)
  } else {
    db.prepare(`UPDATE companies SET name='Default Workspace', is_sandbox=1 WHERE id='default'`).run()
  }

  db.prepare('UPDATE users SET email=? WHERE email=?').run(DEV_ADMIN_EMAIL, 'admin@strikescope.local')
  const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(DEV_ADMIN_EMAIL)
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin', 12)
    db.prepare('INSERT INTO users (id, company_id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)').run(uuid(), null, DEV_ADMIN_EMAIL, 'Dev Admin', 'server_admin', hash)
  }

  const projectTypeDefs: { name: string; category: string; isConstruction: number; includeCounty: number; requiresPermit: number }[] = [
    { name: 'Residential Solar Installation', category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    { name: 'Commercial Solar Installation', category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    { name: 'Solar Repair / Maintenance', category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    { name: 'Battery Storage Installation', category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    { name: 'EV Charger Installation', category: 'solar', isConstruction: 0, includeCounty: 0, requiresPermit: 0 },
    { name: 'Solar and Roof', category: 'solar', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    { name: 'Roof Only', category: 'construction', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    { name: 'Re-Roof', category: 'construction', isConstruction: 1, includeCounty: 1, requiresPermit: 1 },
    { name: 'Solar Takedown Only', category: 'solar', isConstruction: 1, includeCounty: 0, requiresPermit: 0 },
    { name: 'Solar Re-Install Only', category: 'solar', isConstruction: 1, includeCounty: 0, requiresPermit: 0 },
  ]
  for (const pt of projectTypeDefs) {
    if (!db.prepare('SELECT id FROM project_types WHERE name = ?').get(pt.name)) {
      db.prepare('INSERT INTO project_types (id, name, category, is_construction, include_county_defaults, requires_permit) VALUES (?, ?, ?, ?, ?, ?)').run(
        uuid(), pt.name, pt.category, pt.isConstruction, pt.includeCounty, pt.requiresPermit,
      )
    }
  }

  // Enable all project types for all companies
  const allTypes = db.prepare('SELECT id FROM project_types').all() as any[]
  const allCompanies = db.prepare('SELECT id FROM companies WHERE deleted_at IS NULL').all() as any[]
  for (const co of allCompanies) {
    for (const pt of allTypes) {
      if (!db.prepare('SELECT 1 FROM company_project_types WHERE company_id=? AND project_type_id=?').get(co.id, pt.id)) {
        db.prepare('INSERT INTO company_project_types (company_id, project_type_id) VALUES (?, ?)').run(co.id, pt.id)
      }
    }
    seedContactCategories(db, co.id)
  }

  // Seed default roles for all companies
  const ENTITIES = ['leads', 'customers', 'projects', 'contacts', 'agreements', 'submissions', 'settings', 'users', 'audit', 'forms']
  const roleInsert = db.prepare('INSERT INTO roles (id, company_id, name, description, is_system) VALUES (?, ?, ?, ?, 1)')
  const permInsert = db.prepare('INSERT INTO role_permissions (id, role_id, entity, can_view, can_create, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)')
  const rolePermissionExists = db.prepare('SELECT id FROM role_permissions WHERE role_id = ? AND entity = ?')
  const denyPermission = { v: 0, c: 0, e: 0, d: 0 }
  const ensureRolePermission = (roleId: string, entity: string, permission: { v: number; c: number; e: number; d: number }) => {
    if (!rolePermissionExists.get(roleId, entity)) {
      permInsert.run(uuid(), roleId, entity, permission.v, permission.c, permission.e, permission.d)
    }
  }
  for (const company of allCompanies) {
    // Check if Company Admin role already exists for this company
    const existingAdmin = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(company.id, 'Company Admin') as any
    const adminRoleId = existingAdmin?.id || uuid()
    if (!existingAdmin) {
      roleInsert.run(adminRoleId, company.id, 'Company Admin', 'Full access to all CRM features')
    }
    for (const entity of ENTITIES) {
      ensureRolePermission(adminRoleId, entity, { v: 1, c: 1, e: 1, d: 1 })
    }
    const existingUser = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(company.id, 'User') as any
    const userRoleId = existingUser?.id || uuid()
    if (!existingUser) {
      roleInsert.run(userRoleId, company.id, 'User', 'View-only access to leads, customers, projects, contacts, and submissions')
    }
    for (const entity of ENTITIES) {
      const permission = ['leads', 'customers', 'projects', 'contacts', 'submissions', 'forms'].includes(entity)
        ? { v: 1, c: 0, e: 0, d: 0 }
        : denyPermission
      ensureRolePermission(userRoleId, entity, permission)
    }
  }

  // Seed 8 new roles (Sales Manager → Technician) for each company
  const ROLE_DEFS: { name: string; desc: string; perms: Record<string, { v: number; c: number; e: number; d: number }> }[] = [
    { name: 'Sales Manager', desc: 'Assigns Sales Agents to Leads', perms: { leads: { v: 1, c: 1, e: 1, d: 1 }, customers: { v: 1, c: 0, e: 0, d: 0 }, projects: { v: 1, c: 0, e: 0, d: 0 }, contacts: { v: 0, c: 0, e: 0, d: 0 }, submissions: { v: 0, c: 0, e: 0, d: 0 }, settings: { v: 1, c: 1, e: 1, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 1, c: 0, e: 0, d: 0 } } },
    { name: 'Sales Agent', desc: 'Visits Leads to Convert Them to Customers', perms: { leads: { v: 1, c: 1, e: 1, d: 0 }, customers: { v: 1, c: 0, e: 0, d: 0 }, projects: { v: 1, c: 0, e: 0, d: 0 }, contacts: { v: 0, c: 0, e: 0, d: 0 }, submissions: { v: 0, c: 0, e: 0, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 1, c: 0, e: 0, d: 0 } } },
    { name: 'Project Admin', desc: 'Assigns Project Managers to Customers', perms: { leads: { v: 1, c: 0, e: 0, d: 0 }, customers: { v: 1, c: 1, e: 1, d: 1 }, projects: { v: 1, c: 1, e: 1, d: 1 }, contacts: { v: 1, c: 1, e: 1, d: 1 }, submissions: { v: 1, c: 0, e: 0, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 1, c: 0, e: 0, d: 0 }, forms: { v: 1, c: 0, e: 0, d: 0 } } },
    { name: 'Project Manager', desc: 'Handles customers, accounts, documents, and calls', perms: { leads: { v: 1, c: 0, e: 0, d: 0 }, customers: { v: 1, c: 1, e: 1, d: 0 }, projects: { v: 1, c: 1, e: 1, d: 0 }, contacts: { v: 1, c: 1, e: 1, d: 0 }, submissions: { v: 1, c: 0, e: 0, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 1, c: 0, e: 0, d: 0 } } },
    { name: 'Foreman', desc: 'Main Installer of physical services', perms: { leads: { v: 0, c: 0, e: 0, d: 0 }, customers: { v: 1, c: 0, e: 0, d: 0 }, projects: { v: 1, c: 0, e: 1, d: 0 }, contacts: { v: 0, c: 0, e: 0, d: 0 }, submissions: { v: 1, c: 1, e: 1, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 0, c: 0, e: 0, d: 0 } } },
    { name: 'Crewman', desc: 'Employee under Foreman', perms: { leads: { v: 0, c: 0, e: 0, d: 0 }, customers: { v: 0, c: 0, e: 0, d: 0 }, projects: { v: 1, c: 0, e: 0, d: 0 }, contacts: { v: 0, c: 0, e: 0, d: 0 }, submissions: { v: 1, c: 1, e: 1, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 0, c: 0, e: 0, d: 0 } } },
    { name: 'Technician', desc: 'Troubleshoots systems for any customer', perms: { leads: { v: 0, c: 0, e: 0, d: 0 }, customers: { v: 1, c: 0, e: 0, d: 0 }, projects: { v: 1, c: 0, e: 0, d: 0 }, contacts: { v: 0, c: 0, e: 0, d: 0 }, submissions: { v: 0, c: 0, e: 0, d: 0 }, settings: { v: 0, c: 0, e: 0, d: 0 }, users: { v: 0, c: 0, e: 0, d: 0 }, audit: { v: 0, c: 0, e: 0, d: 0 }, forms: { v: 0, c: 0, e: 0, d: 0 } } },
  ]
  const enabledRoleInsert = db.prepare('INSERT OR IGNORE INTO enabled_roles (company_id, role_id, is_enabled) VALUES (?, ?, ?)')
  for (const company of allCompanies) {
    for (const rd of ROLE_DEFS) {
      const existing = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(company.id, rd.name) as any
      const roleId = existing?.id || uuid()
      if (!existing) {
        roleInsert.run(roleId, company.id, rd.name, rd.desc)
      }
      for (const entity of ENTITIES) {
        ensureRolePermission(roleId, entity, rd.perms[entity] || denyPermission)
      }
      enabledRoleInsert.run(company.id, roleId, 1)
    }
    // Disable the old 'User' template role by default
    const userRole = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(company.id, 'User') as any
    if (userRole) {
      enabledRoleInsert.run(company.id, userRole.id, 0)
    }
  }

  // Seed field permissions for existing roles
  const fieldPermInsert = db.prepare('INSERT OR IGNORE INTO role_field_permissions (id, role_id, entity, field, can_view, can_edit) VALUES (?, ?, ?, ?, ?, ?)')
  const allRoles = db.prepare('SELECT id, name FROM roles').all() as any[]
  for (const role of allRoles) {
    const isAdmin = role.name === 'Company Admin'
    for (const fp of SENSITIVE_FIELD_PAIRS) {
      const existing = db.prepare('SELECT id FROM role_field_permissions WHERE role_id=? AND entity=? AND field=?').get(role.id, fp.entity, fp.field)
      if (!existing) {
        fieldPermInsert.run(uuid(), role.id, fp.entity, fp.field, isAdmin ? 1 : 0, isAdmin ? 1 : 0)
      }
    }
  }

  // Assign existing users to default roles
  const unassignedUsers = db.prepare('SELECT id, company_id, role FROM users WHERE role_id IS NULL').all() as any[]
  for (const u of unassignedUsers) {
    let roleName = 'User'
    if (u.role === 'company_admin') roleName = 'Company Admin'
    const role = db.prepare('SELECT id FROM roles WHERE company_id = ? AND name = ?').get(u.company_id || u.companyId, roleName) as any
    if (role) {
      db.prepare('UPDATE users SET role_id = ? WHERE id = ?').run(role.id, u.id)
    }
  }

  // Seed default lead stages for default company
  const existingStages = db.prepare('SELECT id FROM lead_stages WHERE company_id = ?').get('default')
  if (!existingStages) {
    const defaultStages = [
      { name: 'New', color: '#9E9E9E' },
      { name: 'Contacted', color: '#4FC3F7' },
      { name: 'Qualified', color: '#F57C00' },
      { name: 'Proposal', color: '#FFD54F' },
      { name: 'Negotiation', color: '#7C4DFF' },
      { name: 'Won', color: '#2E7D32' },
      { name: 'Lost', color: '#D32F2F' },
    ]
    const insert = db.prepare('INSERT INTO lead_stages (id, company_id, name, sort_order, color, is_default) VALUES (?, ?, ?, ?, ?, ?)')
    for (let i = 0; i < defaultStages.length; i++) {
      insert.run(uuid(), 'default', defaultStages[i].name, i, defaultStages[i].color, i === 0 ? 1 : 0)
    }
  }

  // Seed default global task template with 23 items if not exists
  if (!db.prepare('SELECT id FROM task_templates WHERE is_global=1 AND is_default=1').get()) {
    const tid = uuid()
    db.prepare('INSERT INTO task_templates (id, company_id, name, is_global, is_default, project_type_id) VALUES (?, ?, ?, ?, ?, ?)').run(
      tid, null, 'Standard Photo Checklist', 1, 1,
      (db.prepare('SELECT id FROM project_types WHERE name = ?').get('Residential Solar Installation') as any)?.id || null
    )
    const items = [
      { label: '01', titleEn: 'Roof - Front Face', titleEs: 'Techo - Cara Frontal', descEn: 'Full view of the front roof face showing all panels', descEs: 'Vista completa de la cara frontal del techo mostrando todos los paneles', count: 1 },
      { label: '02', titleEn: 'Roof - Left Side', titleEs: 'Techo - Lado Izquierdo', descEn: 'Left side roof view showing panel alignment', descEs: 'Vista del lado izquierdo del techo mostrando alineacion de paneles', count: 1 },
      { label: '03', titleEn: 'Roof - Right Side', titleEs: 'Techo - Lado Derecho', descEn: 'Right side roof view showing panel alignment', descEs: 'Vista del lado derecho del techo mostrando alineacion de paneles', count: 1 },
      { label: '04', titleEn: 'Roof - Back Face', titleEs: 'Techo - Cara Trasera', descEn: 'Back roof face showing conduit routing', descEs: 'Cara trasera del techo mostrando el recorrido del conducto', count: 1 },
      { label: '05', titleEn: 'Electrical Panel - Main', titleEs: 'Panel Electrico - Principal', descEn: 'Main electrical panel with breaker labels visible', descEs: 'Panel electrico principal con etiquetas de interruptores visibles', count: 2 },
      { label: '06', titleEn: 'Electrical Panel - Internal Wiring', titleEs: 'Panel Electrico - Cableado Interno', descEn: 'Open panel showing wiring, breakers, and connections', descEs: 'Panel abierto mostrando cableado, interruptores y conexiones', count: 1 },
      { label: '07', titleEn: 'Meter - Front View', titleEs: 'Medidor - Vista Frontal', descEn: 'Utility meter with display and serial number visible', descEs: 'Medidor de servicios con pantalla y numero de serie visibles', count: 1 },
      { label: '08', titleEn: 'Meter - Base/Connections', titleEs: 'Medidor - Base/Conexiones', descEn: 'Meter base showing utility connections and seal', descEs: 'Base del medidor mostrando conexiones de servicios y sello', count: 1 },
      { label: '09', titleEn: 'Inverter - AC Disconnect', titleEs: 'Inversor - Desconexion CA', descEn: 'AC disconnect switch in the OFF position with label', descEs: 'Interruptor de desconexion CA en posicion APAGADO con etiqueta', count: 1 },
      { label: '10', titleEn: 'Inverter - DC Disconnect', titleEs: 'Inversor - Desconexion CC', descEn: 'DC disconnect switch with voltage reading', descEs: 'Interruptor de desconexion CC con lectura de voltaje', count: 1 },
      { label: '11', titleEn: 'Inverter - Nameplate', titleEs: 'Inversor - Placa de Identificacion', descEn: 'Inverter nameplate with model and serial numbers', descEs: 'Placa de identificacion del inversor con modelo y numeros de serie', count: 1 },
      { label: '12', titleEn: 'Inverter - Display Screen', titleEs: 'Inversor - Pantalla', descEn: 'Inverter display showing operational status', descEs: 'Pantalla del inversor mostrando estado operativo', count: 1 },
      { label: '13', titleEn: 'Rapid Shutdown - Label', titleEs: 'Apagado Rapido - Etiqueta', descEn: 'Rapid shutdown label at array location', descEs: 'Etiqueta de apagado rapido en la ubicacion del arreglo', count: 1 },
      { label: '14', titleEn: 'Rapid Shutdown - Junction Box', titleEs: 'Apagado Rapido - Caja de Conexiones', descEn: 'Rapid shutdown junction box with conduit connections', descEs: 'Caja de conexiones de apagado rapido con conexiones de conducto', count: 1 },
      { label: '15', titleEn: 'Conduit - Roof Penetration', titleEs: 'Conducto - Penetracion de Techo', descEn: 'Conduit roof penetration with flashing and sealant', descEs: 'Penetracion de conducto en techo con flashings y sellador', count: 2 },
      { label: '16', titleEn: 'Conduit - Wall Run', titleEs: 'Conducto - Recorrido de Pared', descEn: 'Conduit along exterior wall showing supports', descEs: 'Conducto a lo largo de la pared exterior mostrando soportes', count: 2 },
      { label: '17', titleEn: 'Grounding - Rod/Electrode', titleEs: 'Puesta a Tierra - Varilla/Electrodo', descEn: 'Ground rod with clamp and conductor visible', descEs: 'Varilla de tierra con abrazadera y conductor visibles', count: 2 },
      { label: '18', titleEn: 'Grounding - Bonding Bridge', titleEs: 'Puesta a Tierra - Puente de Union', descEn: 'Equipment bonding jumper at panel', descEs: 'Puente de union de equipos en el panel', count: 2 },
      { label: '19', titleEn: 'Attic - Flashing Seals', titleEs: 'Atico - Sellos de Flashings', descEn: 'Attic view of all roof penetrations with seals intact', descEs: 'Vista del atico de todas las penetraciones de techo con sellos intactos', count: 2 },
      { label: '20', titleEn: 'Attic - Wiring Overview', titleEs: 'Atico - Vista General del Cableado', descEn: 'Attic wiring showing proper support and protection', descEs: 'Cableado del atico mostrando soporte y proteccion adecuados', count: 2 },
      { label: '21', titleEn: 'Site - Property Overview', titleEs: 'Sitio - Vista General', descEn: 'Overview photo showing entire installation site', descEs: 'Foto general mostrando todo el sitio de instalacion', count: 3 },
      { label: '22', titleEn: 'Site - Access Path', titleEs: 'Sitio - Camino de Acceso', descEn: 'Access path to equipment showing clear walkway', descEs: 'Camino de acceso al equipo mostrando pasillo despejado', count: 3 },
      { label: '23', titleEn: 'Site - Clearance Around Equipment', titleEs: 'Sitio - Espacio Alrededor del Equipo', descEn: 'Required clearance maintained around all electrical equipment', descEs: 'Espacio libre requerido mantenido alrededor de todo el equipo electrico', count: 3 },
    ]
    const insert = db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
    for (let i = 0; i < items.length; i++) {
      insert.run(uuid(), tid, items[i].label, i, items[i].titleEn, items[i].titleEs, items[i].descEn, items[i].descEs, items[i].count)
    }
  }
}

export default db
