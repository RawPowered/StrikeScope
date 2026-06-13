import { v4 as uuid } from 'uuid'
import { applyPatches } from '../workspace.js'
import type { ProposedPatch } from '../tools.js'
import {
  createSnapshot,
  rollbackSnapshot,
  getSnapshot,
  updateSnapshotDeployMeta,
} from '../snapshots.js'
import { checkCrossModuleEdits } from '../module-guard.js'
import {
  writeMigrationFile,
  registerMigrationInRunner,
  applyMigrationFile,
} from '../sql-tools.js'
import { getWorkspaceRoot } from '../workspace.js'
import {
  resolveModulesFromPaths,
  resolveRestartTargets,
  type DeployModule,
} from './module-resolver.js'
import { buildModules } from './build-runner.js'
import { truncateLog } from './validate.js'
import {
  updateDeployState,
  readDeployState,
  writeShipManifest,
  getLastSnapshotId,
  type LastDeployState,
} from './ship-state.js'
import { queueDetachedShip } from './restart.js'

export * from './module-resolver.js'
export * from './build-runner.js'
export * from './validate.js'
export * from './ship-state.js'
export * from './restart.js'

export interface DeployBuildInput {
  patches: ProposedPatch[]
  migration?: { filename: string; sql: string } | null
  prompt?: string
  userId?: string
  allowCrossModule?: boolean
}

export interface DeployBuildResult {
  ok: boolean
  snapshotId: string
  modules: string[]
  buildLog: string
  warnings: string[]
  state: LastDeployState
}

export async function runDeployBuild(input: DeployBuildInput): Promise<DeployBuildResult> {
  const paths = input.patches.map(p => p.path)
  const guard = checkCrossModuleEdits(paths, !!input.allowCrossModule)
  const modules = resolveModulesFromPaths(paths)
  const deployId = uuid()

  updateDeployState({
    deployId,
    phase: 'building',
    modules,
    restartTargets: resolveRestartTargets(modules),
    prompt: input.prompt,
  })

  const snapshotPaths = input.migration
    ? [...paths, `packages/server/src/migrations/${input.migration.filename}`]
    : paths

  const snapshot = createSnapshot({
    paths: snapshotPaths,
    userId: input.userId,
    prompt: input.prompt,
    includeDb: !!input.migration,
    migrationFile: input.migration?.filename,
  })

  if (input.patches.length) applyPatches(input.patches)

  if (input.migration) {
    writeMigrationFile(input.migration.filename, input.migration.sql)
    registerMigrationInRunner(input.migration.filename)
    applyMigrationFile(input.migration.filename)
  }

  const build = await buildModules(modules)
  const buildLog = truncateLog(build.buildLog)

  if (!build.ok) {
    const state = updateDeployState({
      deployId,
      phase: 'build_failed',
      snapshotId: snapshot.id,
      modules,
      restartTargets: resolveRestartTargets(modules),
      buildLog,
      buildOk: false,
      prompt: input.prompt,
    })
    updateSnapshotDeployMeta(snapshot.id, { modules, buildOk: false, buildLog })
    return {
      ok: false,
      snapshotId: snapshot.id,
      modules,
      buildLog,
      warnings: guard.warnings,
      state,
    }
  }

  const state = updateDeployState({
    deployId,
    phase: 'build_ok',
    snapshotId: snapshot.id,
    modules,
    restartTargets: resolveRestartTargets(modules),
    buildLog,
    buildOk: true,
    prompt: input.prompt,
  })

  updateSnapshotDeployMeta(snapshot.id, { modules, buildOk: true, buildLog })

  return {
    ok: true,
    snapshotId: snapshot.id,
    modules,
    buildLog,
    warnings: guard.warnings,
    state,
  }
}

export function runDeployShip(): { ok: boolean; deployId?: string; error?: string; state?: LastDeployState } {
  const current = readDeployState()
  if (!current?.snapshotId) {
    return { ok: false, error: 'No successful build to ship. Run Continue Build first.' }
  }
  if (current.buildOk === false) {
    return { ok: false, error: 'Last build failed. Fix errors before shipping.' }
  }
  if (current.phase === 'building' || current.phase === 'shipping') {
    return { ok: false, error: 'Deploy already in progress.' }
  }

  const modules = current.modules
  const restartTargets = current.restartTargets.length
    ? current.restartTargets
    : resolveRestartTargets(modules)

  const manifest = {
    deployId: current.deployId,
    snapshotId: current.snapshotId,
    rootDir: getWorkspaceRoot(),
    modules,
    restartTargets,
    restartAll: true,
  }

  writeShipManifest(manifest)
  const queued = queueDetachedShip(manifest)
  if (!queued.ok) {
    return { ok: false, error: queued.error || 'Failed to queue ship script' }
  }

  const state = updateDeployState({
    deployId: current.deployId,
    phase: 'shipping',
    snapshotId: current.snapshotId,
    modules,
    restartTargets,
    buildOk: true,
  })

  return { ok: true, deployId: current.deployId, state }
}

export async function runRollbackLast(): Promise<{
  ok: boolean
  snapshotId?: string
  restoredFiles?: string[]
  error?: string
  state?: LastDeployState
}> {
  const snapshotId = getLastSnapshotId()
  if (!snapshotId) {
    return { ok: false, error: 'No snapshot to rollback' }
  }

  updateDeployState({ phase: 'rolling_back', snapshotId })

  const snap = getSnapshot(snapshotId)
  const modules: DeployModule[] = snap?.deploy?.modules?.length
    ? (snap.deploy.modules as DeployModule[])
    : resolveModulesFromPaths(snap?.files.map(f => f.path) || [])

  const { restoredFiles, dbRestored } = rollbackSnapshot(snapshotId)
  const build = await buildModules(modules)

  if (!build.ok) {
    const state = updateDeployState({
      phase: 'build_failed',
      snapshotId,
      modules,
      buildLog: truncateLog(build.buildLog),
      buildOk: false,
      errors: `Rollback restored ${restoredFiles.length} file(s)${dbRestored ? ' + DB' : ''} but rebuild failed`,
    })
    return {
      ok: false,
      snapshotId,
      restoredFiles,
      error: state.errors,
      state,
    }
  }

  const restartTargets = resolveRestartTargets(modules)
  const deployId = `rollback-${Date.now()}`
  const manifest = {
    deployId,
    snapshotId,
    rootDir: getWorkspaceRoot(),
    modules,
    restartTargets,
    restartAll: true,
  }
  writeShipManifest(manifest)
  queueDetachedShip(manifest)

  const state = updateDeployState({
    deployId,
    phase: 'shipping',
    snapshotId,
    modules,
    restartTargets,
    buildOk: true,
    buildLog: truncateLog(build.buildLog),
  })

  return { ok: true, snapshotId, restoredFiles, state }
}
