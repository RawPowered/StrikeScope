import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { recordActivity } from './helpers.js'
import { seedContactCategories } from '../territory.js'

const router = Router()
router.use(requireRole('server_admin'))

const DEFAULT_BRANDING = JSON.stringify({
  primary: '#F57C00', secondary: '#4FC3F7', accent: '#FFD54F',
  grey: '#9E9E9E', gunmetal: '#2C3439', white: '#FFFFFF',
  appName: 'StrikeScope',
})

const DEFAULT_STAGES = [
  { name: 'New', color: '#9E9E9E' },
  { name: 'Contacted', color: '#4FC3F7' },
  { name: 'Qualified', color: '#F57C00' },
  { name: 'Proposal', color: '#FFD54F' },
  { name: 'Negotiation', color: '#7C4DFF' },
  { name: 'Won', color: '#2E7D32' },
  { name: 'Lost', color: '#D32F2F' },
]

router.post('/deploy', (req, res) => {
  const { company: companyInput, adminUser, stages, subdomain } = req.body
  if (!companyInput?.name || !adminUser?.email || !adminUser?.password || !subdomain) {
    return res.status(400).json({ ok: false, error: 'company.name, adminUser.email, adminUser.password, and subdomain are required' })
  }
  if (db.prepare('SELECT id FROM company_domains WHERE domain = ?').get(subdomain)) {
    return res.status(400).json({ ok: false, error: `Subdomain "${subdomain}" is already taken` })
  }

  const companyId = uuid()
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(adminUser.email.trim()) as any
  const userId = existingUser?.id || uuid()
  const domainId = uuid()
  const fullDomain = `${subdomain}.sandbox.localhost`
  const hash = bcrypt.hashSync(adminUser.password, 12)
  const branding = companyInput.branding ? JSON.stringify(companyInput.branding) : DEFAULT_BRANDING

  const tx = db.transaction(() => {
    // 1. Create company
    db.prepare('INSERT INTO companies (id, name, address, phone, email, branding_json) VALUES (?, ?, ?, ?, ?, ?)').run(
      companyId, companyInput.name.trim(), companyInput.address || null, companyInput.phone || null, companyInput.email || null, branding,
    )

    // 2. Create or attach admin user
    if (!existingUser) {
      db.prepare('INSERT INTO users (id, company_id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?, ?)').run(
        userId, companyId, adminUser.email.trim(), adminUser.name?.trim() || 'Company Admin', 'company_admin', hash,
      )
    }
    db.prepare(`INSERT OR IGNORE INTO user_company_memberships (id, user_id, company_id, role, role_id, is_active)
      VALUES (?, ?, ?, ?, NULL, 1)`).run(uuid(), userId, companyId, 'company_admin')

    // 3. Create lead stages
    const stageNames = stages?.length ? stages : DEFAULT_STAGES
    const insertStage = db.prepare('INSERT INTO lead_stages (id, company_id, name, sort_order, color, is_default) VALUES (?, ?, ?, ?, ?, ?)')
    for (let i = 0; i < stageNames.length; i++) {
      insertStage.run(uuid(), companyId, stageNames[i].name, i, stageNames[i].color || '#888', i === 0 ? 1 : 0)
    }

    // 4. Create domain
    db.prepare('INSERT INTO company_domains (id, company_id, domain, is_primary, is_sandbox) VALUES (?, ?, ?, ?, ?)').run(
      domainId, companyId, fullDomain, 1, 1,
    )

    // 5. Seed directory contact categories
    seedContactCategories(db, companyId)

    // 6. Enable all project types for this company
    const allTypes = db.prepare('SELECT id FROM project_types').all() as any[]
    const insertPt = db.prepare('INSERT INTO company_project_types (company_id, project_type_id) VALUES (?, ?)')
    for (const pt of allTypes) {
      insertPt.run(companyId, pt.id)
    }

    // 7. Copy global default template as company's default
    const globalTmpl = db.prepare('SELECT id FROM task_templates WHERE is_global=1 AND is_default=1 AND is_active=1').get() as any
    if (globalTmpl) {
      const newTmplId = uuid()
      db.prepare('INSERT INTO task_templates (id, company_id, name, is_global, is_default, source_template_id) VALUES (?, ?, ?, ?, ?, ?)').run(
        newTmplId, companyId, 'Default Photo Checklist', 0, 1, globalTmpl.id,
      )
      const items = db.prepare('SELECT * FROM template_items WHERE template_id = ?').all(globalTmpl.id) as any[]
      const insertItem = db.prepare('INSERT INTO template_items (id, template_id, label, sort_order, title_en, title_es, desc_en, desc_es, required_count, example_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      for (const item of items) {
        insertItem.run(uuid(), newTmplId, item.label, item.sort_order, item.title_en, item.title_es, item.desc_en, item.desc_es, item.required_count, item.example_image)
      }
    }
  })
  tx()

  const superUser = req.user
  recordActivity(companyId, 'company', companyId, 'deployed', `Company "${companyInput.name}" deployed by ${superUser?.name || 'super admin'}`, superUser)

  res.status(201).json({
    ok: true,
    data: {
      company: { id: companyId, name: companyInput.name },
      user: { id: userId, email: adminUser.email },
      domain: { id: domainId, domain: fullDomain },
    },
  })
})

export default router
