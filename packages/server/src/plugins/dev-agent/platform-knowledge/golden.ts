import { getDevStudioConfig } from '../config.js'
import { insertGolden } from './store.js'
import { embedWithFallback } from './embeddings.js'
import { getFeatureForPath } from '../module-guard.js'

export async function recordGoldenExample(opts: {
  prompt: string
  files: string[]
  diffSummary: string
  migrationSql?: string
}): Promise<void> {
  if (!getDevStudioConfig().learnFromApprovals) return
  const feature = opts.files[0] ? getFeatureForPath(opts.files[0]) : null
  const text = `${opts.prompt}\n${opts.diffSummary}`
  const embedding = await embedWithFallback(text)
  insertGolden({
    prompt: opts.prompt,
    featureId: feature?.id || null,
    files: opts.files,
    diffSummary: opts.diffSummary,
    migrationSql: opts.migrationSql,
    embedding,
  })
}
