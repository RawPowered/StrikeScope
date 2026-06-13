import type { ApiResponse } from './types'

export function createClient(
  baseUrl: string,
  appKey?: string,
  apiKey?: string,
  nodeKey?: string,
  tokenGetter?: () => string | null,
  activeCompanyGetter?: () => string | null,
) {
  function buildHeaders(): Record<string, string> {
    const h: Record<string, string> = { 'Content-Type': 'application/json' }
    if (appKey) h['X-App-Key'] = appKey
    if (apiKey) h['X-Api-Key'] = apiKey
    if (nodeKey) h['X-Node-Key'] = nodeKey
    if (tokenGetter) {
      const t = tokenGetter()
      if (t) h['Authorization'] = `Bearer ${t}`
    }
    if (activeCompanyGetter) {
      const companyId = activeCompanyGetter()
      if (companyId) h['X-Active-Company'] = companyId
    }
    return h
  }

  async function request<T>(method: string, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const opts: RequestInit = { method, headers: buildHeaders() }
    if (body) opts.body = JSON.stringify(body)
    const res = await fetch(`${baseUrl}${path}`, opts)
    return res.json()
  }

  async function upload<T>(path: string, form: FormData): Promise<ApiResponse<T>> {
    const h = buildHeaders()
    delete h['Content-Type']
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: h,
      body: form,
    })
    return res.json()
  }

  return {
    get: <T>(path: string) => request<T>('GET', path),
    post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
    put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
    patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
    del: <T>(path: string) => request<T>('DELETE', path),
    upload: <T>(path: string, form: FormData) => upload<T>(path, form),
  }
}
