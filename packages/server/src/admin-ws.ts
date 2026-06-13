import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import jwt from 'jsonwebtoken'
import type { WsEvent } from '@strikescope/shared/src/types.js'
import { JWT_SECRET } from './auth.js'

const adminClients = new Map<string, Set<WebSocket>>()
const MAX_ADMIN_CLIENTS = 50

let hub: { broadcastToCompany: (companyId: string, event: WsEvent) => void } | null = null

export function setupAdminWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/admin' })

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')
    if (!token) {
      ws.close(4001, 'Unauthorized')
      return
    }
    let payload: { companyId?: string }
    try {
      payload = jwt.verify(token, JWT_SECRET) as { companyId?: string }
    } catch {
      ws.close(4001, 'Unauthorized')
      return
    }
    const companyId = payload.companyId
    if (!companyId) {
      ws.close(4001, 'No company context')
      return
    }

    let set = adminClients.get(companyId)
    if (!set) {
      set = new Set()
      adminClients.set(companyId, set)
    }
    if (set.size >= MAX_ADMIN_CLIENTS) {
      ws.close(1013, 'Too many connections')
      return
    }

    set.add(ws)
    ws.on('close', () => {
      set!.delete(ws)
      if (set!.size === 0) adminClients.delete(companyId)
    })
    ws.on('error', () => set!.delete(ws))
  })

  hub = {
    broadcastToCompany(companyId: string, event: WsEvent) {
      const set = adminClients.get(companyId)
      if (!set) return
      const msg = JSON.stringify(event)
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(msg)
          } catch {
            set.delete(ws)
          }
        }
      }
    },
  }
  return hub
}

export function emitJurisdictionPending(companyId: string, count: number) {
  hub?.broadcastToCompany(companyId, {
    type: 'jurisdiction-pending',
    data: { companyId, count },
  })
}
