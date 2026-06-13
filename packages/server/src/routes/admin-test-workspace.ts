import { Router } from 'express'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany } from './helpers.js'
import { resetTestWorkspace, isSandboxCompany } from '../plugins/test-workspace/index.js'

const router = Router()

router.get('/status', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  res.json({
    ok: true,
    data: {
      companyId,
      isSandbox: isSandboxCompany(db, companyId),
      leads: (db.prepare('SELECT COUNT(*) as n FROM leads WHERE company_id=?').get(companyId) as { n: number }).n,
      customers: (db.prepare('SELECT COUNT(*) as n FROM customers WHERE company_id=?').get(companyId) as { n: number }).n,
      projects: (db.prepare('SELECT COUNT(*) as n FROM projects WHERE company_id=?').get(companyId) as { n: number }).n,
    },
  })
})

router.post('/reset', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  try {
    const result = resetTestWorkspace(db, companyId)
    res.json({ ok: true, data: result })
  } catch (e: any) {
    res.status(400).json({ ok: false, error: e.message })
  }
})

export default router
