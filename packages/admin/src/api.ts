import { createClient } from '@strikescope/shared/src/api-client'

const baseUrl = import.meta.env.VITE_API_URL || ''
const ACTIVE_COMPANY_KEY = 'activeCompanyId'

function getToken() {
  try { return localStorage.getItem('jwt') } catch { return null }
}

function getActiveCompany() {
  try { return localStorage.getItem(ACTIVE_COMPANY_KEY) } catch { return null }
}

const client = createClient(baseUrl, '', '', '', getToken, getActiveCompany)

export const api = {
  get: <T>(path: string) => client.get<T>(path),
  post: <T>(path: string, body?: unknown) => client.post<T>(path, body),
  put: <T>(path: string, body?: unknown) => client.put<T>(path, body),
  patch: <T>(path: string, body?: unknown) => client.patch<T>(path, body),
  del: <T>(path: string) => client.del<T>(path),
  upload: <T>(path: string, form: FormData) => client.upload<T>(path, form),
}
