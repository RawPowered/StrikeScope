import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DB_FILENAME } from '@strikescope/shared/src/brand.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const SERVER_DATA_DIR = join(__dirname, '..', 'data')
export const GEO_DATA_DIR = join(SERVER_DATA_DIR, 'geo')
export const DB_PATH = join(SERVER_DATA_DIR, DB_FILENAME)
export const DEV_SNAPSHOTS_DIR = join(SERVER_DATA_DIR, 'dev-snapshots')
export const DEV_KNOWLEDGE_DB_PATH = join(SERVER_DATA_DIR, 'dev-knowledge.db')
export const DEV_AGENT_DIR = join(SERVER_DATA_DIR, 'dev-agent')
