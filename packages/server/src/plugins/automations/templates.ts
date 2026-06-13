import { getAutomationsConfig } from './config.js'

export interface TemplateFlow {
  id: string
  name: string
  status: string
  updated?: string
}

export async function listPlatformTemplates(): Promise<{ flows: TemplateFlow[]; error?: string }> {
  const cfg = getAutomationsConfig()
  if (!cfg.platformAdminToken) {
    return { flows: [], error: 'ACTIVEPIECES_PLATFORM_ADMIN_TOKEN not configured' }
  }

  try {
    const res = await fetch(`${cfg.activepiecesUrl}/api/v1/flows?limit=100`, {
      headers: { Authorization: `Bearer ${cfg.platformAdminToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) {
      return { flows: [], error: `Activepieces API ${res.status}` }
    }
    const body = await res.json() as { data?: Array<{ id: string; version?: { displayName?: string; trigger?: { name?: string } }; status?: string; updated?: string }> }
    const flows = (body.data || []).map((f) => ({
      id: f.id,
      name: f.version?.displayName || f.id,
      status: f.status || 'UNKNOWN',
      updated: f.updated,
    }))
    return { flows }
  } catch (e: any) {
    return { flows: [], error: e.message || 'Failed to reach Activepieces' }
  }
}

export async function cloneTemplateToCompany(
  flowId: string,
  targetProjectId?: string,
): Promise<{ ok: boolean; flowId?: string; error?: string }> {
  const cfg = getAutomationsConfig()
  if (!cfg.platformAdminToken) {
    return { ok: false, error: 'ACTIVEPIECES_PLATFORM_ADMIN_TOKEN not configured' }
  }

  try {
    const getRes = await fetch(`${cfg.activepiecesUrl}/api/v1/flows/${flowId}`, {
      headers: { Authorization: `Bearer ${cfg.platformAdminToken}` },
      signal: AbortSignal.timeout(10000),
    })
    if (!getRes.ok) return { ok: false, error: `Flow not found (${getRes.status})` }
    const flow = await getRes.json() as { version?: Record<string, unknown> }

    const createBody: Record<string, unknown> = {
      displayName: `${(flow.version as any)?.displayName || 'Template'} (copy)`,
      projectId: targetProjectId,
    }

    const createRes = await fetch(`${cfg.activepiecesUrl}/api/v1/flows`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.platformAdminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(createBody),
      signal: AbortSignal.timeout(15000),
    })

    if (!createRes.ok) {
      const errText = await createRes.text().catch(() => createRes.statusText)
      return { ok: false, error: errText || `Clone failed (${createRes.status})` }
    }

    const created = await createRes.json() as { id?: string }
    return { ok: true, flowId: created.id }
  } catch (e: any) {
    return { ok: false, error: e.message || 'Clone failed' }
  }
}

export async function checkActivepiecesHealth(): Promise<{ reachable: boolean; status?: string; error?: string }> {
  const cfg = getAutomationsConfig()
  try {
    const res = await fetch(`${cfg.activepiecesUrl}/api/v1/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { reachable: false, error: `HTTP ${res.status}` }
    const body = await res.json().catch(() => ({})) as { status?: string }
    return { reachable: true, status: body.status || 'ok' }
  } catch (e: any) {
    return { reachable: false, error: e.message || 'Unreachable' }
  }
}
