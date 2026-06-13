import type Database from 'better-sqlite3'
import { getEnabledStatesForCompany } from '../../territory.js'

export type ZipRow = {
  zip: string
  state: string
  city: string
  countyName: string
  countyFips: string | null
}

let zipIndex = new Map<string, ZipRow[]>()
let geoWarmed = false

let stmtCounties: Database.Statement | null = null
let stmtCities: Database.Statement | null = null
let stmtCustomCounties: Database.Statement | null = null
let stmtCustomCities: Database.Statement | null = null

export function initStmtCache(db: Database.Database) {
  stmtCounties = db.prepare(`SELECT county_name as name, county_fips as fips
    FROM geo_counties WHERE state=? ORDER BY county_name ASC`)
  stmtCities = db.prepare(`SELECT city_name as name FROM geo_cities
    WHERE state=? AND county_name=? ORDER BY city_name ASC`)
  stmtCustomCounties = db.prepare(`SELECT DISTINCT county as name FROM territory_jurisdiction_custom
    WHERE company_id=? AND state=? ORDER BY county ASC`)
  stmtCustomCities = db.prepare(`SELECT DISTINCT city as name FROM territory_jurisdiction_custom
    WHERE company_id=? AND state=? AND county=? AND city IS NOT NULL AND city != ''
    ORDER BY city ASC`)
}

export function initZipIndex(db: Database.Database) {
  zipIndex = new Map()
  const rows = db.prepare(`SELECT zip, state, city, county_name as countyName, county_fips as countyFips
    FROM geo_zip_lookup ORDER BY city ASC`).all() as ZipRow[]
  for (const r of rows) {
    const list = zipIndex.get(r.zip) || []
    list.push(r)
    zipIndex.set(r.zip, list)
  }
}

/** Load zip index on first geo lookup — avoids blocking server boot */
export function ensureGeoWarm(db: Database.Database) {
  if (geoWarmed) return
  const count = (db.prepare('SELECT COUNT(*) as n FROM geo_zip_lookup').get() as { n: number }).n
  if (count === 0) {
    geoWarmed = true
    return
  }
  initStmtCache(db)
  initZipIndex(db)
  geoWarmed = true
}

export function lookupZip(db: Database.Database, zip: string): ZipRow[] {
  ensureGeoWarm(db)
  const normalized = zip.replace(/\D/g, '').slice(0, 5)
  if (normalized.length < 5) return []
  return zipIndex.get(normalized) || []
}

export function listCounties(db: Database.Database, companyId: string, state: string) {
  ensureGeoWarm(db)
  const enabledStates = getEnabledStatesForCompany(db, companyId)
  if (enabledStates.length && !enabledStates.includes(state)) return []

  if (!stmtCounties || !stmtCustomCounties) initStmtCache(db)

  const ref = stmtCounties!.all(state) as { name: string; fips: string | null }[]
  const custom = stmtCustomCounties!.all(companyId, state) as { name: string }[]

  const seen = new Set<string>()
  const merged: { name: string; fips: string | null; custom?: boolean }[] = []
  for (const c of ref) {
    if (!seen.has(c.name)) { seen.add(c.name); merged.push({ name: c.name, fips: c.fips }) }
  }
  for (const c of custom) {
    if (!seen.has(c.name)) { seen.add(c.name); merged.push({ name: c.name, fips: null, custom: true }) }
  }
  return merged
}

export function listCities(db: Database.Database, companyId: string, state: string, county: string) {
  ensureGeoWarm(db)
  if (!stmtCities || !stmtCustomCities) initStmtCache(db)

  const ref = stmtCities!.all(state, county) as { name: string }[]
  const custom = stmtCustomCities!.all(companyId, state, county) as { name: string }[]

  const seen = new Set<string>()
  const merged: { name: string; custom?: boolean }[] = []
  for (const c of ref) {
    if (!seen.has(c.name)) { seen.add(c.name); merged.push({ name: c.name }) }
  }
  for (const c of custom) {
    if (c.name && !seen.has(c.name)) { seen.add(c.name); merged.push({ name: c.name, custom: true }) }
  }
  return merged
}

export function geoCascade(
  db: Database.Database,
  companyId: string,
  opts: { state?: string; county?: string; zip?: string },
) {
  const zip = opts.zip ? lookupZip(db, opts.zip) : []
  const counties = opts.state ? listCounties(db, companyId, opts.state) : []
  const cities = opts.state && opts.county ? listCities(db, companyId, opts.state, opts.county) : []
  return { zip, counties, cities }
}
