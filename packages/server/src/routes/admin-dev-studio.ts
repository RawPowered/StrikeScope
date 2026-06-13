import { Router } from 'express'
import { getConfig } from '../config.js'
import { requireRole } from '../auth.js'
import { initDevStudioFromServerConfig, setSelectedModel } from '../plugins/dev-agent/config.js'
import {
  checkOllamaHealth,
  resolveChatModel,
  resolveEmbedModel,
  createPlatformModel,
  invalidateModelCache,
  listDirectory,
  readWorkspaceFile,
  applyPatches,
  createSnapshot,
  listSnapshots,
  rollbackSnapshot,
  runReadonlyQuery,
  getSchemaOverview,
  getTableInfo,
  writeMigrationFile,
  registerMigrationInRunner,
  applyMigrationFile,
  checkCrossModuleEdits,
  runAgent,
  syncKnowledge,
  getKnowledgeStats,
  getGoldenExamples,
  getPendingPatches,
  clearPendingPatches,
  getPendingMigration,
  clearPendingMigration,
  recordGoldenExample,
  getDevStudioConfig,
  runDeployBuild,
  runDeployShip,
  runRollbackLast,
  readDeployState,
} from '../plugins/dev-agent/index.js'
import { syncPaths } from '../plugins/dev-agent/platform-knowledge/indexer.js'

const router = Router()

router.use((_req, res, next) => {
  if (!getConfig().devMode) {
    return res.status(404).json({ ok: false, error: 'Dev Studio only available in dev mode' })
  }
  initDevStudioFromServerConfig(getConfig().devStudio)
  next()
})

router.use(requireRole('server_admin'))

router.get('/status', async (_req, res) => {
  const ollama = await checkOllamaHealth()
  const knowledge = getKnowledgeStats()
  const cfg = getDevStudioConfig()
  let activeModel: string | null = null
  let activeEmbedModel: string | null = null
  let modelError: string | undefined
  if (ollama.ok) {
    try { activeModel = await resolveChatModel() } catch (e) { modelError = e instanceof Error ? e.message : String(e) }
    try { activeEmbedModel = await resolveEmbedModel() } catch { /* optional */ }
  }
  res.json({
    ok: true,
    data: {
      devMode: true,
      ollama,
      knowledge,
      activeModel,
      activeEmbedModel,
      modelError,
      config: {
        defaultModel: cfg.defaultModel,
        embedModel: cfg.embedModel,
        platformModel: cfg.platformModel,
        selectedModel: cfg.selectedModel,
        workspaceRoot: cfg.workspaceRoot,
        contextWindow: cfg.contextWindow ?? 16384,
        historyLimit: cfg.historyLimit ?? 4,
        ragTopK: cfg.ragTopK ?? 6,
        maxContextChars: cfg.maxContextChars ?? 24000,
      },
    },
  })
})

router.get('/models', async (_req, res) => {
  const ollama = await checkOllamaHealth()
  let activeModel: string | null = null
  let modelError: string | undefined
  if (ollama.ok) {
    try { activeModel = await resolveChatModel() } catch (e) { modelError = e instanceof Error ? e.message : String(e) }
  }
  res.json({ ok: true, data: { models: ollama.models, activeModel, modelError, ollamaOk: ollama.ok } })
})

router.post('/models/select', (req, res) => {
  const { model } = req.body as { model?: string }
  setSelectedModel(model || undefined)
  invalidateModelCache()
  res.json({ ok: true, data: { selectedModel: model || null } })
})

router.post('/models/create-platform', async (_req, res) => {
  const result = await createPlatformModel()
  if (!result.ok) return res.status(400).json({ ok: false, error: result.error })
  res.json({ ok: true, data: { model: result.model } })
})

