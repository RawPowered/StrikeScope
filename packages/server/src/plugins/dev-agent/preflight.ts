import { searchCode } from './workspace.js'
import { getSchemaOverview, getTableInfo, runReadonlyQuery } from './sql-tools.js'

const CRM_RE = /lead|company|contact|customer|record|detail|crm|schema|migration|sql|table|api|kanban|stage/i
const VERIFY_RE = /make sure|ensure|verify|check|missing|exist|have|every|each|all\b/i

export function buildPreflightContext(prompt: string): string {
  if (!CRM_RE.test(prompt)) return ''

  const lower = prompt.toLowerCase()
  const parts: string[] = ['## Auto-investigation (use this context; do not re-search unless needed)']

  try {
    const schema = getSchemaOverview()
    const relevant = schema.tables.filter(t => /lead|company|contact|customer|detail|stage/i.test(t.name))
    if (relevant.length) {
      parts.push('### Relevant tables', JSON.stringify(relevant.map(t => t.name)))
    }
    for (const table of ['leads', 'companies', 'lead_stages', 'contacts']) {
      if (relevant.some(t => t.name === table)) {
        parts.push(`### Schema: ${table}`, JSON.stringify(getTableInfo(table)).slice(0, 4000))
      }
    }
  } catch (e) {
    parts.push(`Schema unavailable: ${e instanceof Error ? e.message : String(e)}`)
  }

  const queries = new Set<string>()
  if (lower.includes('lead')) queries.add('leads')
  if (lower.includes('detail')) queries.add('LeadDetail')
  if (lower.includes('company')) queries.add('company_id')
  if (lower.includes('record')) queries.add('INSERT INTO leads')
  if (lower.includes('kanban')) queries.add('LeadKanban')
  for (const word of lower.split(/\W+/).filter(w => w.length > 4).slice(0, 3)) {
    queries.add(word)
  }

  for (const q of [...queries].slice(0, 6)) {
    const hits = searchCode(q, 10)
    if (hits.length) parts.push(`### Code: "${q}"`, JSON.stringify(hits))
  }

  if (VERIFY_RE.test(lower)) {
    try {
      parts.push('### leads row count', JSON.stringify(runReadonlyQuery('SELECT COUNT(*) AS c FROM leads')))
      parts.push(
        '### leads per company',
        JSON.stringify(runReadonlyQuery(
          'SELECT company_id, COUNT(*) AS lead_count FROM leads GROUP BY company_id ORDER BY lead_count DESC LIMIT 15',
        )),
      )
      parts.push(
        '### companies without leads',
        JSON.stringify(runReadonlyQuery(
          `SELECT c.id, c.name FROM companies c
           LEFT JOIN leads l ON l.company_id = c.id
           WHERE l.id IS NULL LIMIT 15`,
        )),
      )
    } catch (e) {
      parts.push(`Data check skipped: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return parts.join('\n').slice(0, 14000)
}
