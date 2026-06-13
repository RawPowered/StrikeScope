import { useEffect, useRef, useState } from 'react'
import { useEmbedToken } from './useAutomations'

const SDK_URL = 'https://cdn.activepieces.com/sdk/embed/0.9.0.js'
const CONTAINER_ID = 'strikescope-automations-root'

function loadSdk(): Promise<void> {
  if (window.activepieces) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SDK_URL}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      return
    }
    const script = document.createElement('script')
    script.src = SDK_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Activepieces embed SDK'))
    document.head.appendChild(script)
  })
}

export function useActivepiecesEmbed(enabled: boolean, usePlatformTemplates = false) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const configured = useRef(false)
  const embedToken = useEmbedToken()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false

    async function run() {
      try {
        setError(null)
        const tokenData = await embedToken.mutateAsync()
        await loadSdk()
        if (cancelled || !window.activepieces) return

        const instanceUrl = import.meta.env.VITE_ACTIVEPIECES_URL || tokenData.instanceUrl
        await window.activepieces.configure({
          instanceUrl,
          jwtToken: tokenData.token,
          prefix: '/',
          embedding: {
            containerId: CONTAINER_ID,
            builder: { disableNavigation: true, hideFlowName: false },
            dashboard: { hideSidebar: true },
            hideFolders: false,
          },
        })

        if (!cancelled) {
          configured.current = true
          setReady(true)
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Embed failed')
      }
    }

    if (!configured.current) run()
    return () => { cancelled = true }
  }, [enabled, usePlatformTemplates])

  return { ready, error, containerId: CONTAINER_ID, loading: embedToken.isPending }
}
