import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/:slug', (req, res) => {
  const link = db.prepare(`
    SELECT fl.form_id as formId, fl.company_id as companyId,
           fd.name, fd.description, fd.schema_json as schemaJson
    FROM form_links fl
    JOIN form_definitions fd ON fd.id = fl.form_id AND fd.is_active = 1
    WHERE fl.slug = ? AND fl.is_active = 1
  `).get(req.params.slug) as any
  if (!link) return res.status(404).json({ ok: false, error: 'Form not found' })
  res.json({
    ok: true,
    data: {
      formId: link.formId,
      companyId: link.companyId,
      name: link.name,
      description: link.description,
      schemaJson: link.schemaJson,
    },
  })
})

function getFieldValue(response: Record<string, any>, fieldName: string): string {
  const val = response[fieldName]
  if (val == null) return ''
  return String(val)
}

function evalServerCondition(field: any, response: Record<string, any>): boolean {
  const srcField = field.conditional_field
  const op = field.conditional_op
  const condVal = field.conditional_value
  if (!srcField || !op) return true

  const val = getFieldValue(response, srcField)

  switch (op) {
    case 'equals': return val === condVal
    case 'not_equals': return val !== condVal
    case 'contains': return val.toLowerCase().includes((condVal || '').toLowerCase())
    case 'not_contains': return !val.toLowerCase().includes((condVal || '').toLowerCase())
    case 'is_empty': return !val
    case 'is_not_empty': return !!val
    default: return true
  }
}

router.post('/:slug', (req, res) => {
  const link = db.prepare(`
    SELECT fl.form_id as formId, fl.company_id as companyId, fd.schema_json as schemaJson
    FROM form_links fl
    JOIN form_definitions fd ON fd.id = fl.form_id AND fd.is_active = 1
    WHERE fl.slug = ? AND fl.is_active = 1
  `).get(req.params.slug) as any
  if (!link) return res.status(404).json({ ok: false, error: 'Form not found' })
  const { responseJson } = req.body
  if (!responseJson) return res.status(400).json({ ok: false, error: 'responseJson is required' })

  // Server-side conditional logic validation
  const response = typeof responseJson === 'string' ? JSON.parse(responseJson) : responseJson
  if (link.schemaJson) {
    const schema = JSON.parse(link.schemaJson)
    const fields = Array.isArray(schema) ? schema : []
    for (const field of fields) {
      if (field.conditional_field && field.conditional_op) {
        const visible = evalServerCondition(field, response)
        if (!visible) {
          const val = getFieldValue(response, field.name)
          if (val) {
            return res.status(422).json({
              ok: false,
              error: `Field "${field.label || field.name}" is hidden by conditional logic and must be empty`,
            })
          }
        }
      }
    }
  }

  const id = uuid()
  db.prepare('INSERT INTO form_submissions (id, form_id, company_id, response_json, respondent_ip, respondent_ua) VALUES (?, ?, ?, ?, ?, ?)').run(
    id, link.formId, link.companyId,
    typeof responseJson === 'string' ? responseJson : JSON.stringify(responseJson),
    req.ip || null,
    req.headers['user-agent'] || null,
  )
  res.status(201).json({ ok: true, data: { id } })
})

export default router
