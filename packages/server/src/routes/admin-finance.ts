import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'
import { requireRole } from '../auth.js'
import { requireActiveCompany, requireCompanyRecord } from './helpers.js'
import { buildFinanceScope, evaluateFormula, canAccessFinance } from '../plugins/finance-eval.js'

const router = Router()

function financeGuard(req: any, res: any): boolean {
  const roleName = req.user?.roleName as string | undefined
  if (!canAccessFinance(req.user?.role, roleName)) {
    res.status(403).json({ ok: false, error: 'Finance access denied' })
    return false
  }
  return true
}

/* ── Finance field definitions ── */
router.get('/fields', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const rows = db.prepare(`SELECT id, field_key as fieldKey, label, field_type as fieldType,
    formula_json as formulaJson, visibility, sort_order as sortOrder, is_active as isActive
    FROM finance_field_definitions WHERE company_id=? ORDER BY sort_order ASC`).all(companyId)
  res.json({ ok: true, data: rows })
})

router.post('/fields', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { fieldKey, label, fieldType, formulaJson, visibility, sortOrder } = req.body
  if (!fieldKey?.trim() || !label?.trim()) return res.status(400).json({ ok: false, error: 'fieldKey and label required' })
  const id = uuid()
  db.prepare(`INSERT INTO finance_field_definitions (id, company_id, field_key, label, field_type, formula_json, visibility, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, companyId, fieldKey.trim(), label.trim(), fieldType || 'currency', formulaJson || null, visibility || 'finance_admin', sortOrder ?? 0)
  res.status(201).json({ ok: true, data: { id } })
})

router.put('/fields/:id', requireRole('server_admin', 'company_admin'), (req, res) => {
  if (!requireCompanyRecord(req, res, 'finance_field_definitions', String(req.params.id))) return
  const { label, fieldType, formulaJson, visibility, sortOrder, isActive } = req.body
  db.prepare(`UPDATE finance_field_definitions SET label=COALESCE(?,label), field_type=COALESCE(?,field_type),
    formula_json=COALESCE(?,formula_json), visibility=COALESCE(?,visibility),
    sort_order=COALESCE(?,sort_order), is_active=COALESCE(?,is_active) WHERE id=?`).run(
    label || null, fieldType || null, formulaJson ?? null, visibility ?? null,
    sortOrder ?? null, isActive != null ? (isActive ? 1 : 0) : null, req.params.id,
  )
  res.json({ ok: true })
})

/* ── Project costs ── */
router.get('/projects/:projectId/costs', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const project = db.prepare('SELECT id FROM projects WHERE id=? AND company_id=?').get(req.params.projectId, companyId)
  if (!project) return res.status(404).json({ ok: false, error: 'Project not found' })
  const lines = db.prepare(`SELECT id, project_id as projectId, label, category, amount, sort_order as sortOrder, created_at as createdAt
    FROM project_cost_lines WHERE project_id=? ORDER BY sort_order ASC`).all(req.params.projectId)
  res.json({ ok: true, data: lines })
})

router.post('/projects/:projectId/costs', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const { label, category, amount, sortOrder } = req.body
  const id = uuid()
  db.prepare(`INSERT INTO project_cost_lines (id, project_id, label, category, amount, sort_order, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, req.params.projectId, label, category || null, amount ?? 0, sortOrder ?? 0, req.user?.userId || null)
  res.status(201).json({ ok: true, data: { id } })
})

router.delete('/projects/:projectId/costs/:costId', (req, res) => {
  if (!financeGuard(req, res)) return
  db.prepare('DELETE FROM project_cost_lines WHERE id=? AND project_id=?').run(req.params.costId, req.params.projectId)
  res.json({ ok: true })
})

/* ── Project finance snapshot ── */
router.get('/projects/:projectId/summary', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const isAgent = req.user?.roleName === 'Sales Agent'
  if (isAgent) return res.status(403).json({ ok: false, error: 'Finance access denied' })
  if (!financeGuard(req, res)) return

  const costs = db.prepare('SELECT category, amount FROM project_cost_lines WHERE project_id=?').all(req.params.projectId) as any[]
  const defs = db.prepare(`SELECT id, field_key as fieldKey, label, field_type as fieldType, formula_json as formulaJson
    FROM finance_field_definitions WHERE company_id=? AND is_active=1`).all(companyId) as any[]
  const stored = db.prepare(`SELECT field_definition_id, value, computed_value FROM project_finance_values WHERE project_id=?`).all(req.params.projectId) as any[]
  const valMap: Record<string, number> = {}
  for (const s of stored) {
    const n = s.computed_value ?? parseFloat(s.value)
    if (!isNaN(n)) valMap[(defs.find((d: any) => d.id === s.field_definition_id) as any)?.fieldKey] = n
  }
  const scope = buildFinanceScope(costs, valMap)
  const computed: Record<string, number | null> = {}
  for (const d of defs) {
    if (d.fieldType === 'calculated' && d.formulaJson) {
      try {
        const expr = JSON.parse(d.formulaJson).expression || d.formulaJson
        computed[d.fieldKey] = evaluateFormula(expr, scope)
        if (computed[d.fieldKey] != null) scope[d.fieldKey] = computed[d.fieldKey]!
      } catch { computed[d.fieldKey] = null }
    }
  }
  res.json({ ok: true, data: { costs, fieldValues: valMap, computed, scope } })
})

