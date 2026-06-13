export function authSecret(auth: unknown): string {
  if (typeof auth === 'string') return auth
  if (auth && typeof auth === 'object' && 'secret_text' in auth) {
    return String((auth as { secret_text: string }).secret_text)
  }
  return String(auth ?? '')
}
