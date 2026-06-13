import { v4 as uuid } from 'uuid'
import type Database from 'better-sqlite3'

const SUBMIT_ROLES = new Set(['sales_manager', 'project_manager', 'project_admin', 'company_admin', 'server_admin'])
const REVIEW_ROLES = new Set(['company_admin', 'server_admin'])

let stmtInsertRequest: Database.Statement | null = null
let stmtListRequests: Database.Statement | null = null
let stmtListRequestsFiltered: Database.Statement | null = null
let stmtCountPending: Database.Statement | null = null
let stmtGetRequest: Database.Statement | null = null
let stmtUpdateRequest: Database.Statement | null = null
let stmtInsertCustom: Database.Statement | null = null
let stmtInsertCounty: Database.Statement | null = null
let stmtInsertCity: Database.Statement | null = null

function initJurisdictionStmts(db: Database.Database) {
  if (stmtInsertRequest) return
  stmtInsertRequest = db.prepare(`INSERT INTO territory_jurisdiction_requests (id, company_id, user_id, state, county, city, zip, reason, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`)
  stmtListRequests = db.prepare(`SELECT r.id, r.company_id as companyId, r.user_id as userId, u.name as userName,
    r.state, r.county, r.city, r.zip, r.reason, r.status,
    r.reviewed_by as reviewedBy, r.reviewed_at as reviewedAt, r.review_note as reviewNote, r.created_at as createdAt
    FROM territory_jurisdiction_requests r
    JOIN users u ON u.id=r.user_id
    WHERE r.company_id=?
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`)
  stmtListRequestsFiltered = db.prepare(`SELECT r.id, r.company_id as companyId, r.user_id as userId, u.name as userName,
    r.state, r.county, r.city, r.zip, r.reason, r.status,
    r.reviewed_by as reviewedBy, r.reviewed_at as reviewedAt, r.review_note as reviewNote, r.created_at as createdAt
    FROM territory_jurisdiction_requests r
    JOIN users u ON u.id=r.user_id
    WHERE r.company_id=? AND r.status=?
    ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC`)
  stmtCountPending = db.prepare(`SELECT COUNT(*) as n FROM territory_jurisdiction_requests WHERE company_id=? AND status='pending'`)
  stmtGetRequest = db.prepare(`SELECT * FROM territory_jurisdiction_requests WHERE id=? AND company_id=?`)
  stmtUpdateRequest = db.prepare(`UPDATE territory_jurisdiction_requests SET status=?, reviewed_by=?, reviewed_at=?, review_note=? WHERE id=?`)
  stmtInsertCustom = db.prepare(`INSERT OR IGNORE INTO territory_jurisdiction_custom (id, company_id, state, county, city, source_request_id, approved_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
  stmtInsertCounty = db.prepare(`INSERT OR IGNORE INTO geo_counties (state, county_name, county_fips) VALUES (?, ?, NULL)`)
  stmtInsertCity = db.prepare(`INSERT OR IGNORE INTO geo_cities (state, county_name, city_name) VALUES (?, ?, ?)`)
}

export function canSubmitJurisdiction(role: string) {
  return SUBMIT_ROLES.has(role)
}

export function canReviewJurisdiction(role: string) {
  return REVIEW_ROLES.has(role)
}

export function createJurisdictionRequest(
  db: Database.Database,
  opts: { companyId: string; userId: string; state: string; county: string; city?: string; zip?: string; reason: string },
) {
  initJurisdictionStmts(db)
  const id = uuid()
  stmtInsertRequest!.run(id, opts.companyId, opts.userId, opts.state, opts.county, opts.city || null, opts.zip || null, opts.reason.trim())
  return id
}

export function listJurisdictionRequests(db: Database.Database, companyId: string, status?: string) {
  initJurisdictionStmts(db)
  return status
    ? stmtListRequestsFiltered!.all(companyId, status)
    : stmtListRequests!.all(companyId)
}

export function countPendingJurisdictionRequests(db: Database.Database, companyId: string) {
  initJurisdictionStmts(db)
  return (stmtCountPending!.get(companyId) as { n: number }).n
}

export function reviewJurisdictionRequest(
  db: Database.Database,
  opts: { id: string; companyId: string; reviewerId: string; status: 'approved' | 'denied'; reviewNote?: string },
) {
  initJurisdictionStmts(db)
  const row = stmtGetRequest!.get(opts.id, opts.companyId) as any
  if (!row) throw new Error('Request not found')
  if (row.status !== 'pending') throw new Error('Already reviewed')

  const now = new Date().toISOString()
  stmtUpdateRequest!.run(opts.status, opts.reviewerId, now, opts.reviewNote || null, opts.id)

  if (opts.status === 'approved') {
    const customId = uuid()
    stmtInsertCustom!.run(customId, opts.companyId, row.state, row.county, row.city || null, opts.id, now)
    stmtInsertCounty!.run(row.state, row.county)
    if (row.city) stmtInsertCity!.run(row.state, row.county, row.city)
  }
  return { status: opts.status }
}
