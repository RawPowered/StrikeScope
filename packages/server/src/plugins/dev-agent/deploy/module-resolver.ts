export type DeployModule = 'shared' | 'server' | 'admin' | 'field' | 'installer' | 'monitor'

export type RestartTarget = 'server' | 'field' | 'installer' | 'monitor'

const BUILD_ORDER: DeployModule[] = ['shared', 'server', 'admin', 'field', 'installer', 'monitor']

const WORKSPACE_MAP: Record<DeployModule, string> = {
  shared: 'shared',
  server: 'packages/server',
  admin: 'packages/admin',
  field: 'packages/field',
  installer: 'packages/installer',
  monitor: 'packages/monitor',
}

const RESTART_TARGETS: Record<DeployModule, RestartTarget[]> = {
  shared: ['server', 'field', 'installer', 'monitor'],
  server: ['server'],
  admin: ['server'],
  field: ['field'],
  installer: ['installer'],
  monitor: ['monitor'],
}

export function resolveModulesFromPaths(paths: string[]): DeployModule[] {
  const mods = new Set<DeployModule>()
  const normalized = paths.map(p => p.replace(/\\/g, '/'))

  for (const p of normalized) {
    if (p.startsWith('shared/')) mods.add('shared')
    else if (p.startsWith('packages/server/')) mods.add('server')
    else if (p.startsWith('packages/admin/')) mods.add('admin')
    else if (p.startsWith('packages/field/')) mods.add('field')
    else if (p.startsWith('packages/installer/')) mods.add('installer')
    else if (p.startsWith('packages/monitor/')) mods.add('monitor')
  }

  if (mods.has('shared')) {
    mods.add('server')
    mods.add('admin')
    mods.add('field')
    mods.add('installer')
    mods.add('monitor')
  }

  return BUILD_ORDER.filter(m => mods.has(m))
}

export function resolveRestartTargets(modules: DeployModule[]): RestartTarget[] {
  const targets = new Set<RestartTarget>()
  for (const m of modules) {
    for (const t of RESTART_TARGETS[m]) targets.add(t)
  }
  return ['server', 'field', 'installer', 'monitor'].filter(t => targets.has(t as RestartTarget)) as RestartTarget[]
}

export function workspaceForModule(mod: DeployModule): string {
  return WORKSPACE_MAP[mod]
}

export function orderedBuildModules(modules: DeployModule[]): DeployModule[] {
  return BUILD_ORDER.filter(m => modules.includes(m))
}
