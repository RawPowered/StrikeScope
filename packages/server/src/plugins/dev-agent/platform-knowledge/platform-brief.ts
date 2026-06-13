import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { getWorkspaceRoot } from '../workspace.js'
import { getFeatureMaps } from '../module-guard.js'

export function buildPlatformBrief(): string {
  const root = getWorkspaceRoot()
  const features = getFeatureMaps()
  const sysMapPath = join(root, 'EnVars', 'SysMap.xml')
  const varMapPath = join(root, 'EnVars', 'VarMap.xml')

  const lines: string[] = [
    '# StrikeScope Platform Brief',
    '',
    '## Architecture',
    '- Monorepo: shared, packages/server (Express+SQLite), packages/admin (React), installer, field, monitor',
    '- Plugins: packages/server/src/plugins/<name>/ with index.ts barrel; routes import directly',
    '- EnVars: EnVars/SysMap.xml (features/routes/plugins), EnVars/VarMap.xml (variables)',
    '- Auth: JWT middleware; server_admin bypasses permissions; devMode dev fallback user',
    '- Company scope: X-Active-Company header; requireActiveCompany on CRM routes',
    '',
    '## SQL Migration Rules',
    '- Files: YYYYMMDD_description.sql in packages/server/src/migrations/',
    '- Register in runner.ts MIGRATIONS array (ordered)',
    '- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS, INSERT OR IGNORE',
    '- No wrong charset; use binary-safe patterns',
    '',
    '## Features (' + features.length + ')',
  ]

  for (const f of features.slice(0, 40)) {
    lines.push(`- ${f.id}: owner=${f.owner || 'n/a'} routes=${f.routes.slice(0, 2).join(', ')}`)
  }

  if (existsSync(sysMapPath)) {
    lines.push('', '## SysMap present at EnVars/SysMap.xml')
  }
  if (existsSync(varMapPath)) {
    lines.push('## VarMap present at EnVars/VarMap.xml')
  }

  return lines.join('\n').slice(0, 8000)
}
