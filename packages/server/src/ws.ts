import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import type { WsEvent } from '@strikescope/shared/src/types.js'
import { getConfig } from './config.js'

const clients = new Set<WebSocket>()
const MAX_CLIENTS = 100

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws/submissions' })

  wss.on('connection', (ws, req) => {
    // Auth: validate node key from ?token= query param
    const url = new URL(req.url || '', 'http://localhost')
    const token = url.searchParams.get('token')

    if (!getConfig().devMode) {
      const nodeKey = getConfig().keys.nodeKey
      if (token !== nodeKey) {
        ws.close(4001, 'Unauthorized')
        return
      }
    }

    if (clients.size >= MAX_CLIENTS) {
      ws.close(1013, 'Too many connections')
      return
    }

    clients.add(ws)

    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })

  return {
    broadcast(event: WsEvent) {
      const msg = JSON.stringify(event)
      for (const ws of clients) {
        if (ws.readyState === WebSocket.OPEN) {
          try {
            ws.send(msg)
          } catch {
            clients.delete(ws)
          }
        }
      }
    },
  }
}
