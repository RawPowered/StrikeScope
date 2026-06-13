import { useCallback, useEffect, useState } from 'react'
import { Loader2, RotateCcw, Wrench } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import type { PatchItem } from './useDevStudio'
import { useDevStudio } from './useDevStudio'

export type ShipPhase =
  | 'idle'
  | 'proposed'
  | 'building'
  | 'build_ok'
  | 'build_failed'
  | 'shipping'
  | 'shipped'
  | 'ship_failed'

export interface DeployState {
  phase?: string
  snapshotId?: string
  buildLog?: string
  healthError?: string
  errors?: string
  shippedAt?: string
}

interface Props {
  patches: PatchItem[]
  migration: { filename: string; sql: string } | null
  prompt: string
  allowCrossModule: boolean
  onReject: () => void
  onPreviewPatch: (path: string, content: string) => void
  onDebugRequest: (ctx: { buildLog?: string; healthError?: string; prompt: string }) => void
  onShipped?: () => void
  autoContinueBuild?: boolean
}

export function ShipPanel({
  patches,
  migration,
  prompt,
  allowCrossModule,
  onReject,
  onPreviewPatch,
  onDebugRequest,
  onShipped,
  autoContinueBuild,
}: Props) {
  const { deployBuild, deployShip, deployStatus, rollbackLast } = useDevStudio()
  const [phase, setPhase] = useState<ShipPhase>('idle')
  const [buildLog, setBuildLog] = useState('')
  const [deployState, setDeployState] = useState<DeployState | null>(null)
  const [busy, setBusy] = useState(false)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

  useEffect(() => {
    deployStatus().then(r => {
      if (r.ok && r.data) setDeployState(r.data as DeployState)
    })
  }, [deployStatus])

  useEffect(() => {
    if (patches.length || migration) setPhase(p => p === 'idle' || p === 'shipped' || p === 'ship_failed' ? 'proposed' : p)
    else if (phase === 'proposed') setPhase('idle')
  }, [patches, migration, phase])

  const continueBuildRef = useCallback(async () => {
    if (!patches.length && !migration) return
    setBusy(true)
    setPhase('building')
    setBuildLog('')
    const r = await deployBuild({ patches, migration, prompt, allowCrossModule })
    setBusy(false)
    if (r.ok && r.data) {
      setBuildLog(r.data.buildLog || '')
      setDeployState(r.data.state as DeployState || null)
      if (r.data.warnings?.length) r.data.warnings.forEach((w: string) => toast.warning(w))
      setPhase('build_ok')
      toast.success('Build passed — confirm to restart apps')
    } else {
      setBuildLog(r.data?.buildLog || r.error || 'Build failed')
      setDeployState(r.data?.state as DeployState || null)
      setPhase('build_failed')
      toast.error('Build failed')
    }
  }, [patches, migration, prompt, allowCrossModule, deployBuild])

  useEffect(() => {
    if (autoContinueBuild && patches.length && phase === 'proposed' && !busy) {
      continueBuildRef()
    }
  }, [autoContinueBuild, patches.length, phase, busy, continueBuildRef])

  const pollStatus = useCallback(async () => {
    const r = await deployStatus()
    if (!r.ok || !r.data) return
    const s = r.data as DeployState & { phase?: string }
    setDeployState(s)
    const p = s.phase as ShipPhase | undefined
    if (p === 'shipping') setPhase('shipping')
    else if (p === 'shipped') {
      setPhase('shipped')
      setBusy(false)
      toast.success('Update shipped — apps restarted')
      onShipped?.()
    } else if (p === 'ship_failed') {
      setPhase('ship_failed')
      setBusy(false)
      if (s.healthError || s.errors) toast.error(s.healthError || s.errors || 'Ship failed')
    }
  }, [deployStatus])

  useEffect(() => {
    if (phase !== 'shipping') return
    const t = setInterval(pollStatus, 2000)
    pollStatus()
    return () => clearInterval(t)
  }, [phase, pollStatus])

  const continueBuild = () => continueBuildRef()

  const confirmShip = async () => {
    setBusy(true)
    setPhase('shipping')
    const r = await deployShip()
    if (!r.ok) {
      setBusy(false)
      setPhase('build_ok')
      toast.error(r.error || 'Failed to start ship')
      return
    }
    toast.info('Restarting dev apps…')
    setTimeout(pollStatus, 3000)
  }

  const fixDebug = () => {
    onDebugRequest({
      buildLog: buildLog || deployState?.buildLog,
      healthError: deployState?.healthError || deployState?.errors,
      prompt: 'Fix the build/deploy errors and propose corrected patches.',
    })
  }

  const rollback = async () => {
    setBusy(true)
    setPhase('shipping')
    const r = await rollbackLast()
    if (!r.ok) {
      setBusy(false)
      toast.error(r.error || 'Rollback failed')
      return
    }
    toast.info('Rolling back and restarting…')
    setTimeout(pollStatus, 3000)
  }

  if (phase === 'idle' && !patches.length && !migration) {
    return (
      <div className="border-t bg-muted/10 px-3 py-2 flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          Ship pipeline: agent stages patches → Continue Build → Confirm Update
          {deployState?.shippedAt ? ` · Last ship ${new Date(deployState.shippedAt).toLocaleString()}` : ''}
        </span>
        {deployState?.snapshotId && (
          <Button size="sm" variant="outline" onClick={rollback} disabled={busy}>
            <RotateCcw className="h-3 w-3 mr-1" /> Rollback last
          </Button>
        )}
      </div>
    )
  }

  if (!patches.length && !migration && phase !== 'shipped' && phase !== 'ship_failed') return null

  return (
    <div className="border-t bg-muted/20 p-3 space-y-2 max-h-52 overflow-auto">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium">
          {phase === 'building' && <Loader2 className="inline h-3 w-3 animate-spin mr-1" />}
          Ship: {patches.length} file(s){migration ? ` + ${migration.filename}` : ''}
          {phase === 'build_ok' && <span className="text-green-600 text-xs ml-2">build ok</span>}
          {phase === 'build_failed' && <span className="text-red-600 text-xs ml-2">build failed</span>}
          {phase === 'shipping' && <span className="text-amber-600 text-xs ml-2">deploying…</span>}
          {phase === 'shipped' && <span className="text-green-600 text-xs ml-2">shipped</span>}
        </p>
        <div className="flex gap-1 flex-wrap">
          {(phase === 'proposed' || phase === 'build_failed') && (
            <>
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>Reject</Button>
              <Button size="sm" onClick={continueBuild} disabled={busy}>
                {busy ? 'Building…' : 'Continue Build'}
              </Button>
            </>
          )}
          {phase === 'build_ok' && (
            <>
              <Button size="sm" variant="outline" onClick={onReject} disabled={busy}>Reject</Button>
              <Button size="sm" variant="outline" onClick={continueBuild} disabled={busy}>Rebuild</Button>
              <Button size="sm" onClick={confirmShip} disabled={busy}>Confirm Update</Button>
            </>
          )}
          {(phase === 'build_failed' || phase === 'ship_failed') && (
            <Button size="sm" variant="secondary" onClick={fixDebug}>
              <Wrench className="h-3 w-3 mr-1" /> Fix/Debug
            </Button>
          )}
          {(phase === 'shipped' || phase === 'ship_failed' || deployState?.snapshotId) && (
            <Button size="sm" variant="outline" onClick={rollback} disabled={busy || phase === 'shipping'}>
              <RotateCcw className="h-3 w-3 mr-1" /> Rollback last
            </Button>
          )}
        </div>
      </div>

      {buildLog && (
        <pre className="rounded border bg-background p-2 text-[10px] overflow-auto max-h-24 whitespace-pre-wrap">{buildLog.slice(-4000)}</pre>
      )}

      {patches.map(p => (
        <button
          key={p.path}
          type="button"
          className={`w-full text-left rounded border p-2 text-xs ${selectedPath === p.path ? 'border-primary' : 'bg-background'}`}
          onClick={() => {
            setSelectedPath(p.path)
            onPreviewPatch(p.path, p.content)
          }}
        >
          <p className="font-mono font-medium">{p.path}</p>
          <p className="text-muted-foreground">{p.content.length} chars — click to preview</p>
        </button>
      ))}

      {migration && (
        <pre className="rounded border bg-background p-2 text-xs overflow-auto max-h-20">{migration.sql}</pre>
      )}
    </div>
  )
}
