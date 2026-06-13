import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import type { ProjectProgress } from '@strikescope/shared/src/types'

export function ProjectProgressCard({ progress }: { progress: ProjectProgress }) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Job Progress</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-2">
        <div className="flex justify-between"><span>Complete</span><span className="font-medium">{progress.percentComplete}%</span></div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress.percentComplete}%` }} />
        </div>
        <div className="text-muted-foreground">{progress.completedSteps} of {progress.totalSteps} steps done · {progress.totalSteps - progress.completedSteps} left</div>
        {progress.lastCompleted && <div><span className="text-muted-foreground">Last completed: </span>{progress.lastCompleted.label}</div>}
        {progress.currentStep && <div><span className="text-muted-foreground">Current: </span>{progress.currentStep.label}</div>}
        {progress.nextStep && <div><span className="text-muted-foreground">Next: </span>{progress.nextStep.label}</div>}
      </CardContent>
    </Card>
  )
}
