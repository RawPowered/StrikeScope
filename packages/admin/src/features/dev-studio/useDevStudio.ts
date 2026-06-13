import { useCallback, useState } from 'react'

const baseUrl = import.meta.env.VITE_API_URL || ''

function getToken() {
  try { return localStorage.getItem('jwt') } catch { return null }
}

function authHeaders(): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const t = getToken()
  if (t) h.Authorization = `Bearer ${t}`
  return h
}

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
}

export interface PatchItem {
  path: string
  content: string
  previousHash?: string
}

export interface DevStudioStatus {
  ollama: { ok: boolean; models: { name: string }[]; error?: string }
  knowledge: { chunkCount: number; goldenCount: number; lastSync: string | null }
  config: {
    defaultModel: string
    embedModel: string
    workspaceRoot: string
    platformModel?: string
    contextWindow?: number
    historyLimit?: number
  }
}

export function useDevStudio() {
  const [loading, setLoading] = useState(false)

  const fetchJson = useCallback(async <T>(path: string, init?: RequestInit) => {
    const res = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...authHeaders(), ...init?.headers } })
    return res.json() as Promise<{ ok: boolean; data?: T; error?: string }>
  }, [])

  const getStatus = useCallback(() => fetchJson<DevStudioStatus>('/api/admin/dev-studio/status'), [fetchJson])

  const listFiles = useCallback((path = '') =>
    fetchJson<FileEntry[]>(`/api/admin/dev-studio/files?path=${encodeURIComponent(path)}`),
  [fetchJson])

  const readFile = useCallback((path: string) =>
    fetchJson<{ path: string; content: string; hash: string }>(`/api/admin/dev-studio/file?path=${encodeURIComponent(path)}`),
  [fetchJson])

  const chatStream = useCallback(async function* (
    prompt: string,
    activePath?: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    historyLimit?: number,
    debugContext?: { buildLog?: string; healthError?: string },
  ) {
    const res = await fetch(`${baseUrl}/api/admin/dev-studio/chat`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ prompt, activePath, history, historyLimit, stream: true, debugContext }),
    })
    if (!res.ok || !res.body) throw new Error('Chat stream failed')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim()
        if (!line || line === '[DONE]') continue
        try { yield JSON.parse(line) } catch { /* skip */ }
      }
    }
  }, [])

  const applyPatches = useCallback((body: {
    patches: PatchItem[]
    migration?: { filename: string; sql: string } | null
    prompt?: string
    allowCrossModule?: boolean
  }) => fetchJson<{ snapshotId: string; applied: string[]; warnings: string[] }>(
    '/api/admin/dev-studio/apply',
    { method: 'POST', body: JSON.stringify(body) },
  ), [fetchJson])

  const listSnapshots = useCallback(() =>
    fetchJson<{ id: string; createdAt: string; prompt?: string; files: { path: string }[] }[]>(
      '/api/admin/dev-studio/snapshots',
    ),
  [fetchJson])

  const rollback = useCallback((id: string) =>
    fetchJson<{ restoredFiles: string[]; dbRestored: boolean }>(
      `/api/admin/dev-studio/rollback/${id}`,
      { method: 'POST' },
    ),
  [fetchJson])

  const sqlQuery = useCallback((sql: string) =>
    fetchJson<{ columns: string[]; rows: Record<string, unknown>[] }>(
      '/api/admin/dev-studio/sql/query',
      { method: 'POST', body: JSON.stringify({ sql }) },
    ),
  [fetchJson])

  const getSchema = useCallback((table?: string) =>
    fetchJson<unknown>(`/api/admin/dev-studio/sql/schema${table ? `?table=${encodeURIComponent(table)}` : ''}`),
  [fetchJson])

  const syncKnowledge = useCallback(async function* (full = false) {
    const res = await fetch(`${baseUrl}/api/admin/dev-studio/knowledge/sync`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ full }),
    })
    if (!res.ok || !res.body) throw new Error('Knowledge sync failed')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim()
        if (!line) continue
        try { yield JSON.parse(line) } catch { /* skip */ }
      }
    }
  }, [])

  const getKnowledgeStats = useCallback(() =>
    fetchJson<{ chunkCount: number; goldenCount: number; lastSync: string | null; golden: unknown[] }>(
      '/api/admin/dev-studio/knowledge/stats',
    ),
  [fetchJson])

  const getModels = useCallback(() =>
    fetchJson<{ models: { name: string }[]; activeModel: string | null; modelError?: string }>(
      '/api/admin/dev-studio/models',
    ),
  [fetchJson])

  const selectModel = useCallback((model: string) =>
    fetchJson<{ selectedModel: string | null }>(
      '/api/admin/dev-studio/models/select',
      { method: 'POST', body: JSON.stringify({ model }) },
    ),
  [fetchJson])

  const createPlatformModel = useCallback(() =>
    fetchJson<{ model: string }>(
      '/api/admin/dev-studio/models/create-platform',
      { method: 'POST', body: JSON.stringify({}) },
    ),
  [fetchJson])

  const deployBuild = useCallback((body: {
    patches: PatchItem[]
    migration?: { filename: string; sql: string } | null
    prompt?: string
    allowCrossModule?: boolean
  }) => fetchJson<{
    snapshotId: string
    modules: string[]
    buildLog: string
    warnings: string[]
    state: unknown
  }>('/api/admin/dev-studio/deploy/build', { method: 'POST', body: JSON.stringify(body) }),
  [fetchJson])

  const deployShip = useCallback(() =>
    fetchJson<{ deployId: string; state: unknown }>(
      '/api/admin/dev-studio/deploy/ship',
      { method: 'POST', body: JSON.stringify({}) },
    ),
  [fetchJson])

  const deployStatus = useCallback(() =>
    fetchJson<Record<string, unknown>>('/api/admin/dev-studio/deploy/status'),
  [fetchJson])

  const rollbackLast = useCallback(() =>
    fetchJson<{ snapshotId: string; restoredFiles: string[]; state: unknown }>(
      '/api/admin/dev-studio/deploy/rollback-last',
      { method: 'POST', body: JSON.stringify({}) },
    ),
  [fetchJson])

  const debugStream = useCallback(async function* (body: {
    prompt?: string
    buildLog?: string
    healthError?: string
    activePath?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
    historyLimit?: number
  }) {
    const res = await fetch(`${baseUrl}/api/admin/dev-studio/deploy/debug`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
    })
    if (!res.ok || !res.body) throw new Error('Debug stream failed')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''
      for (const part of parts) {
        const line = part.replace(/^data: /, '').trim()
        if (!line || line === '[DONE]') continue
        try { yield JSON.parse(line) } catch { /* skip */ }
      }
    }
  }, [])

  return {
    loading,
    setLoading,
    getStatus,
    listFiles,
    readFile,
    chatStream,
    applyPatches,
    listSnapshots,
    rollback,
    sqlQuery,
    getSchema,
    syncKnowledge,
    getKnowledgeStats,
    getModels,
    selectModel,
    createPlatformModel,
    deployBuild,
    deployShip,
    deployStatus,
    rollbackLast,
    debugStream,
  }
}
