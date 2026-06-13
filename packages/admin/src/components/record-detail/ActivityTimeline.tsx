import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import type { Activity } from '@strikescope/shared/src/types'

export function ActivityTimeline({ activities, title = 'Activity' }: { activities: Activity[]; title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {activities.length === 0 && <p className="text-sm text-muted-foreground">No activity recorded.</p>}
        {activities.map(a => (
          <div key={a.id} className="flex justify-between gap-4 text-sm py-2 border-b border-border last:border-0">
            <div>
              <span className="font-medium">{a.userName || 'System'}</span>
              <span className="text-muted-foreground ml-2">{a.action}</span>
              {a.description && <p className="text-muted-foreground text-xs mt-0.5">{a.description}</p>}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
