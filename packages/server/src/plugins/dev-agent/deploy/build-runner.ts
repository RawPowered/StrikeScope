import { spawn } from 'child_process'
import { getWorkspaceRoot } from '../workspace.js'
import { orderedBuildModules, workspaceForModule, type DeployModule } from './module-resolver.js'

export interface BuildResult {
  ok: boolean
  buildLog: string
  failedModule?: DeployModule
  exitCode?: number
}

function runNpm(args: string[], cwd: string): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const cmd = isWin ? 'npm.cmd' : 'npm'
    const child = spawn(cmd, args, {
      cwd,
      shell: false,
      env: { ...process.env, FORCE_COLOR: '0' },
    })
    let output = ''
    child.stdout?.on('data', (d: Buffer) => { output += d.toString() })
    child.stderr?.on('data', (d: Buffer) => { output += d.toString() })
    child.on('close', (code) => resolve({ code: code ?? 1, output }))
    child.on('error', (err) => resolve({ code: 1, output: output + err.message }))
  })
}

export async function buildModules(modules: DeployModule[]): Promise<BuildResult> {
  const root = getWorkspaceRoot()
  const ordered = orderedBuildModules(modules)
  const logs: string[] = []

  for (const mod of ordered) {
    const ws = workspaceForModule(mod)
    logs.push(`\n--- build -w ${ws} ---\n`)
    const { code, output } = await runNpm(['run', 'build', '-w', ws], root)
    logs.push(output)
    if (code !== 0) {
      return {
        ok: false,
        buildLog: logs.join(''),
        failedModule: mod,
        exitCode: code,
      }
    }
  }

  return { ok: true, buildLog: logs.join('') }
}
