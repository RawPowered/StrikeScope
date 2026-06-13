-- 2026-06-09: Geo reference tables + jurisdiction approval workflow

CREATE TABLE IF NOT EXISTS geo_zip_lookup (
  zip TEXT NOT NULL,
  state TEXT NOT NULL,
  city TEXT NOT NULL,
  county_name TEXT NOT NULL,
  county_fips TEXT,
  PRIMARY KEY (zip, state, city, county_name)
);

CREATE INDEX IF NOT EXISTS idx_geo_zip_lookup_zip ON geo_zip_lookup(zip);

CREATE TABLE IF NOT EXISTS geo_counties (
  state TEXT NOT NULL,
  county_name TEXT NOT NULL,
  county_fips TEXT,
  PRIMARY KEY (state, county_name)
);

CREATE INDEX IF NOT EXISTS idx_geo_counties_state ON geo_counties(state);

CREATE TABLE IF NOT EXISTS geo_cities (
  state TEXT NOT NULL,
  county_name TEXT NOT NULL,
  city_name TEXT NOT NULL,
  PRIMARY KEY (state, county_name, city_name)
);

CREATE INDEX IF NOT EXISTS idx_geo_cities_state_county ON geo_cities(state, county_name);

CREATE TABLE IF NOT EXISTS territory_jurisdiction_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  city TEXT,
  zip TEXT,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'denied')),
  reviewed_by TEXT REFERENCES users(id),
  reviewed_at TEXT,
  review_note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_territory_jurisdiction_requests_company_status
  ON territory_jurisdiction_requests(company_id, status);

CREATE TABLE IF NOT EXISTS territory_jurisdiction_custom (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  county TEXT NOT NULL,
  city TEXT,
  source_request_id TEXT REFERENCES territory_jurisdiction_requests(id),
  approved_at TEXT DEFAULT (datetime('now')),
  UNIQUE(company_id, state, county, city)
);

CREATE INDEX IF NOT EXISTS idx_territory_jurisdiction_custom_company_state
  ON territory_jurisdiction_custom(company_id, state);
