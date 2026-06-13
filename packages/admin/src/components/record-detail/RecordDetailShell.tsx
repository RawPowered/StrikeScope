import type { ReactNode } from 'react'
import { PageHeader } from '../../layout/PageHeader'
import { LoadingState, EmptyState } from '../EmptyState'
import { Button } from '../ui/button'

export function RecordDetailShell({
  loading,
  notFound,
  backLabel,
  onBack,
  title,
  description,
  actions,
  notFoundTitle = 'Record not found',
  children,
}: {
  loading: boolean
  notFound: boolean
  backLabel: string
  onBack: () => void
  title?: string
  description?: string
  actions?: ReactNode
  notFoundTitle?: string
  children: ReactNode
}) {
  if (loading) return <LoadingState rows={4} />

  if (notFound) {
    return (
      <EmptyState
        title={notFoundTitle}
        action={<Button variant="outline" onClick={onBack}>{backLabel}</Button>}
      />
    )
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>&larr; {backLabel}</Button>
      {(title || actions) && (
        <PageHeader title={title || ''} description={description} actions={actions} />
      )}
      {children}
    </div>
  )
}
