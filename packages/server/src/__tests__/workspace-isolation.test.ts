import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import db, { migrate } from '../db.js'
import { loadMemberships } from '../auth.js'
import { requireEntityCompany, requireRelatedCompanyRecord } from '../routes/helpers.js'

const companyA = 'test-company-a'
const companyB = 'test-company-b'
const userId = 'test-user-membership'
const customerA = 'test-customer-a'
const customerB = 'test-customer-b'

function resMock() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: unknown) {
      this.body = body
      return this
    },
  }
  return res
}

function reqFor(companyId: string) {
  return {
    user: {
      userId,
      companyId,
      role: 'company_admin',
      name: 'Test User',
      roleId: null,
      rolePermissions: {},
    },
  } as any
}

function cleanup() {
  db.prepare('DELETE FROM customers WHERE id IN (?, ?)').run(customerA, customerB)
  db.prepare('DELETE FROM user_company_memberships WHERE user_id = ?').run(userId)
  db.prepare('DELETE FROM users WHERE id = ?').run(userId)
  db.prepare('DELETE FROM companies WHERE id IN (?, ?)').run(companyA, companyB)
}

describe('workspace isolation helpers', () => {
  beforeEach(() => {
    migrate()
    cleanup()
    db.prepare('INSERT INTO companies (id, name) VALUES (?, ?), (?, ?)').run(companyA, 'Company A', companyB, 'Company B')
    db.prepare('INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)').run(
      userId, 'workspace-test@example.com', 'Workspace Test', 'user', 'hash',
    )
    db.prepare('INSERT INTO user_company_memberships (id, user_id, company_id, role, role_id) VALUES (?, ?, ?, ?, NULL), (?, ?, ?, ?, NULL)').run(
      'test-membership-a', userId, companyA, 'company_admin',
      'test-membership-b', userId, companyB, 'user',
    )
    db.prepare('INSERT INTO customers (id, company_id, name) VALUES (?, ?, ?), (?, ?, ?)').run(
      customerA, companyA, 'Customer A',
      customerB, companyB, 'Customer B',
    )
  })

  afterEach(cleanup)

  it('loads distinct active memberships for one login identity', () => {
    const memberships = loadMemberships(userId)
    expect(memberships.map(m => m.companyId).sort()).toEqual([companyA, companyB])
  })

  it('accepts records in the active company and hides records from other companies', () => {
    const activeRes = resMock()
    expect(requireEntityCompany(reqFor(companyA), activeRes, 'customers', customerA)).toBe(companyA)
    expect(activeRes.statusCode).toBe(200)

    const foreignRes = resMock()
    expect(requireEntityCompany(reqFor(companyA), foreignRes, 'customers', customerB)).toBeNull()
    expect(foreignRes.statusCode).toBe(404)
  })

  it('validates user references through memberships, not users.company_id', () => {
    const activeRes = resMock()
    expect(requireRelatedCompanyRecord(activeRes, 'users', userId, companyA, 'Assigned user')?.id).toBe(userId)
    expect(activeRes.statusCode).toBe(200)

    db.prepare('DELETE FROM user_company_memberships WHERE user_id = ? AND company_id = ?').run(userId, companyB)
    const foreignRes = resMock()
    expect(requireRelatedCompanyRecord(foreignRes, 'users', userId, companyB, 'Assigned user')).toBeNull()
    expect(foreignRes.statusCode).toBe(400)
  })
})
