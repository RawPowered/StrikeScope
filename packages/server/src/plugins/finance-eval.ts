import { create, all } from 'mathjs'

const math = create(all, {})

export function buildFinanceScope(costLines: { category: string | null; amount: number }[], fieldValues: Record<string, number>) {
  const scope: Record<string, number> = { ...fieldValues }
  const byCategory: Record<string, number> = {}
  let costTotal = 0
  for (const line of costLines) {
    costTotal += line.amount
    const cat = (line.category || 'other').toLowerCase().replace(/[^a-z0-9_]/g, '_')
    byCategory[cat] = (byCategory[cat] || 0) + line.amount
    byCategory[`costs_${cat}`] = byCategory[cat]
  }
  scope.cost_total = costTotal
  scope.COST_TOTAL = costTotal
  for (const [k, v] of Object.entries(byCategory)) {
    scope[k] = v
    scope[`SUM_${k.toUpperCase()}`] = v
  }
  return scope
}

export function evaluateFormula(expression: string, scope: Record<string, number>): number | null {
  try {
    const result = math.evaluate(expression, scope)
    const n = typeof result === 'number' ? result : parseFloat(String(result))
    return isNaN(n) ? null : Math.round(n * 100) / 100
  } catch {
    return null
  }
}

export function canAccessFinance(role: string | undefined, roleName?: string): boolean {
  if (role === 'server_admin' || role === 'company_admin') return true
  return roleName === 'Sales Manager' || roleName === 'Project Admin'
}

export function canAccessCommissionPayoutOnly(role: string | undefined, roleName?: string): boolean {
  return roleName === 'Sales Agent'
}
