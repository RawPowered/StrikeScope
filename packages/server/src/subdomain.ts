import type { Request, Response, NextFunction } from 'express'
import db from './db.js'

export function subdomainMiddleware(req: Request, _res: Response, next: NextFunction) {
  const host = req.headers.host || ''
  const parts = host.split('.')

  // Check for subdomain pattern: subdomain.localhost:PORT or subdomain.domain.com
  let subdomain: string | null = null
  if (parts.length >= 3 && parts[0] !== 'www') {
    subdomain = parts[0]
  }
  if (parts.length >= 2 && host.includes('sandbox')) {
    subdomain = parts[0]
  }

  if (subdomain) {
    const domain = db.prepare('SELECT company_id, is_sandbox FROM company_domains WHERE domain = ? AND is_active = 1').get(subdomain) as any
    if (domain) {
      req.subdomainCompanyId = domain.company_id
      req.isSandbox = domain.is_sandbox === 1
    }
  }

  next()
}

declare global {
  namespace Express {
    interface Request {
      subdomainCompanyId?: string
      isSandbox?: boolean
    }
  }
}
