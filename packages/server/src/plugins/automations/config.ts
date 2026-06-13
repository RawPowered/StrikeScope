export interface AutomationsConfig {
  activepiecesUrl: string
  signingKey: string | null
  signingKeyId: string | null
  platformAdminToken: string | null
  platformExternalProjectId: string
}

export function getAutomationsConfig(): AutomationsConfig {
  return {
    activepiecesUrl: (process.env.ACTIVEPIECES_URL || 'http://localhost:8080').replace(/\/$/, ''),
    signingKey: process.env.ACTIVEPIECES_SIGNING_KEY || null,
    signingKeyId: process.env.ACTIVEPIECES_SIGNING_KEY_ID || null,
    platformAdminToken: process.env.ACTIVEPIECES_PLATFORM_ADMIN_TOKEN || null,
    platformExternalProjectId: 'platform:templates',
  }
}

export function isEmbedConfigured(): boolean {
  const c = getAutomationsConfig()
  return Boolean(c.signingKey && c.signingKeyId)
}
