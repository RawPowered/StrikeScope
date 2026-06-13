export async function checkHealth(host = 'http://127.0.0.1:3001', timeoutMs = 60_000): Promise<{
  ok: boolean
  error?: string
  statusCode?: number
}> {
  const start = Date.now()
  let lastError = 'Health check timed out'

  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${host}/api/health`, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return { ok: true, statusCode: res.status }
      lastError = `Health returned ${res.status}`
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e)
    }
    await new Promise(r => setTimeout(r, 1500))
  }

  return { ok: false, error: lastError }
}

export function truncateLog(log: string, max = 12000): string {
  if (log.length <= max) return log
  return `${log.slice(0, max)}\n…[truncated ${log.length - max} chars]`
}
