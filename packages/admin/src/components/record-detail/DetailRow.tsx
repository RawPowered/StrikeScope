import type { ReactNode } from 'react'

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-2 py-2 border-b border-border last:border-0 text-sm">
      <span className="text-muted-foreground font-medium">{label}</span>
      <span>{value ?? '—'}</span>
    </div>
  )
}
