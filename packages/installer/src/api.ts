import { createClient } from '@strikescope/shared/src/api-client'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001'
const appKey = import.meta.env.VITE_APP_KEY || 'installer'
const apiKey = import.meta.env.VITE_API_KEY || 'dev-api-key'
const nodeKey = import.meta.env.VITE_NODE_KEY || 'dev-node-key'

export const api = createClient(baseUrl, appKey, apiKey, nodeKey)
