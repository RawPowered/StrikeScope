import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { DEV_AGENT_DIR } from '../../../paths.js'
import type { DeployModule, RestartTarget } from './module-resolver.js'

export type DeployPhase = 'idle' | 'building' | 'build_ok' | 'build_failed' | 'shipping' | 'shipped' | 'ship_failed' | 'rolling_back'

export interface LastDeployState {
  deployId: string
  phase: DeployPhase
  snapshotId?: string
  modules: DeployModule[]
  restartTargets: RestartTarget[]
  buildLog?: string
  buildOk?: boolean
  healthOk?: boolean
  healthError?: string
  shippedAt?: string
  errors?: string
  updatedAt: string
  prompt?: string
}

const STATE_PATH = join(DEV_AGENT_DIR, 'last-deploy.json')
const MANIFEST_PATH = join(DEV_AGENT_DIR, 'ship-manifest.json')

function ensureDir() {
  if (!existsSync(DEV_AGENT_DIR)) mkdirSync(DEV_AGENT_DIR, { recursive: true })
}

export function readDeployState(): LastDeployState | null {
  if (!existsSync(STATE_PATH)) return null
  try {
    return JSON.parse(readFileSync(STATE_PATH, 'utf-8')) as LastDeployState
  } catch {
    return null
  }
}

export function writeDeployState(state: LastDeployState): void {
  ensureDir()
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf-8')
}

export function updateDeployState(patch: Partial<LastDeployState>): LastDeployState {
  const prev = readDeployState()
  const next: LastDeployState = {
    deployId: patch.deployId || prev?.deployId || `deploy-${Date.now()}`,
    phase: patch.phase || prev?.phase || 'idle',
    snapshotId: patch.snapshotId ?? prev?.snapshotId,
    modules: patch.modules ?? prev?.modules ?? [],
    restartTargets: patch.restartTargets ?? prev?.restartTargets ?? [],
    buildLog: patch.buildLog ?? prev?.buildLog,
    buildOk: patch.buildOk ?? prev?.buildOk,
    healthOk: patch.healthOk ?? prev?.healthOk,
    healthError: patch.healthError ?? prev?.healthError,
    shippedAt: patch.shippedAt ?? prev?.shippedAt,
    errors: patch.errors ?? prev?.errors,
    prompt: patch.prompt ?? prev?.prompt,
    updatedAt: new Date().toISOString(),
  }
  writeDeployState(next)
  return next
}

export interface ShipManifest {
  deployId: string
  snapshotId: string
  rootDir: string
  modules: DeployModule[]
  restartTargets: RestartTarget[]
  restartAll: boolean
}

export function writeShipManifest(manifest: ShipManifest): void {
  ensureDir()
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8')
}

export function readShipManifest(): ShipManifest | null {
  if (!existsSync(MANIFEST_PATH)) return null
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8')) as ShipManifest
  } catch {
    return null
  }
}

export function getLastSnapshotId(): string | null {
  return readDeployState()?.snapshotId ?? null
}
