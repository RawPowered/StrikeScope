import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api'
import { useMapsClientConfig } from './useMapsClientConfig'

function formatAddress(parts: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null }) {
  return [parts.address, parts.city, parts.state, parts.zip].filter(Boolean).join(', ')
}

export function MapDirectionsLink({ address }: { address: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } }) {
  const { data: config } = useMapsClientConfig()
  if (!config?.enableDirections) return null
  const q = encodeURIComponent(formatAddress(address))
  if (!q) return null
  return (
    <a
      href={`https://www.google.com/maps/dir/?api=1&destination=${q}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary hover:underline"
    >
      Get directions
    </a>
  )
}

export function MapEmbed({ address }: { address: { address?: string | null; city?: string | null; state?: string | null; zip?: string | null } }) {
  const { data: config } = useMapsClientConfig()
  const formatted = formatAddress(address)
  const { data: embed } = useQuery({
    queryKey: ['maps-embed-url', formatted],
    queryFn: async () => {
      const r = await api.get<{ url: string }>(`/api/admin/maps/embed-url?address=${encodeURIComponent(formatted)}`)
      return r.ok && r.data ? r.data : null
    },
    enabled: !!config?.enableMapEmbed && !!formatted,
    staleTime: 300_000,
  })
  if (!config?.enableMapEmbed || !formatted || !embed?.url) return null
  return (
    <iframe
      title="Map"
      className="w-full h-48 rounded-md border border-border mt-2"
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      src={embed.url}
    />
  )
}
