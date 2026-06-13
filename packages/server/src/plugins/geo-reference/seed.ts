import { readFileSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import type Database from 'better-sqlite3'
import { GEO_DATA_DIR } from '../../paths.js'
import { initZipIndex, initStmtCache } from './lookup.js'

const GEO_DIR = GEO_DATA_DIR

export function seedGeoReference(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as n FROM geo_zip_lookup').get() as { n: number }).n
  if (count > 0) return

  const zipPath = join(GEO_DIR, 'zip-index.json')
  if (!existsSync(zipPath)) {
    console.warn('[geo-reference] zip-index.json missing — run: npm run build:geo -w packages/server')
    return
  }

  const zips = JSON.parse(readFileSync(zipPath, 'utf-8')) as {
    zip: string; state: string; city: string; county: string; countyFips?: string
  }[]

  const insertZip = db.prepare(`INSERT OR IGNORE INTO geo_zip_lookup (zip, state, city, county_name, county_fips) VALUES (?, ?, ?, ?, ?)`)
  const insertCounty = db.prepare(`INSERT OR IGNORE INTO geo_counties (state, county_name, county_fips) VALUES (?, ?, ?)`)
  const insertCity = db.prepare(`INSERT OR IGNORE INTO geo_cities (state, county_name, city_name) VALUES (?, ?, ?)`)

  const tx = db.transaction(() => {
    for (const z of zips) {
      insertZip.run(z.zip, z.state, z.city, z.county, z.countyFips || null)
      insertCounty.run(z.state, z.county, z.countyFips || null)
      insertCity.run(z.state, z.county, z.city)
    }

    const statesDir = join(GEO_DIR, 'states')
    if (existsSync(statesDir)) {
      for (const file of readdirSync(statesDir).filter(f => f.endsWith('.json'))) {
        const state = file.replace('.json', '')
        const shard = JSON.parse(readFileSync(join(statesDir, file), 'utf-8')) as {
          counties?: { name: string; fips?: string }[]
          cities?: { county: string; name: string }[]
        }
        for (const c of shard.counties || []) {
          insertCounty.run(state, c.name, c.fips || null)
        }
        for (const c of shard.cities || []) {
          insertCity.run(state, c.county, c.name)
        }
      }
    }
  })
  tx()
  console.log(`[geo-reference] Seeded ${zips.length}+ reference rows`)
  initStmtCache(db)
  initZipIndex(db)
}
