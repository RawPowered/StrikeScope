import { buildPlatformBrief } from './platform-brief.js'
import { getAllChunks, getGoldenExamples, blobToEmbedding, getKnowledgeDb } from './store.js'
import { embedWithFallback, cosineSimilarity } from './embeddings.js'
import { getFeatureForPath } from '../module-guard.js'

export interface RetrievedContext {
  brief: string
  chunks: { path: string; content: string; score: number }[]
  golden: { prompt: string; diff_summary: string; files: string[] }[]
  tokenEstimate: number
}

export async function retrieveContext(opts: {
  query: string
  activePath?: string
  topK?: number
  maxChars?: number
}): Promise<RetrievedContext> {
  const topK = opts.topK ?? 6
  const maxChars = opts.maxChars ?? 24000
  const brief = buildPlatformBrief()
  const queryEmb = await embedWithFallback(opts.query)
  const activeFeature = opts.activePath ? getFeatureForPath(opts.activePath) : null

  const all = getAllChunks()
  const scored = all.map(c => {
    let score = 0
    if (c.embedding?.length) {
      score = cosineSimilarity(queryEmb, c.embedding)
    } else {
      const q = opts.query.toLowerCase()
      if (c.content.toLowerCase().includes(q)) score = 0.5
    }
    if (opts.activePath && c.path === opts.activePath) score += 2
    if (activeFeature && c.feature_id === activeFeature.id) score += 0.5
    if (c.path.includes('migrations') && opts.query.toLowerCase().includes('sql')) score += 0.3
    return { path: c.path, content: c.content, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const chunks = scored.slice(0, topK).filter(c => c.score > 0.05)

  const goldenRows = getKnowledgeDb().prepare(
    'SELECT prompt, diff_summary, files, embedding_blob FROM knowledge_golden ORDER BY id DESC LIMIT 20',
  ).all() as { prompt: string; diff_summary: string; files: string; embedding_blob: Buffer | null }[]

  const goldenScored = goldenRows.map(g => {
    let score = 0
    if (g.embedding_blob) {
      score = cosineSimilarity(queryEmb, blobToEmbedding(g.embedding_blob))
    }
    if (activeFeature && g.prompt.toLowerCase().includes(activeFeature.id)) score += 0.3
    return {
      prompt: g.prompt,
      diff_summary: g.diff_summary,
      files: JSON.parse(g.files) as string[],
      score,
    }
  }).sort((a, b) => b.score - a.score)

  const golden = goldenScored.slice(0, 3).map(g => ({
    prompt: g.prompt,
    diff_summary: g.diff_summary,
    files: g.files,
  }))

  const text = brief + chunks.map(c => c.content).join('') + golden.map(g => g.prompt).join('')
  const tokenEstimate = Math.ceil(text.length / 4)

  return { brief, chunks, golden, tokenEstimate }
}

export function formatContextForPrompt(ctx: RetrievedContext, maxChars = 24000): string {
  const parts = [ctx.brief, '', '## Retrieved code context']
  for (const c of ctx.chunks) {
    parts.push(`### ${c.path}`, '```', c.content.slice(0, 2000), '```', '')
  }
  if (ctx.golden.length) {
    parts.push('## Prior approved fixes')
    for (const g of ctx.golden) {
      parts.push(`- Prompt: ${g.prompt}`, `  Summary: ${g.diff_summary}`, `  Files: ${g.files.join(', ')}`)
    }
  }
  return parts.join('\n').slice(0, maxChars)
}