router.put('/projects/:projectId/values', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const { values } = req.body
  if (!Array.isArray(values)) return res.status(400).json({ ok: false, error: 'values array required' })
  const upsert = db.prepare(`INSERT INTO project_finance_values (id, project_id, field_definition_id, value, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(project_id, field_definition_id) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`)
  for (const v of values) {
    upsert.run(uuid(), req.params.projectId, v.fieldDefinitionId, String(v.value ?? ''))
  }
  res.json({ ok: true })
})

/* ── Commission formulas ── */
router.get('/formulas', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const rows = db.prepare('SELECT id, name, formula_json as formulaJson, is_default as isDefault FROM commission_formulas WHERE company_id=?').all(companyId)
  res.json({ ok: true, data: rows })
})

router.post('/formulas', requireRole('server_admin', 'company_admin'), (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const { name, formulaJson, isDefault } = req.body
  const id = uuid()
  if (isDefault) db.prepare('UPDATE commission_formulas SET is_default=0 WHERE company_id=?').run(companyId)
  db.prepare('INSERT INTO commission_formulas (id, company_id, name, formula_json, is_default) VALUES (?, ?, ?, ?, ?)').run(
    id, companyId, name, JSON.stringify(formulaJson), isDefault ? 1 : 0,
  )
  res.status(201).json({ ok: true, data: { id } })
})

/* ── Commission reports ── */
router.get('/reports', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const isAgent = req.user?.roleName === 'Sales Agent'
  if (isAgent) {
    const lines = db.prepare(`SELECT cr.id as reportId, cr.name, cr.created_at as createdAt, crl.payout_amount as payoutAmount
      FROM commission_report_lines crl JOIN commission_reports cr ON cr.id=crl.report_id
      WHERE cr.company_id=? AND crl.user_id=? ORDER BY cr.created_at DESC`).all(companyId, req.user?.userId)
    return res.json({ ok: true, data: lines })
  }
  if (!financeGuard(req, res)) return
  const reports = db.prepare('SELECT id, name, period_start as periodStart, period_end as periodEnd, created_at as createdAt FROM commission_reports WHERE company_id=? ORDER BY created_at DESC').all(companyId)
  res.json({ ok: true, data: reports })
})

router.post('/reports/generate', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const { name, periodStart, periodEnd, formulaId } = req.body
  const formula = db.prepare('SELECT * FROM commission_formulas WHERE id=? AND company_id=?').get(formulaId, companyId) as any
  if (!formula) return res.status(400).json({ ok: false, error: 'Formula not found' })
  let formulaExpr = ''
  try { formulaExpr = JSON.parse(formula.formula_json).expression || formula.formula_json } catch { formulaExpr = formula.formula_json }

  const reportId = uuid()
  const projects = db.prepare(`SELECT id FROM projects WHERE company_id=? AND status IN ('active','completed')`).all(companyId) as any[]
  const lineInsert = db.prepare(`INSERT INTO commission_report_lines (id, report_id, user_id, project_id, payout_amount, breakdown_json)
    VALUES (?, ?, ?, ?, ?, ?)`)

  for (const proj of projects) {
    const costs = db.prepare('SELECT category, amount FROM project_cost_lines WHERE project_id=?').all(proj.id) as any[]
    const scope = buildFinanceScope(costs, {})
    const payout = evaluateFormula(formulaExpr, scope) ?? 0
    const agents = db.prepare(`SELECT user_id FROM project_assignments WHERE project_id=? AND role='sales_agent'`).all(proj.id) as any[]
    for (const ag of agents) {
      lineInsert.run(uuid(), reportId, ag.user_id, proj.id, payout, JSON.stringify({ formula: formulaExpr, scope }))
    }
  }

  db.prepare(`INSERT INTO commission_reports (id, company_id, name, period_start, period_end, formula_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(reportId, companyId, name, periodStart || null, periodEnd || null, formulaId, req.user?.userId || null)
  res.status(201).json({ ok: true, data: { id: reportId } })
})

router.get('/reports/:id/lines', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  const isAgent = req.user?.roleName === 'Sales Agent'
  let lines: any[]
  if (isAgent) {
    lines = db.prepare(`SELECT id, user_id as userId, project_id as projectId, payout_amount as payoutAmount, created_at as createdAt
      FROM commission_report_lines WHERE report_id=? AND user_id=?`).all(req.params.id, req.user?.userId)
  } else {
    if (!financeGuard(req, res)) return
    lines = db.prepare(`SELECT id, user_id as userId, project_id as projectId, payout_amount as payoutAmount, breakdown_json as breakdownJson, created_at as createdAt
      FROM commission_report_lines WHERE report_id=?`).all(req.params.id)
  }
  res.json({ ok: true, data: lines })
})

/* ── Company finance rollup ── */
router.get('/company-summary', (req, res) => {
  const companyId = requireActiveCompany(req, res)
  if (!companyId) return
  if (!financeGuard(req, res)) return
  const totals = db.prepare(`SELECT SUM(pcl.amount) as totalCosts, COUNT(DISTINCT pcl.project_id) as projectCount
    FROM project_cost_lines pcl JOIN projects p ON p.id=pcl.project_id WHERE p.company_id=?`).get(companyId) as any
  res.json({ ok: true, data: totals })
})

export default router
