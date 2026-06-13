import { createClient } from '@strikescope/shared/src/api-client'

const baseUrl = import.meta.env.VITE_API_URL || ''

function getToken() {
  try { return localStorage.getItem('field_jwt') } catch { return null }
}

export const api = createClient(baseUrl, '', '', '', getToken)

export function setFieldToken(token: string) {
  localStorage.setItem('field_jwt', token)
}

export function clearFieldToken() {
  localStorage.removeItem('field_jwt')
  sessionStorage.removeItem('field_action_token')
}

export function getActionToken() {
  try { return sessionStorage.getItem('field_action_token') } catch { return null }
}

export function setActionToken(token: string) {
  sessionStorage.setItem('field_action_token', token)
}