router.get('/files', (req, res) => {
  try {
    const path = String(req.query.path || '')
    res.json({ ok: true, data: listDirectory(path) })
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/file', (req, res) => {
  try {
    const path = String(req.query.path || '')
    res.json({ ok: true, data: readWorkspaceFile(path) })
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/chat', async (req, res) => {
  const { prompt, activePath, history, historyLimit, stream, debugContext } = req.body as {
    prompt?: string
    activePath?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
    historyLimit?: number
    stream?: boolean
    debugContext?: { buildLog?: string; healthError?: string }
  }
  if (!prompt?.trim()) {
    return res.status(400).json({ ok: false, error: 'prompt required' })
  }

  const boundedHistory = historyLimit === undefined
    ? undefined
    : Math.min(20, Math.max(0, Math.floor(historyLimit)))

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    try {
      for await (const ev of runAgent({ prompt, activePath, history, historyLimit: boundedHistory, stream: true, debugContext })) {
        res.write(`data: ${JSON.stringify(ev)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (e) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: e instanceof Error ? e.message : String(e) })}\n\n`)
      res.end()
    }
    return
  }

  try {
    const events: unknown[] = []
    for await (const ev of runAgent({ prompt, activePath, history, historyLimit: boundedHistory, stream: false, debugContext })) {
      events.push(ev)
    }
    res.json({ ok: true, data: { events, patches: getPendingPatches(), migration: getPendingMigration() } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/apply', async (req, res) => {
  try {
    const {
      patches,
      migration,
      prompt,
      allowCrossModule,
    } = req.body as {
      patches?: { path: string; content: string }[]
      migration?: { filename: string; sql: string }
      prompt?: string
      allowCrossModule?: boolean
    }

    const patchList = patches?.length ? patches : getPendingPatches()
    if (!patchList.length && !migration) {
      return res.status(400).json({ ok: false, error: 'No patches or migration to apply' })
    }

    const paths = patchList.map(p => p.path)
    const guard = checkCrossModuleEdits(paths, !!allowCrossModule)

    const snapshot = createSnapshot({
      paths: migration ? [...paths, `packages/server/src/migrations/${migration.filename}`] : paths,
      userId: (req as { user?: { userId: string } }).user?.userId,
      prompt,
      includeDb: !!migration,
      migrationFile: migration?.filename,
    })

    if (patchList.length) applyPatches(patchList)

    if (migration) {
      writeMigrationFile(migration.filename, migration.sql)
      registerMigrationInRunner(migration.filename)
      applyMigrationFile(migration.filename)
    }

    const cfg = getDevStudioConfig()
    if (cfg.knowledgeAutoSync && paths.length) {
      await syncPaths(paths).catch(() => {})
    }
    if (cfg.learnFromApprovals && prompt) {
      await recordGoldenExample({
        prompt,
        files: paths,
        diffSummary: `Applied ${paths.length} file(s)${migration ? ` + migration ${migration.filename}` : ''}`,
        migrationSql: migration?.sql,
      }).catch(() => {})
    }

    clearPendingPatches()
    clearPendingMigration()

    res.json({
      ok: true,
      data: {
        snapshotId: snapshot.id,
        applied: paths,
        migration: migration?.filename,
        warnings: guard.warnings,
      },
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/deploy/build', async (req, res) => {
  try {
    const {
      patches,
      migration,
      prompt,
      allowCrossModule,
    } = req.body as {
      patches?: { path: string; content: string }[]
      migration?: { filename: string; sql: string }
      prompt?: string
      allowCrossModule?: boolean
    }

    const patchList = patches?.length ? patches : getPendingPatches()
    if (!patchList.length && !migration) {
      return res.status(400).json({ ok: false, error: 'No patches or migration to build' })
    }

    const result = await runDeployBuild({
      patches: patchList,
      migration: migration || getPendingMigration(),
      prompt,
      userId: (req as { user?: { userId: string } }).user?.userId,
      allowCrossModule: !!allowCrossModule,
    })

    if (result.ok) {
      clearPendingPatches()
      clearPendingMigration()
      const cfg = getDevStudioConfig()
      if (cfg.knowledgeAutoSync && patchList.length) {
        await syncPaths(patchList.map(p => p.path)).catch(() => {})
      }
    }

    res.json({
      ok: result.ok,
      data: {
        snapshotId: result.snapshotId,
        modules: result.modules,
        buildLog: result.buildLog,
        warnings: result.warnings,
        state: result.state,
      },
      error: result.ok ? undefined : 'Build failed',
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/deploy/ship', (_req, res) => {
  const result = runDeployShip()
  if (!result.ok) return res.status(400).json({ ok: false, error: result.error })
  res.json({ ok: true, data: { deployId: result.deployId, state: result.state } })
})

router.get('/deploy/status', (_req, res) => {
  const state = readDeployState()
  res.json({ ok: true, data: state })
})

router.post('/deploy/rollback-last', async (_req, res) => {
  try {
    const result = await runRollbackLast()
    if (!result.ok) return res.status(400).json({ ok: false, error: result.error, data: result })
    res.json({ ok: true, data: result })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/deploy/debug', async (req, res) => {
  const { buildLog, healthError, prompt, activePath, history, historyLimit, stream } = req.body as {
    buildLog?: string
    healthError?: string
    prompt?: string
    activePath?: string
    history?: { role: 'user' | 'assistant'; content: string }[]
    historyLimit?: number
    stream?: boolean
  }

  const debugPrompt = prompt?.trim() || 'Fix the build/deploy errors below and propose patches. Do not ship until build passes.'
  const boundedHistory = historyLimit === undefined
    ? undefined
    : Math.min(20, Math.max(0, Math.floor(historyLimit)))

  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()
    try {
      for await (const ev of runAgent({
        prompt: debugPrompt,
        activePath,
        history,
        historyLimit: boundedHistory,
        stream: true,
        debugContext: { buildLog, healthError },
      })) {
        res.write(`data: ${JSON.stringify(ev)}\n\n`)
      }
      res.write('data: [DONE]\n\n')
      res.end()
    } catch (e) {
      res.write(`data: ${JSON.stringify({ type: 'error', content: e instanceof Error ? e.message : String(e) })}\n\n`)
      res.end()
    }
    return
  }

  try {
    const events: unknown[] = []
    for await (const ev of runAgent({
      prompt: debugPrompt,
      activePath,
      history,
      historyLimit: boundedHistory,
      stream: false,
      debugContext: { buildLog, healthError },
    })) {
      events.push(ev)
    }
    res.json({ ok: true, data: { events, patches: getPendingPatches(), migration: getPendingMigration() } })
  } catch (e) {
    res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/snapshots', (_req, res) => {
  res.json({ ok: true, data: listSnapshots() })
})

router.post('/rollback/:id', (req, res) => {
  try {
    const result = rollbackSnapshot(req.params.id)
    res.json({ ok: true, data: result })
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/sql/query', (req, res) => {
  try {
    const { sql } = req.body as { sql?: string }
    if (!sql) return res.status(400).json({ ok: false, error: 'sql required' })
    res.json({ ok: true, data: runReadonlyQuery(sql) })
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.get('/sql/schema', (req, res) => {
  try {
    const table = req.query.table ? String(req.query.table) : null
    if (table) {
      res.json({ ok: true, data: getTableInfo(table) })
    } else {
      res.json({ ok: true, data: getSchemaOverview() })
    }
  } catch (e) {
    res.status(400).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

router.post('/knowledge/sync', async (req, res) => {
  const full = !!(req.body as { full?: boolean }).full
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.flushHeaders?.()

  try {
    const result = await syncKnowledge({
      full,
      onProgress: p => {
        res.write(`data: ${JSON.stringify({ type: 'progress', ...p })}\n\n`)
      },
    })
    res.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`)
    res.end()
  } catch (e) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: e instanceof Error ? e.message : String(e) })}\n\n`)
    res.end()
  }
})

router.get('/knowledge/stats', (_req, res) => {
  res.json({ ok: true, data: { ...getKnowledgeStats(), golden: getGoldenExamples() } })
})

export default router
