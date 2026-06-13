import type { ProposedPatch } from './tools.js'

const PATH_RE = /(?:^|\n)\s*(?:\/\/|#|;)?\s*(?:file(?:path)?|path)\s*:\s*([^\n]+)/gi
const FENCE_RE = /```(?:[\w+-]+)?(?::([^\n]+))?\n([\s\S]*?)```/g
const WORKSPACE_PATH_RE = /(?:packages|shared|EnVars|scripts)\/[\w./-]+\.\w+/g

export function isImplementationRequest(prompt: string): boolean {
  return /implement|add|fix|create|update|change|ensure|make sure|build|convert|wire|hook up|detail record/i.test(prompt)
}

export function extractPatchesFromText(text: string, activePath?: string): ProposedPatch[] {
  const patches: ProposedPatch[] = []
  const seen = new Set<string>()

  let m: RegExpExecArray | null
  FENCE_RE.lastIndex = 0
  while ((m = FENCE_RE.exec(text)) !== null) {
    const hint = m[1]?.trim()
    const content = m[2].trim()
    if (!content || content.length < 20) continue

    let path = ''
    if (hint && /[/\\]/.test(hint)) {
      path = hint.replace(/\\/g, '/').replace(/^\.\//, '')
    } else {
      const pathMatch = content.match(/^(?:\/\/|#)\s*(?:file(?:path)?|path)\s*:\s*(.+)$/m)
      if (pathMatch) path = pathMatch[1].trim().replace(/\\/g, '/')
    }

    if (!path && activePath && patches.length === 0) path = activePath

    if (path && !seen.has(path)) {
      seen.add(path)
      const cleaned = content.replace(/^(?:\/\/|#)\s*(?:file(?:path)?|path)\s*:.+\n/m, '')
      patches.push({ path, content: cleaned })
    }
  }

  if (!patches.length) {
    const paths = [...new Set(text.match(WORKSPACE_PATH_RE) || [])]
    if (paths.length === 1 && text.includes('```')) {
      FENCE_RE.lastIndex = 0
      const block = FENCE_RE.exec(text)
      if (block?.[2]) {
        patches.push({ path: paths[0], content: block[2].trim() })
      }
    }
  }

  return patches
}
