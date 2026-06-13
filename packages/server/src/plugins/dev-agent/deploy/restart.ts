import { spawn } from 'child_process'
import { join } from 'path'
import { getWorkspaceRoot } from '../workspace.js'
import type { ShipManifest } from './ship-state.js'

export function queueDetachedShip(manifest: ShipManifest): { ok: boolean; error?: string } {
  const root = getWorkspaceRoot()
  const scriptPath = join(root, 'scripts', 'dev-studio-ship.ps1')
  const manifestPath = join(root, 'packages', 'server', 'data', 'dev-agent', 'ship-manifest.json')

  const args = [
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', scriptPath,
    '-ManifestPath', manifestPath,
  ]

  try {
    const child = spawn('powershell.exe', args, {
      cwd: root,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    })
    child.unref()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}
