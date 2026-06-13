/**
 * Build geo reference JSON from bundled Census/HUD-style data.
 * Place HUD ZIP-County CSV at packages/server/data/geo/source/ZIP_COUNTY.csv
 * or Census ZCTA-county at packages/server/data/geo/source/census_zcta_county.csv
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { US_COUNTIES, ZIP_ENTRIES, COUNTY_CITIES } from './geo-counties-data.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', 'data', 'geo')
const STATES_DIR = join(OUT_DIR, 'states')
const SOURCE_DIR = join(OUT_DIR, 'source')

mkdirSync(STATES_DIR, { recursive: true })
mkdirSync(SOURCE_DIR, { recursive: true })

type ZipEntry = typeof ZIP_ENTRIES[number]

const fipsToCounty = new Map<string, { state: string; name: string; fips: string }>()
for (const [state, counties] of Object.entries(US_COUNTIES)) {
  for (const c of counties) {
    fipsToCounty.set(c.fips, { state, name: c.name, fips: c.fips })
  }
}

function countyLabel(raw: string) {
  const county = raw.trim()
  if (!county) return ''
  if (county.includes('County') || county.includes('Parish') || county.includes('Borough') || county === 'District of Columbia') {
    return county
  }
  return `${county} County`
}

function defaultCity(countyName: string) {
  return countyName.replace(/ County$/, '').replace(/ Parish$/, '').replace(/ Borough$/, '')
}

function mergeHudCsv(zips: ZipEntry[]) {
  const hudPath = join(SOURCE_DIR, 'ZIP_COUNTY.csv')
  if (!existsSync(hudPath)) return zips
  const lines = readFileSync(hudPath, 'utf-8').split(/\r?\n/)
  const header = (lines[0] || '').toLowerCase()
  const zipIdx = header.includes('zip') ? header.split(',').findIndex(h => h.includes('zip')) : 0
  const stateIdx = header.includes('state') ? header.split(',').findIndex(h => h.includes('state')) : 1
  const countyIdx = header.includes('county') ? header.split(',').findIndex(h => h.includes('county') && !h.includes('fips')) : 2
  const cityIdx = header.includes('city') ? header.split(',').findIndex(h => h.includes('city')) : 3

  const seen = new Set(zips.map(z => `${z.zip}|${z.state}|${z.city}|${z.county}`))
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const zip = (cols[zipIdx >= 0 ? zipIdx : 0] || '').padStart(5, '0').slice(0, 5)
    const state = (cols[stateIdx >= 0 ? stateIdx : 1] || '').toUpperCase()
    const countyRaw = cols[countyIdx >= 0 ? countyIdx : 2] || ''
    const city = (cols[cityIdx >= 0 ? cityIdx : 3] || '').trim() || defaultCity(countyLabel(countyRaw))
    if (!zip || !state || !countyRaw) continue
    const countyName = countyLabel(countyRaw)
    const key = `${zip}|${state}|${city}|${countyName}`
    if (seen.has(key)) continue
    seen.add(key)
    const match = [...fipsToCounty.values()].find(c => c.state === state && c.name === countyName)
    zips.push({ zip, state, city, county: countyName, countyFips: match?.fips || '' })
  }
  return zips
}

function findCountyFips(state: string, countyRaw: string) {
  const base = countyRaw.trim()
  const counties = US_COUNTIES[state] || []
  const candidates = new Set([
    countyLabel(base),
    base,
    `${base} County`,
    `${base} Parish`,
    `${base} Borough`,
    `${base} Municipality`,
  ])
  const hit = counties.find(c => candidates.has(c.name) || c.name.replace(/ County$/, '') === base)
  return hit?.fips || ''
}

/** scpike/us-state-county-zip geo-data.csv — state_abbr, zipcode, county, city */
function mergeGeoDataCsv(zips: ZipEntry[]) {
  const path = join(SOURCE_DIR, 'geo-data.csv')
  if (!existsSync(path)) return zips
  const lines = readFileSync(path, 'utf-8').split(/\r?\n/)
  const seen = new Set(zips.map(z => `${z.zip}|${z.state}|${z.county}`))
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const state = (cols[2] || '').toUpperCase()
    const zip = (cols[3] || '').padStart(5, '0').slice(0, 5)
    const countyRaw = cols[4] || ''
    const city = (cols[5] || '').trim() || defaultCity(countyLabel(countyRaw))
    if (!zip || !state || !countyRaw) continue
    const countyName = countyLabel(countyRaw)
    const key = `${zip}|${state}|${countyName}`
    if (seen.has(key)) continue
    seen.add(key)
    zips.push({ zip, state, city, county: countyName, countyFips: findCountyFips(state, countyRaw) })
  }
  return zips
}

/** Census tab20_zcta520_county20_natl.csv — GEOID_ZCTA5_20, GEOID_COUNTY_20 */
function mergeCensusZctaCounty(zips: ZipEntry[]) {
  const path = join(SOURCE_DIR, 'census_zcta_county.csv')
  if (!existsSync(path)) return zips
  const lines = readFileSync(path, 'utf-8').split(/\r?\n/)
  const seen = new Set(zips.map(z => `${z.zip}|${z.state}|${z.county}`))
  for (const line of lines.slice(1)) {
    if (!line.trim()) continue
    const cols = line.split(',').map(c => c.replace(/"/g, '').trim())
    const zip = (cols[0] || '').padStart(5, '0').slice(0, 5)
    const countyFips = (cols[1] || '').padStart(5, '0').slice(0, 5)
    if (!zip || countyFips.length < 5) continue
    const meta = fipsToCounty.get(countyFips)
    if (!meta) continue
    const key = `${zip}|${meta.state}|${meta.name}`
    if (seen.has(key)) continue
    seen.add(key)
    zips.push({
      zip,
      state: meta.state,
      city: defaultCity(meta.name),
      county: meta.name,
      countyFips: meta.fips,
    })
  }
  return zips
}

let zipIndex = mergeGeoDataCsv(mergeCensusZctaCounty(mergeHudCsv([...ZIP_ENTRIES])))
writeFileSync(join(OUT_DIR, 'zip-index.json'), JSON.stringify(zipIndex, null, 0))

for (const [state, counties] of Object.entries(US_COUNTIES)) {
  const cities: { county: string; name: string }[] = []
  const cityMap = COUNTY_CITIES[state] || {}
  for (const c of counties) {
    const names = cityMap[c.name] || [c.name.replace(/ County$/, '').replace(/ Parish$/, '')]
    for (const name of names) {
      if (name) cities.push({ county: c.name, name })
    }
  }
  for (const z of zipIndex.filter(x => x.state === state)) {
    if (!cities.some(c => c.county === z.county && c.name === z.city)) {
      cities.push({ county: z.county, name: z.city })
    }
  }
  const shard = {
    counties: counties.map(c => ({ name: c.name, fips: c.fips })),
    cities: cities.sort((a, b) => a.name.localeCompare(b.name)),
  }
  writeFileSync(join(STATES_DIR, `${state}.json`), JSON.stringify(shard, null, 0))
}

console.log(`[build-geo-reference] Wrote zip-index (${zipIndex.length} rows) and ${Object.keys(US_COUNTIES).length} state shards`)
